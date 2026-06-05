import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { pool } from '../db';
import { hashPassword } from '../services/auth.service';
import { sendPasswordResetEmail } from '../services/email.service';

const router = Router();

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string()
    .min(10, 'Password must be at least 10 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

/**
 * POST /auth/forgot-password
 * Always returns 200 — never reveals whether the email exists (prevents enumeration).
 */
router.post('/forgot-password', validate(forgotSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body as z.infer<typeof forgotSchema>;

    const { rows } = await pool.query<{ id: string; name: string | null }>(
      'SELECT id, name FROM users WHERE email = $1',
      [email]
    );

    if (rows[0]) {
      const user = rows[0];

      // Generate a cryptographically secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Invalidate any existing tokens for this user first
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

      // Store the hash (never the raw token)
      await pool.query(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      // Send the email with the raw token (only we know the hash)
      const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/reset-password?token=${rawToken}`;
      try {
        await sendPasswordResetEmail({ to: email, name: user.name ?? 'there', resetUrl });
      } catch (emailErr) {
        // Log but don't surface — email failures must not reveal user existence or break the flow
        console.error('Forgot password email error:', emailErr);
        console.log(`[Dev] Reset URL for ${email}: ${resetUrl}`);
      }
    }

    // Always return the same response regardless of whether user exists
    res.status(200).json({
      success: true,
      data: { message: 'If that email is registered, a reset link has been sent.' },
      error: null,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to process request' });
  }
});

/**
 * POST /auth/reset-password
 * Validates the raw token, sets the new password, and invalidates the token.
 */
router.post('/reset-password', validate(resetSchema), async (req: Request, res: Response) => {
  try {
    const { token: rawToken, newPassword } = req.body as z.infer<typeof resetSchema>;

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { rows } = await pool.query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    const record = rows[0];

    if (!record || record.used_at || record.expires_at < new Date()) {
      res.status(400).json({ success: false, data: null, error: 'Invalid or expired reset link' });
      return;
    }

    const newHash = await hashPassword(newPassword);

    // Update password + increment token_version (logs out all existing sessions)
    await pool.query(
      'UPDATE users SET password_hash = $1, token_version = token_version + 1, updated_at = NOW() WHERE id = $2',
      [newHash, record.user_id]
    );

    // Mark token as used (single-use)
    await pool.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [record.id]
    );

    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to reset password' });
  }
});

export default router;
