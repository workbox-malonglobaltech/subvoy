import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import * as userModel from '../models/user';
import * as workspaceModel from '../models/workspace.model';
import { hashPassword, comparePassword, signToken } from '../services/auth.service';
import { sendWelcomeEmail } from '../services/email.service';
import { getCountryCurrency } from '../services/country-settings.service';
import { authCookieOptions, clearCookieOptions } from '../lib/cookie';
import { pool } from '../db';
// Note: findByEmail now returns User (no passwordHash). Use getPasswordHash for login comparison.

const router = Router();

const COOKIE_OPTIONS = authCookieOptions();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be under 128 characters') // bcrypt truncates at 72 bytes; cap well below
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1).max(255).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body as z.infer<typeof registerSchema>;

    const existing = await userModel.findByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, data: null, error: 'Email already in use' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await userModel.createUser({ email, passwordHash, name });
    // Every user gets a Personal workspace on signup (idempotent).
    await workspaceModel.ensurePersonalWorkspace(user.id);
    const token = signToken(user.id, 0); // new users start at token_version 0

    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(201).json({ success: true, data: user, error: null });

    // Fire welcome email asynchronously — don't block the response
    sendWelcomeEmail({
      to:   email,
      name: name ?? email.split('@')[0],
    }).catch(err => console.error('[auth] Welcome email failed:', err));
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, data: null, error: 'Registration failed' });
  }
});

router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    // Fetch hash separately — findByEmail returns only safe public user fields
    const [user, hash] = await Promise.all([
      userModel.findByEmail(email),
      userModel.getPasswordHash(email),
    ]);

    // Use constant-time comparison regardless of whether user exists (prevent timing attacks)
    const DUMMY_HASH = '$2b$12$invalidhashfortimingprotection000000000000000000000000';
    const valid = await comparePassword(password, hash ?? DUMMY_HASH);

    if (!user || !hash || !valid) {
      res.status(401).json({ success: false, data: null, error: 'Invalid email or password' });
      return;
    }

    // Fetch current token_version so we embed it in the JWT
    const { rows: vRows } = await pool.query<{ token_version: number }>(
      'SELECT token_version FROM users WHERE id = $1', [user.id]
    );
    const tokenVersion = vRows[0]?.token_version ?? 0;
    const token = signToken(user.id, tokenVersion);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.status(200).json({ success: true, data: user, error: null });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, data: null, error: 'Login failed' });
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    // Increment token_version — all existing JWTs for this user are now invalid
    await userModel.incrementTokenVersion(req.user!.id);
  } catch (err) {
    console.error('Logout token revocation error:', err);
    // Still clear the cookie even if DB update fails
  }
  // Don't pass maxAge — clearCookie sets its own expiry to clear the cookie
  res.clearCookie('token', clearCookieOptions());
  res.status(200).json({ success: true, data: null, error: null });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string()
    .min(10, 'Password must be at least 10 characters')
    .max(128, 'Password must be under 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

router.put('/password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;
    const user = await userModel.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }

    const hash = await userModel.getPasswordHash(user.email);
    const DUMMY_HASH = '$2b$12$invalidhashfortimingprotection000000000000000000000000';
    const valid = await comparePassword(currentPassword, hash ?? DUMMY_HASH);
    if (!hash || !valid) {
      res.status(401).json({ success: false, data: null, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await hashPassword(newPassword);
    await userModel.updatePasswordHash(req.user!.id, newHash);
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to change password' });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await userModel.findById(req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, data: user, error: null });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch user' });
  }
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).nullable(),
});

router.put('/profile', authenticate, validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const { name } = req.body as z.infer<typeof updateProfileSchema>;
    const user = await userModel.updateName(req.user!.id, name);
    if (!user) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }
    res.status(200).json({ success: true, data: user, error: null });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update profile' });
  }
});

const timezoneSchema = z.object({
  timezone: z.string().min(1).max(64),
});

// Silently set the user's IANA timezone (the web client posts the browser tz on load).
router.put('/timezone', authenticate, validate(timezoneSchema), async (req: Request, res: Response) => {
  try {
    await userModel.updateTimezone(req.user!.id, req.body.timezone);
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Update timezone error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update timezone' });
  }
});

// GET /auth/locale — the user's country + display currencies. Rule: the US shows
// USD only; every other country shows its local currency AND USD.
router.get('/locale', authenticate, async (req: Request, res: Response) => {
  try {
    const country = await userModel.getCountry(req.user!.id);
    const currency = await getCountryCurrency(country);
    const currencies = currency === 'USD' ? ['USD'] : [currency, 'USD'];
    res.status(200).json({ success: true, data: { country, currency, currencies }, error: null });
  } catch (err) {
    console.error('Locale error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch locale' });
  }
});

const countrySchema = z.object({
  country: z.string().length(2),
});

// Set the user's country (web client posts this at registration; drives currency).
router.put('/country', authenticate, validate(countrySchema), async (req: Request, res: Response) => {
  try {
    await userModel.updateCountry(req.user!.id, req.body.country);
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Update country error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update country' });
  }
});

const deleteAccountSchema = z.object({
  password: z.string().min(1).optional(),
});

router.delete('/account', authenticate, validate(deleteAccountSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const user = await userModel.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }

    // For password accounts, require the password to confirm deletion
    if (user.hasPassword) {
      const { password } = req.body as z.infer<typeof deleteAccountSchema>;
      if (!password) {
        res.status(400).json({ success: false, data: null, error: 'Password required to delete account' });
        return;
      }
      const hash = await userModel.getPasswordHash(user.email);
      const DUMMY_HASH = '$2b$12$invalidhashfortimingprotection000000000000000000000000';
      const valid = await comparePassword(password, hash ?? DUMMY_HASH);
      if (!hash || !valid) {
        res.status(401).json({ success: false, data: null, error: 'Incorrect password' });
        return;
      }
    }

    await userModel.deleteUser(userId);
    res.clearCookie('token', clearCookieOptions());
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to delete account' });
  }
});

export default router;
