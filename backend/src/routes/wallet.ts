import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import * as walletModel from '../models/wallet.model';
import * as paystackService from '../services/paystack.service';
import * as userModel from '../models/user';
import { creditWalletAndCompleteSession } from './webhook';
import { pool } from '../db';

const router = Router();

// All wallet endpoints require authentication
router.use(authenticate);

// ── Validation schemas ────────────────────────────────────────────────────────

const initiateTopUpSchema = z.object({
  /** Amount in whole naira (e.g. 5000 = ₦5,000) */
  amountNgn: z.number().positive().max(10_000_000),
  /** 'ngn' credits NGN balance; 'usd' converts and credits USD balance */
  destination: z.enum(['ngn', 'usd']),
});

const topUpSchema = z.object({
  /** Amount in whole naira (e.g. 5000 = ₦5,000) */
  amountNgn: z.number().positive().max(10_000_000),
  /** 'ngn' adds to NGN balance; 'usd' converts and credits USD balance */
  destination: z.enum(['ngn', 'usd']),
  fundingSource: z.string().min(1).max(100),
});

const settingsSchema = z.object({
  autoTopupEnabled: z.boolean().optional(),
  /** Threshold in whole dollars */
  thresholdUsd: z.number().positive().max(100_000).optional(),
  /** Amount in whole naira to pull per auto top-up */
  topupNgn: z.number().positive().max(10_000_000).optional(),
  /** Day 1-28 for scheduled monthly top-up, or null to disable */
  scheduledDay: z.number().int().min(1).max(28).nullable().optional(),
  /** Default state of the autopay toggle for newly created subscriptions */
  autopayDefault: z.boolean().optional(),
});

// ── GET /wallet ───────────────────────────────────────────────────────────────

/**
 * Returns the current user's wallet balances.
 * Creates the wallet row if this is the user's first access.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const wallet = await walletModel.findOrCreate(userId);
    res.status(200).json({ success: true, data: wallet, error: null });
  } catch (err) {
    console.error('GET /wallet error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch wallet' });
  }
});

// ── GET /wallet/transactions ──────────────────────────────────────────────────

/**
 * Returns the most recent wallet transactions (default: last 20).
 * Accepts ?limit=N (max 100).
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const transactions = await walletModel.getTransactions(userId, limit);
    res.status(200).json({ success: true, data: transactions, error: null });
  } catch (err) {
    console.error('GET /wallet/transactions error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch transactions' });
  }
});

// ── POST /wallet/topup ────────────────────────────────────────────────────────

/**
 * Mock top-up: simulates funding the NGN balance from a linked bank account.
 * If destination='usd', uses a hardcoded mock FX rate to credit USD balance.
 *
 * In production this would initiate a Paystack charge; for now it directly
 * updates the balance so users can explore the wallet UI without real money.
 */
router.post('/topup', validate(topUpSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amountNgn, destination, fundingSource } = req.body as z.infer<typeof topUpSchema>;

    // Ensure wallet row exists before operating
    await walletModel.findOrCreate(userId);

    const koboAmount = Math.round(amountNgn * 100);

    let wallet;

    if (destination === 'ngn') {
      wallet = await walletModel.topUpNgn(
        userId,
        koboAmount,
        `Funded from ${fundingSource}`,
        'deposit'
      );
    } else {
      // destination === 'usd'
      // Mock FX conversion: use a placeholder rate of ₦1,600 per $1
      // Real implementation would call fx.service.convertAmount() with live rate
      const MOCK_RATE_NGN_PER_USD = 1600;
      const usdCents = Math.round((amountNgn / MOCK_RATE_NGN_PER_USD) * 100);

      // First credit the NGN balance (funds arrive in NGN)
      await walletModel.topUpNgn(
        userId,
        koboAmount,
        `Funded from ${fundingSource} (converted to USD)`,
        'deposit'
      );

      // Then debit NGN and credit USD (conversion)
      await walletModel.topUpNgn(
        userId,
        -koboAmount,
        `Converted ₦${amountNgn.toLocaleString()} to USD`,
        'conversion'
      );

      wallet = await walletModel.topUpUsd(
        userId,
        usdCents,
        `Converted from ₦${amountNgn.toLocaleString()} (rate ₦${MOCK_RATE_NGN_PER_USD}/$)`,
        'conversion'
      );
    }

    res.status(200).json({ success: true, data: wallet, error: null });
  } catch (err) {
    console.error('POST /wallet/topup error:', err);
    res.status(500).json({ success: false, data: null, error: 'Top-up failed' });
  }
});

// ── POST /wallet/topup/initiate ───────────────────────────────────────────────

/**
 * Starts a real Paystack payment session for funding the wallet.
 * Returns { authorizationUrl } — the frontend redirects the user there.
 *
 * Requires PAYSTACK_SECRET_KEY to be set. Returns 503 if Paystack is not configured.
 */
