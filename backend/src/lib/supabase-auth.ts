/**
 * Supabase Auth as the single identity provider (web + iOS + Android).
 *
 * Used as IdP-ONLY: clients authenticate with Supabase, send the access token as
 * `Authorization: Bearer <jwt>`, and this verifies it and maps the Supabase user
 * to our domain user. The Express API keeps owning all workspace/capability/
 * entitlement authorization.
 *
 * Verification supports both Supabase key models:
 *   • NEW asymmetric keys (sb_publishable_/sb_secret_) → verified via the project
 *     JWKS endpoint using SUPABASE_URL (no shared secret).
 *   • LEGACY HS256 shared secret → SUPABASE_JWT_SECRET.
 * Gated: a no-op until one of those env vars is set, so the legacy cookie path is
 * unaffected during migration.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import * as userModel from '../models/user';
import * as workspaceModel from '../models/workspace.model';
import { sendWelcomeEmail } from '../services/email.service';
import type { User } from '../../../src/shared/types';

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_JWT_SECRET);
}

export interface SupabaseIdentity {
  supabaseUserId: string;
  email: string | null;
  name: string | null;
}

// JWKS cache (keys rotate rarely) — fetched from the project's public endpoint.
interface Jwk { kid?: string; kty?: string; [k: string]: unknown }
let jwksCache: { keys: Jwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 10 * 60 * 1000;

async function fetchJwks(force = false): Promise<Jwk[]> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  // /auth/v1 routes go through the gateway, which expects the apikey header.
  const headers = process.env.SUPABASE_ANON_KEY ? { apikey: process.env.SUPABASE_ANON_KEY } : undefined;
  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch Supabase JWKS (${res.status})`);
  const data = (await res.json()) as { keys: Jwk[] };
  jwksCache = { keys: data.keys ?? [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

/** Resolves the signing public key (PEM) for a token's `kid` (refetching once on a miss). */
async function publicKeyFor(token: string): Promise<string> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new Error('Invalid Supabase token header');
  }
  const kid = decoded.header.kid;
  let jwk = (await fetchJwks()).find(k => k.kid === kid);
  if (!jwk) jwk = (await fetchJwks(true)).find(k => k.kid === kid); // key rotation
  if (!jwk) throw new Error('No matching Supabase signing key');
  // jsonwebtoken expects a PEM string for asymmetric keys, not a KeyObject.
  return crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' }) as string;
}

function identityFromClaims(payload: { sub?: unknown; email?: unknown; user_metadata?: unknown }): SupabaseIdentity {
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid Supabase token: no subject');
  const meta = (payload.user_metadata ?? {}) as Record<string, unknown>;
  const name =
    typeof meta.name === 'string' ? meta.name :
    typeof meta.full_name === 'string' ? meta.full_name : null;
  return {
    supabaseUserId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    name,
  };
}

/** Verifies a Supabase access token and extracts identity (JWKS, or legacy HS256). */
export async function verifySupabaseToken(token: string): Promise<SupabaseIdentity> {
  // Preferred: asymmetric keys (ES256/RS256) via the project JWKS endpoint.
  if (process.env.SUPABASE_URL) {
    const publicKey = await publicKeyFor(token);
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['ES256', 'RS256'],
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    }) as jwt.JwtPayload;
    return identityFromClaims(payload);
  }

  // Legacy: shared HS256 secret.
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('Supabase auth not configured');
  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  if (payload.aud && payload.aud !== 'authenticated') throw new Error('Unexpected token audience');
  return identityFromClaims(payload);
}

/**
 * Maps a Supabase identity to a domain user, creating/linking as needed.
 * Doubles as the migration bridge: an existing user (matched by email) gets their
 * auth_user_id linked on first Supabase login — no forced password reset.
 */
export async function resolveDomainUser(identity: SupabaseIdentity): Promise<User> {
  const byAuth = await userModel.findByAuthId(identity.supabaseUserId);
  if (byAuth) return byAuth;

  if (identity.email) {
    const byEmail = await userModel.findByEmail(identity.email);
    if (byEmail) {
      await userModel.linkAuthUserId(byEmail.id, identity.supabaseUserId);
      return byEmail;
    }
  }

  if (!identity.email) throw new Error('Supabase identity missing email');
  const user = await userModel.createFromAuth({
    email: identity.email, name: identity.name, authUserId: identity.supabaseUserId,
  });
  await workspaceModel.ensurePersonalWorkspace(user.id);
  // First-time signup → send the welcome email. Fire-and-forget: never block or
  // fail provisioning if email delivery hiccups.
  sendWelcomeEmail({ to: user.email, name: user.name ?? user.email.split('@')[0] })
    .catch(err => console.error('Welcome email failed:', err));
  return user;
}
