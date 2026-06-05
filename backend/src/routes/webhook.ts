/**
 * Webhook router — mounted BEFORE express.json() so the raw body is available
 * for Paystack signature verification.
 *
 * POST /webhook/paystack   — receives Paystack payment events
 */
import { Router, Request, Response } from 'express';
import { pool } from '../db';
import * as walletModel from '../models/wallet.model';
import * as userModel from '../models/user';
import * as paystackService from '../services/paystack.service';
import { sendWalletFundedEmail } from '../services/email.service';

const router = Router();

// ── POST /webhook/paystack ────────────────────────────────────────────────────

router.post('/paystack', async (req: Request, res: Response) => {
  // 1. Validate Paystack signature — reject anything we didn't sign
  const signature = req.headers['x-paystack-signature'] as string | undefined;
  const rawBody   = req.body as Buffer; // express.raw() gives us a Buffer

  if (!signature || !paystackService.validateWebhookSignature(rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // 2. Parse the event
  let event: { event: string; data: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  // Always acknowledge quickly — Paystack retries if we don't respond in time
  res.status(200).json({ received: true });

  // 3. Handle the event asynchronously
  if (event.event === 'charge.success') {
    await handleChargeSuccess(event.data).catch(err => {
      console.error('[webhook/paystack] charge.success handler error:', err);
    });
  }
  // Other events (transfer.success, refund.processed, etc.) can be added here
});

// ── Event handler ─────────────────────────────────────────────────────────────

async function handleChargeSuccess(data: Record<string, unknown>) {
  const reference = data.reference as string | undefined;
  if (!reference) {
    console.warn('[webhook/paystack] charge.success missing reference');
    return;
  }

  // Look up the pending session
  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    amount_ngn_kobo: string;
    destination: string;
    status: string;
  }>(
    `SELECT id, user_id, amount_ngn_kobo, destination, status
     FROM wallet_topup_sessions
     WHERE paystack_reference = $1`,
    [reference]
  );

  const session = rows[0];
  if (!session) {
    console.warn(`[webhook/paystack] No session found for reference ${reference}`);
    return;
  }

  if (session.status !== 'pending') {
    // Already processed — idempotent, nothing to do
    return;
  }

  await creditWalletAndCompleteSession({
    sessionId:      session.id,
    userId:         session.user_id,
    amountNgnKobo:  Number(session.amount_ngn_kobo),
    destination:    session.destination as 'ngn' | 'usd',
    reference,
    source:         'paystack_webhook',
  });
}

// ── Shared crediting logic ────────────────────────────────────────────────────

export async function creditWalletAndCompleteSession(params: {
  sessionId:     string;
  userId:        string;
  amountNgnKobo: number;
  destination:   'ngn' | 'usd';
  reference:     string;
  source:        'paystack_webhook' | 'paystack_verify';
}): Promise<void> {
  const { sessionId, userId, amountNgnKobo, destination, reference, source } = params;

  // Use a transaction to mark session complete + credit wallet atomically
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the session row to prevent race between webhook + verify
    const { rows } = await client.query<{ status: string }>(
      `SELECT status FROM wallet_topup_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );

    if (rows[0]?.status !== 'pending') {
      // Another handler got here first — safe to abort
      await client.query('ROLLBACK');
      return;
    }

    // Mark session as completed
    await client.query(
      `UPDATE wallet_topup_sessions
       SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Credit the wallet outside the DB transaction (wallet model uses its own queries)
  const desc = `Paystack top-up — ref: ${reference} (${source})`;

  if (destination === 'ngn') {
    await walletModel.topUpNgn(userId, amountNgnKobo, desc, 'deposit');
  } else {
    // Convert NGN → USD at the stored mock rate (₦1,600 per $1 for now)
    // In production: use a live FX rate from the fx_rates table
    const RATE_NGN_PER_USD = Number(process.env.MOCK_NGN_USD_RATE ?? 1600);
    const usdCents = Math.round((amountNgnKobo / 100 / RATE_NGN_PER_USD) * 100);

    await walletModel.topUpNgn(userId, amountNgnKobo, `${desc} — NGN deposited`, 'deposit');
    await walletModel.topUpNgn(userId, -amountNgnKobo, `Converted ₦${(amountNgnKobo / 100).toLocaleString()} → USD`, 'conversion');
    await walletModel.topUpUsd(userId, usdCents, `USD credited from ₦ conversion (rate ₦${RATE_NGN_PER_USD}/$)`, 'conversion');
  }

  console.log(`[paystack] Wallet credited — user ${userId}, ₦${amountNgnKobo / 100}, dest:${destination}, ref:${reference}`);

  // Fire confirmation email asynchronously
  userModel.findById(userId).then(user => {
    if (!user) return;
    const RATE = Number(process.env.MOCK_NGN_USD_RATE ?? 1600);
    sendWalletFundedEmail({
      to:          user.email,
      name:        user.name ?? user.email.split('@')[0],
      amountNgn:   amountNgnKobo / 100,
      destination,
      usdCredited: destination === 'usd'
        ? Math.round((amountNgnKobo / 100 / RATE) * 100) / 100
        : undefined,
      reference,
    }).catch(err => console.error('[paystack] Wallet funded email failed:', err));
  }).catch(() => {});
}

export default router;