router.post('/topup/initiate', validate(initiateTopUpSchema), async (req: Request, res: Response) => {
  if (!paystackService.isPaystackEnabled()) {
    return res.status(503).json({
      success: false,
      data: null,
      error: 'Paystack is not configured on this server. Use the mock /wallet/topup endpoint in development.',
    });
  }

  try {
    const userId = req.user!.id;
    const { amountNgn, destination } = req.body as z.infer<typeof initiateTopUpSchema>;

    // Fetch the user's email — Paystack uses it for receipts
    const dbUser = await userModel.findById(userId);
    if (!dbUser) {
      return res.status(401).json({ success: false, data: null, error: 'User not found' });
    }

    // Ensure wallet row exists
    await walletModel.findOrCreate(userId);

    const reference    = crypto.randomUUID();
    const amountKobo   = Math.round(amountNgn * 100);
    const callbackUrl  = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/payment/callback`;

    // Create the pending session before calling Paystack (idempotency)
    await pool.query(
      `INSERT INTO wallet_topup_sessions
         (user_id, paystack_reference, amount_ngn_kobo, destination, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, reference, amountKobo, destination]
    );

    const result = await paystackService.initializeTransaction({
      email:       dbUser.email,
      amountKobo,
      reference,
      callbackUrl,
      metadata: {
        userId,
        amountNgn,
        destination,
        subvoySource: 'wallet_topup',
      },
    });

    return res.status(200).json({
      success: true,
      data: { authorizationUrl: result.authorizationUrl, reference },
      error: null,
    });
  } catch (err) {
    console.error('POST /wallet/topup/initiate error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to initiate payment' });
  }
});

// ── GET /wallet/topup/verify/:reference ──────────────────────────────────────

/**
 * Verifies a Paystack payment after the user returns from the checkout page.
 * This is the callback-URL handler — it verifies with Paystack and credits the
 * wallet if not already done by the webhook.
 *
 * Safe to call multiple times — uses row-level locking to prevent double-credit.
 */
router.get('/topup/verify/:reference', async (req: Request, res: Response) => {
  if (!paystackService.isPaystackEnabled()) {
    return res.status(503).json({ success: false, data: null, error: 'Paystack not configured' });
  }

  try {
    const userId    = req.user!.id;
    const { reference } = req.params;

    // Look up the session (must belong to this user)
    const { rows } = await pool.query<{
      id: string;
      user_id: string;
      amount_ngn_kobo: string;
      destination: string;
      status: string;
    }>(
      `SELECT id, user_id, amount_ngn_kobo, destination, status
       FROM wallet_topup_sessions
       WHERE paystack_reference = $1 AND user_id = $2`,
      [reference, userId]
    );

    const session = rows[0];
    if (!session) {
      return res.status(404).json({ success: false, data: null, error: 'Payment session not found' });
    }

    if (session.status === 'completed') {
      const wallet = await walletModel.findOrCreate(userId);
      return res.status(200).json({
        success: true,
        data: { wallet, alreadyCredited: true },
        error: null,
      });
    }

    // Verify with Paystack
    const verification = await paystackService.verifyTransaction(reference);

    if (verification.status !== 'success') {
      // Mark the session as failed
      await pool.query(
        `UPDATE wallet_topup_sessions SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [session.id]
      );
      return res.status(402).json({
        success: false,
        data: { paystackStatus: verification.status },
        error: `Payment ${verification.status} — no funds credited`,
      });
    }

    // Credit the wallet (webhook may have beaten us — creditWalletAndCompleteSession is idempotent)
    await creditWalletAndCompleteSession({
      sessionId:     session.id,
      userId:        session.user_id,
      amountNgnKobo: Number(session.amount_ngn_kobo),
      destination:   session.destination as 'ngn' | 'usd',
      reference,
      source:        'paystack_verify',
    });

    const wallet = await walletModel.findOrCreate(userId);
    return res.status(200).json({
      success: true,
      data: { wallet, alreadyCredited: false },
      error: null,
    });
  } catch (err) {
    console.error('GET /wallet/topup/verify error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Verification failed' });
  }
});

// ── GET /wallet/settings ──────────────────────────────────────────────────────

/**
 * Returns auto top-up settings for the current user.
 * Creates the settings row with sensible defaults if it doesn't exist.
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const settings = await walletModel.getSettings(userId);
    res.status(200).json({ success: true, data: settings, error: null });
  } catch (err) {
    console.error('GET /wallet/settings error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch wallet settings' });
  }
});

// ── PUT /wallet/settings ──────────────────────────────────────────────────────

/**
 * Updates auto top-up settings. Accepts any subset of fields.
 */
router.put('/settings', validate(settingsSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const updates = req.body as z.infer<typeof settingsSchema>;
    const settings = await walletModel.updateSettings(userId, updates);
    res.status(200).json({ success: true, data: settings, error: null });
  } catch (err) {
    console.error('PUT /wallet/settings error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update wallet settings' });
  }
});

export default router;
