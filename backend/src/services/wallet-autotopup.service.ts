/**
 * Auto top-up service.
 *
 * Two triggers per user, both checked on every hourly scan:
 *
 * 1. THRESHOLD  — USD balance dropped below threshold_usd_cents.
 *                 Fires at most once per 12 hours (prevents rapid re-triggering
 *                 if the balance is still low after the top-up settles).
 *
 * 2. SCHEDULED  — Today's day-of-month matches scheduled_day.
 *                 Fires at most once per calendar month.
 *
 * Both triggers perform a mock bank pull: pull topup_ngn_kobo from the "bank",
 * convert to USD at the stored rate (or a fallback of ₦1,600/$), and credit
 * the USD dollar-card balance. An in-app notification is created for each.
 */

import { pool } from '../db';
import * as walletModel from '../models/wallet.model';
import * as notifModel from '../models/notification';

// ── Mock FX rate (same as TopUpModal) ─────────────────────────────────────────

const MOCK_NGN_PER_USD = 1600;

// ── DB row types ──────────────────────────────────────────────────────────────

interface AutoTopUpCandidate {
  user_id: string;
  usd_balance: string;        // BIGINT → string from pg
  ngn_balance: string;
  threshold_usd_cents: number;
  topup_ngn_kobo: string;     // BIGINT → string
  scheduled_day: number | null;
}

// ── Deduplication helpers ─────────────────────────────────────────────────────

/**
 * Returns true if an auto_topup transaction already exists for this user
 * within the last 12 hours (threshold dedup).
 */
async function recentThresholdTopUp(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM wallet_transactions
     WHERE user_id = $1
       AND type = 'auto_topup'
       AND created_at >= NOW() - INTERVAL '12 hours'`,
    [userId]
  );
  return parseInt(rows[0].count, 10) > 0;
}

/**
 * Returns true if a scheduled auto_topup already fired this calendar month
 * for this user (scheduled dedup).
 */
async function scheduledTopUpThisMonth(userId: string): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM wallet_transactions
     WHERE user_id = $1
       AND type = 'auto_topup'
       AND created_at >= date_trunc('month', NOW())`,
    [userId]
  );
  return parseInt(rows[0].count, 10) > 0;
}

// ── Core top-up action ────────────────────────────────────────────────────────

/**
 * Simulates pulling `koboAmount` NGN from the bank and converting to USD cents.
 * Records three transactions: NGN deposit, NGN debit (conversion), USD credit.
 * Creates an in-app notification.
 */
async function performAutoTopUp(
  userId: string,
  koboAmount: number,
  reason: string
): Promise<void> {
  const usdCents = Math.round((koboAmount / 100 / MOCK_NGN_PER_USD) * 100);
  const ngnAmount = koboAmount / 100;

  // 1. Credit NGN (bank pull)
  await walletModel.topUpNgn(
    userId,
    koboAmount,
    `Auto top-up: funded from bank (${reason})`,
    'auto_topup'
  );

  // 2. Debit NGN (conversion out)
  await walletModel.topUpNgn(
    userId,
    -koboAmount,
    `Auto top-up: converted ₦${ngnAmount.toLocaleString()} to USD`,
    'auto_topup'
  );

  // 3. Credit USD
  await walletModel.topUpUsd(
    userId,
    usdCents,
    `Auto top-up: $${(usdCents / 100).toFixed(2)} credited (rate ₦${MOCK_NGN_PER_USD}/$)`,
    'auto_topup'
  );

  // 4. In-app notification
  await notifModel.create({
    userId,
    type: 'auto_topup' as string,
    title: 'Auto top-up completed',
    message: `₦${ngnAmount.toLocaleString()} converted to $${(usdCents / 100).toFixed(2)} and credited to your USD card. (${reason})`,
  });

  console.log(
    `[AutoTopUp] User ${userId}: ₦${ngnAmount.toLocaleString()} → $${(usdCents / 100).toFixed(2)} (${reason})`
  );
}

// ── Main scan ─────────────────────────────────────────────────────────────────

export async function runAutoTopUpScan(): Promise<void> {
  console.log('[AutoTopUp] Scan started at', new Date().toISOString());

  const todayDay = new Date().getDate(); // 1-31

  // Load all users who have auto top-up enabled, joined with their wallet
  const { rows } = await pool.query<AutoTopUpCandidate>(`
    SELECT
      ws.user_id,
      COALESCE(w.usd_balance, 0)  AS usd_balance,
      COALESCE(w.ngn_balance, 0)  AS ngn_balance,
      ws.threshold_usd_cents,
      ws.topup_ngn_kobo,
      ws.scheduled_day
    FROM wallet_settings ws
    LEFT JOIN wallets w ON w.user_id = ws.user_id
    WHERE ws.auto_topup_enabled = TRUE
  `);

  let triggered = 0;

  for (const row of rows) {
    const usdBalance    = parseInt(row.usd_balance, 10);
    const koboAmount    = parseInt(row.topup_ngn_kobo, 10);

    // ── Threshold trigger ───────────────────────────────────────────────────
    if (usdBalance < row.threshold_usd_cents) {
      const alreadyDone = await recentThresholdTopUp(row.user_id);
      if (!alreadyDone) {
        await performAutoTopUp(
          row.user_id,
          koboAmount,
          `balance $${(usdBalance / 100).toFixed(2)} below $${(row.threshold_usd_cents / 100).toFixed(2)} threshold`
        );
        triggered++;
        continue; // skip scheduled check this cycle — avoid double top-up same scan
      }
    }

    // ── Scheduled trigger ───────────────────────────────────────────────────
    if (row.scheduled_day !== null && row.scheduled_day === todayDay) {
      const alreadyDone = await scheduledTopUpThisMonth(row.user_id);
      if (!alreadyDone) {
        await performAutoTopUp(
          row.user_id,
          koboAmount,
          `scheduled on day ${row.scheduled_day} of month`
        );
        triggered++;
      }
    }
  }

  console.log(`[AutoTopUp] Scan complete — ${triggered} top-up(s) triggered`);
}
