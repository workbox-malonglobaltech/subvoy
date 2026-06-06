import { Router, Request, Response, CookieOptions } from 'express';
import { google } from 'googleapis';
import * as userModel from '../models/user';
import * as workspaceModel from '../models/workspace.model';
import { signToken } from '../services/auth.service';
import { pool } from '../db';

const router = Router();

const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

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
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  });
  res.redirect(url);
});

// GET /auth/google/callback — Google redirects here after consent
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

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
