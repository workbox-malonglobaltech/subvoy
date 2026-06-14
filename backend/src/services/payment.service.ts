/**
 * Payment service — charges a subscription from the user's wallet.
 *
 * Shared by the manual "Pay now" route (POST /subscriptions/:id/pay) and the
 * autopay job. The whole charge runs inside a single DB transaction that locks
 * both the subscription and the wallet row (SELECT ... FOR UPDATE), so:
 *
 *   - Two concurrent charges for the same subscription serialise; the second
 *     sees the already-advanced billing date and is rejected as not-due
 *     (autopay) — never double-charged.
 *   - Balance is read as exact integer cents/kobo from the wallet row, not the
 *     display-rounded value, so sufficiency checks are precise.
 *
 * Amounts are stored as integers: USD in cents, NGN in kobo.
 */

import { pool } from '../db';
import * as subModel from '../models/subscription';
import * as walletModel from '../models/wallet.model';
import * as notifModel from '../models/notification';
import type { Subscription, Wallet } from '../../../src/shared/types';

export type ChargeSource = 'manual' | 'autopay';

export type ChargeResult =
  | { code: 'paid'; subscription: Subscription; wallet: Wallet }
  | { code: 'not_found' }
  | { code: 'paused' }
  | { code: 'not_due' }
  | { code: 'exceeds_limit'; limit: number }
  | { code: 'insufficient'; needed: string; have: string };

interface LockedSubRow {
  id: string;
  user_id: string;
  name: string;
  amount: string;
  currency: string;
  is_active: boolean;
  autopay_max_amount: string | null;
  is_due: boolean;
}

function fmt(amount: number, isNgn: boolean): string {
  return isNgn
    ? `₦${amount.toLocaleString()}`
    : `$${amount.toFixed(2)}`;
}

/**
 * Charges a subscription once from the wallet. Idempotent per billing period
 * for autopay (a not-due subscription is rejected rather than charged again).
 *
 * @param opts.source  'manual' ignores the autopay cap and the due-date check
 *                      (the user may pay early); 'autopay' enforces both.
 *
 * Scoping note: the subscription is tenant-scoped by `workspaceId`, but the
 * wallet (and the resulting notification) stay USER-scoped — the wallet owner is
 * derived from the locked subscription row's `user_id`. Wallets are intentionally
 * NOT workspace-scoped in this phase.
 */
export async function chargeSubscription(
  workspaceId: string,
  subId: string,
  opts: { source: ChargeSource } = { source: 'manual' }
): Promise<ChargeResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the subscription row for the duration of the transaction.
    const { rows: subRows } = await client.query<LockedSubRow>(
      `SELECT id, user_id, name, amount, currency, is_active, autopay_max_amount,
              (next_billing_date <= CURRENT_DATE) AS is_due
       FROM obligations
       WHERE id = $1 AND workspace_id = $2
       FOR UPDATE`,
      [subId, workspaceId]
    );
    const sub = subRows[0];
    if (!sub) {
      await client.query('ROLLBACK');
      return { code: 'not_found' };
    }
    if (!sub.is_active) {
      await client.query('ROLLBACK');
      return { code: 'paused' };
    }

    // Wallet owner = the subscription's user (wallet stays user-scoped).
    const userId = sub.user_id;
    const amount = parseFloat(sub.amount);
    const isNgn = sub.currency.toUpperCase() === 'NGN';

    // 2. Autopay-only guards: due-date (idempotency) and spend cap (guardrail).
    if (opts.source === 'autopay') {
      if (!sub.is_due) {
        await client.query('ROLLBACK');
        return { code: 'not_due' };
      }
      if (sub.autopay_max_amount != null && amount > parseFloat(sub.autopay_max_amount)) {
        const limit = parseFloat(sub.autopay_max_amount);
        await client.query('ROLLBACK');
        return { code: 'exceeds_limit', limit };
      }
    }

    // 3. Lock the wallet row and read the exact integer balance.
    await client.query(
      `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const { rows: wRows } = await client.query<{ ngn_balance: string; usd_balance: string }>(
      `SELECT ngn_balance, usd_balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );
    const column = isNgn ? 'ngn_balance' : 'usd_balance';
    const balanceMinor = Number(wRows[0][column]);   // exact cents/kobo
    const deductMinor = Math.round(amount * 100);

    // 4. Sufficiency check.
    if (balanceMinor < deductMinor) {
      await client.query('ROLLBACK');
      return {
        code: 'insufficient',
        needed: fmt(amount, isNgn),
        have: fmt(balanceMinor / 100, isNgn),
      };
    }

    // 5. Deduct from the wallet and log the transaction.
    const { rows: updW } = await client.query<{ ngn_balance: string; usd_balance: string }>(
      `UPDATE wallets SET ${column} = ${column} - $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING ngn_balance, usd_balance`,
      [deductMinor, userId]
    );
    const balanceAfter = Number(updW[0][column]);
    const label = opts.source === 'autopay' ? `Auto-paid: ${sub.name}` : `Paid: ${sub.name}`;
    await client.query(
      `INSERT INTO wallet_transactions
         (user_id, type, currency, amount, direction, description, balance_after)
       VALUES ($1, 'payment', $2, $3, 'out', $4, $5)`,
      [userId, isNgn ? 'NGN' : 'USD', deductMinor, label, balanceAfter]
    );

    // 6. Advance the billing date by one cycle.
    const { rows: advRows } = await client.query<{ next_billing_date: Date }>(
      `UPDATE obligations
       SET next_billing_date =
         CASE billing_cycle
           WHEN 'weekly'  THEN next_billing_date + INTERVAL '7 days'
           WHEN 'monthly' THEN next_billing_date + INTERVAL '1 month'
           WHEN 'yearly'  THEN next_billing_date + INTERVAL '1 year'
           ELSE next_billing_date
         END,
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2
       RETURNING next_billing_date`,
      [subId, workspaceId]
    );
    const nextBillingDate = advRows[0].next_billing_date.toISOString().split('T')[0];

    await client.query('COMMIT');

    // 7. Notify (outside the transaction — non-critical to the charge).
    const symbol = isNgn ? '₦' : '$';
    await notifModel.create({
      userId,
      subscriptionId: subId,
      type: 'payment_reminder',
      title: `${sub.name} ${opts.source === 'autopay' ? 'auto-paid' : 'paid'}`,
      message: `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} deducted from your ${isNgn ? 'NGN' : 'USD'} wallet. Next billing: ${nextBillingDate}.`,
    });

    // Return canonical, freshly-mapped objects for the API response.
    const [subscription, wallet] = await Promise.all([
      subModel.findById(subId, workspaceId) as Promise<Subscription>,
      walletModel.findOrCreate(sub.user_id),
    ]);
    return { code: 'paid', subscription, wallet };
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* connection already broken */ }
    throw err;
  } finally {
    client.release();
  }
}
