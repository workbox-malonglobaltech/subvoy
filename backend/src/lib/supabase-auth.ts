/**
 * Supabase Auth as the single identity provider (web + iOS + Android).
 *
 * Used as IdP-ONLY: clients authenticate with Supabase, send the access token as
 * `Authorization: Bearer <jwt>`, and this verifies it and maps the Supabase user
 * to our domain user. The Express API keeps owning all workspace/capability/
 * entitlement authorization. Gated on SUPABASE_JWT_SECRET — a no-op until set,
 * so the legacy cookie/JWT path is unaffected during migration.
 */
import jwt from 'jsonwebtoken';
import * as userModel from '../models/user';
import * as workspaceModel from '../models/workspace.model';
import type { User } from '../../../src/shared/types';

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(process.env.SUPABASE_JWT_SECRET);
}

export interface SupabaseIdentity {
  supabaseUserId: string;
  email: string | null;
  name: string | null;
}

/** Verifies a Supabase access token (HS256 project secret) and extracts identity. */
export function verifySupabaseToken(token: string): SupabaseIdentity {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('Supabase auth not configured');

  const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
  if (!payload.sub || typeof payload.sub !== 'string') throw new Error('Invalid Supabase token: no subject');
  // Supabase access tokens are issued with aud 'authenticated'.
  if (payload.aud && payload.aud !== 'authenticated') throw new Error('Unexpected token audience');

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

  // Brand-new user provisioned by Supabase (e.g. OAuth signup).
  if (!identity.email) throw new Error('Supabase identity missing email');
  const user = await userModel.createFromAuth({
    email: identity.email, name: identity.name, authUserId: identity.supabaseUserId,
  });
  await workspaceModel.ensurePersonalWorkspace(user.id);
  return user;
}
