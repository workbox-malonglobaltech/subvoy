import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { google } from 'googleapis';
import * as userModel from '../models/user';
import * as workspaceModel from '../models/workspace.model';
import { signToken } from '../services/auth.service';
import { authCookieOptions } from '../lib/cookie';
import { pool } from '../db';

const router = Router();

// Short-lived cookie holding the OAuth CSRF state nonce (must survive the Google
// redirect → SameSite=lax; cleared right after the callback validates it).
const OAUTH_STATE_COOKIE = 'oauth_state';
const oauthStateCookieOpts = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 10 * 60 * 1000, // 10 minutes
};

// 'strict' previously could drop the cookie across the OAuth redirect chain;
// the shared helper defaults to 'lax' (correct for OAuth) and is env-tunable.
const COOKIE_OPTIONS = authCookieOptions();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.OAUTH_REDIRECT_BASE_URL ?? 'http://localhost:3001'}/auth/google/callback`
  );
}

// GET /auth/google — redirect user to Google consent screen
router.get('/google', (_req: Request, res: Response) => {
  const oauth2 = getOAuth2Client();
  // CSRF protection: random state echoed by Google + stored in a cookie we verify.
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, state, oauthStateCookieOpts);
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  });
  res.redirect(url);
});

// GET /auth/google/callback — Google redirects here after consent
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error, state } = req.query as { code?: string; error?: string; state?: string };
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  // Validate the CSRF state before doing anything else; clear the nonce cookie.
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
  res.clearCookie(OAUTH_STATE_COOKIE, { ...oauthStateCookieOpts, maxAge: undefined });
  if (!state || !cookieState || state !== cookieState) {
    return res.redirect(`${frontendUrl}/login?error=oauth_state`);
  }

  if (error || !code) {
    return res.redirect(`${frontendUrl}/login?error=oauth_cancelled`);
  }

  try {
    const oauth2 = getOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);

    // Fetch the user's Google profile
    const oauth2Api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data: profile } = await oauth2Api.userinfo.get();

    const { email, name, id: googleId } = profile;
    if (!email) {
      return res.redirect(`${frontendUrl}/login?error=oauth_no_email`);
    }

    // Find or create the user
    let user = await userModel.findByEmail(email);

    if (!user) {
      // New user via Google — no password (they sign in via OAuth only)
      const { rows } = await pool.query<{ id: string; email: string; name: string | null; created_at: Date }>(
        `INSERT INTO users (email, name, google_id, password_hash)
         VALUES ($1, $2, $3, '')
         RETURNING id, email, name, created_at`,
        [email, name ?? null, googleId ?? null]
      );
      const row = rows[0];
      user = {
        id: row.id,
        email: row.email,
        name: row.name ?? null,
        createdAt: row.created_at.toISOString(),
        hasPassword: false,
        role: 'user',
        suspendedAt: null,
      };
    } else {
      // Existing user — update google_id if not already stored
      await pool.query(
        `UPDATE users SET google_id = $1, updated_at = NOW() WHERE id = $2 AND (google_id IS NULL OR google_id = '')`,
        [googleId ?? null, user.id]
      );
    }

    // Fetch token_version for the JWT
    if (!user) throw new Error('User not found after find-or-create');
    // Ensure the user has a Personal workspace (idempotent — no-op if it exists).
    await workspaceModel.ensurePersonalWorkspace(user.id);
    const { rows: vRows } = await pool.query<{ token_version: number }>(
      'SELECT token_version FROM users WHERE id = $1',
      [user.id]
    );
    const tokenVersion = vRows[0]?.token_version ?? 0;
    const token = signToken(user.id, tokenVersion);

    res.cookie('token', token, COOKIE_OPTIONS);
    res.redirect(frontendUrl);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/login?error=oauth_failed`);
  }
});

export default router;
