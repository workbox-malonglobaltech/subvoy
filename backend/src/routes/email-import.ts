import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate';
import * as connModel from '../models/email-connection';
import { getGoogleAuthUrl, exchangeGoogleCode, fetchGmailReceipts } from '../services/gmail.service';
import { getOutlookAuthUrl, exchangeOutlookCode, fetchOutlookReceipts } from '../services/outlook.service';
import { fetchImapReceipts } from '../services/imap.service';
import { parseReceiptEmails } from '../services/email-parser.service';
import { detectRecurring } from '../services/detection.service';
import * as detectedModel from '../models/detected-subscription';
import * as workspaceModel from '../models/workspace.model';

const router = Router();

// Public callbacks (must be accessible without session cookie for OAuth redirect)
// They redirect back to the frontend with an error param on failure.
const FRONTEND_EMAIL_IMPORT = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/email-import`;

// ─── Status ──────────────────────────────────────────────────────────────────

router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const connections = await connModel.listConnections(req.user!.id);
    res.status(200).json({ success: true, data: { connections }, error: null });
  } catch (err) {
    console.error('Email status error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch connection status' });
  }
});

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get('/connect/google', authenticate, (req: Request, res: Response) => {
  try {
    // Encode userId in state so we know who to store the token for in the callback
    const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64url');
    const url   = getGoogleAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error('Google auth URL error:', err);
    res.redirect(`${FRONTEND_EMAIL_IMPORT}?error=google_config`);
  }
});

router.get('/callback/google', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_EMAIL_IMPORT}?error=google_denied`);
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const tokens = await exchangeGoogleCode(code);

    await connModel.upsertConnection(userId, 'gmail', {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry:  tokens.tokenExpiry,
      email:        tokens.email,
    });

    res.redirect(`${FRONTEND_EMAIL_IMPORT}?connected=gmail`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${FRONTEND_EMAIL_IMPORT}?error=google_exchange`);
  }
});

// ─── Microsoft OAuth ──────────────────────────────────────────────────────────

router.get('/connect/microsoft', authenticate, (req: Request, res: Response) => {
  try {
    const state = Buffer.from(JSON.stringify({ userId: req.user!.id })).toString('base64url');
    const url   = getOutlookAuthUrl(state);
    res.redirect(url);
  } catch (err) {
    console.error('Microsoft auth URL error:', err);
    res.redirect(`${FRONTEND_EMAIL_IMPORT}?error=microsoft_config`);
  }
});

router.get('/callback/microsoft', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    return res.redirect(`${FRONTEND_EMAIL_IMPORT}?error=microsoft_denied`);
  }

  try {
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString());
    const tokens = await exchangeOutlookCode(code);

    await connModel.upsertConnection(userId, 'outlook', {
      accessToken:  tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiry:  tokens.tokenExpiry,
      email:        tokens.email,
    });

    res.redirect(`${FRONTEND_EMAIL_IMPORT}?connected=outlook`);
  } catch (err) {
    console.error('Microsoft callback error:', err);
    res.redirect(`${FRONTEND_EMAIL_IMPORT}?error=microsoft_exchange`);
  }
});

// ─── Scan ─────────────────────────────────────────────────────────────────────

router.post('/scan', authenticate, async (req: Request, res: Response) => {
  try {
    const userId      = req.user!.id;
    const connections = await connModel.listConnections(userId);

    if (connections.length === 0) {
      res.status(400).json({ success: false, data: null, error: 'No email providers connected' });
      return;
    }

    // Fetch emails from all connected providers
    let allEmails: Awaited<ReturnType<typeof fetchGmailReceipts>> = [];

    for (const conn of connections) {
      const full = await connModel.getConnection(userId, conn.provider);
      if (!full) continue;

      try {
        if (conn.provider === 'gmail') {
          const emails = await fetchGmailReceipts(
            userId, full.accessToken, full.refreshToken, full.tokenExpiry
          );
          allEmails = allEmails.concat(emails);
        } else if (conn.provider === 'outlook') {
          const emails = await fetchOutlookReceipts(
            userId, full.accessToken, full.refreshToken, full.tokenExpiry
          );
          allEmails = allEmails.concat(emails);
        }
      } catch (err) {
        console.error(`Error fetching from ${conn.provider}:`, err);
        // Continue with other providers
      }
    }

    if (allEmails.length === 0) {
      res.status(200).json({
        success: true,
        data: { detected: [], emailCount: 0, message: 'No subscription emails found in the last 6 months' },
        error: null,
      });
      return;
    }

    // Parse emails → transactions → detect recurring
    const transactions = parseReceiptEmails(allEmails);
    const detected     = detectRecurring(transactions);

    if (detected.length === 0) {
      res.status(200).json({
        success: true,
        data: { detected: [], emailCount: allEmails.length, message: 'No recurring patterns detected' },
        error: null,
      });
      return;
    }

    // Save to detected_subscriptions (same table as CSV import). Email scans run
    // without an active-workspace header, so they land in the user's Personal workspace.
    const ws = await workspaceModel.ensurePersonalWorkspace(userId);
    const saved = await detectedModel.createMany(ws.id, userId, detected);

    res.status(200).json({
      success: true,
      data: { detected: saved, emailCount: allEmails.length },
      error: null,
    });
  } catch (err) {
    console.error('Email scan error:', err);
    res.status(500).json({ success: false, data: null, error: 'Email scan failed' });
  }
});

// ─── IMAP scan (no OAuth — user provides credentials directly) ────────────────

const imapScanSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/imap/scan', authenticate, async (req: Request, res: Response) => {
  const parsed = imapScanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: 'Email and password are required' });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const emails = await fetchImapReceipts(email, password);

    if (emails.length === 0) {
      res.status(200).json({
        success: true,
        data: { detected: [], emailCount: 0, message: 'No subscription emails found in the last 6 months' },
        error: null,
      });
      return;
    }

    const transactions = parseReceiptEmails(emails);
    const detected     = detectRecurring(transactions);

    if (detected.length === 0) {
      res.status(200).json({
        success: true,
        data: { detected: [], emailCount: emails.length, message: 'No recurring patterns detected' },
        error: null,
      });
      return;
    }

    const ws = await workspaceModel.ensurePersonalWorkspace(req.user!.id);
    const saved = await detectedModel.createMany(ws.id, req.user!.id, detected);
    res.status(200).json({
      success: true,
      data: { detected: saved, emailCount: emails.length },
      error: null,
    });
  } catch (err: any) {
    console.error('IMAP scan error:', err);

    // Surface auth failures with actionable message
    const msg: string = err?.message ?? '';
    const isAuthError = /auth|credentials|login|password|535|AUTHENTICATIONFAILED/i.test(msg);
    if (isAuthError) {
      res.status(401).json({
        success: false,
        data: null,
        error: 'Authentication failed. For Gmail or Yahoo, please use an App Password instead of your account password.',
      });
      return;
    }

    res.status(500).json({ success: false, data: null, error: 'Could not connect to email server. Check your email address and password.' });
  }
});

// ─── Disconnect ───────────────────────────────────────────────────────────────

router.delete('/disconnect/:provider', authenticate, async (req: Request, res: Response) => {
  const provider = req.params.provider as connModel.Provider;
  if (!['gmail', 'outlook'].includes(provider)) {
    res.status(400).json({ success: false, data: null, error: 'Invalid provider' });
    return;
  }

  try {
    const deleted = await connModel.deleteConnection(req.user!.id, provider);
    if (!deleted) {
      res.status(404).json({ success: false, data: null, error: 'Connection not found' });
      return;
    }
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Disconnect error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to disconnect' });
  }
});

export default router;
