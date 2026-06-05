/**
 * Autopay scan.
 *
 * Finds every active, autopay-enabled subscription whose billing date has
 * arrived and charges it from the wallet via the shared payment service.
 *
 * The payment service is transactional and idempotent per billing period, so
 * this scan is safe to run repeatedly: a subscription already charged today is
 * rejected as 'not_due' and skipped.
 *
 * On insufficient balance the charge is left for the next run (the billing date
 * is NOT advanced), and the user is notified at most once per day. If the user
 * has auto top-up enabled, the hourly top-up job will replenish the balance and
 * the next autopay run will complete the charge.
 */

import { pool } from '../db';
import * as notifModel from '../models/notification';
import { chargeSubscription, type ChargeResult } from './payment.service';

export interface AutopayScanSummary {
  due: number;
  charged: number;
  insufficient: number;
  skipped: number;
}

interface DueRow {
  id: string;
  user_id: string;
  name: string;
}

async function notifyInsufficient(
  userId: string,
  subId: string,
  name: string,
  result: Extract<ChargeResult, { code: 'insufficient' }>
): Promise<void> {
  // Avoid spamming: at most one notification per subscription per day.
  if (await notifModel.alreadyNotifiedToday(userId, subId)) return;

  const { rows } = await pool.query<{ auto_topup_enabled: boolean }>(
    `SELECT auto_topup_enabled FROM wallet_settings WHERE user_id = $1`,
    [userId]
  );
  const autoTopupOn = rows[0]?.auto_topup_enabled ?? false;
  const tail = autoTopupOn
    ? ' We’ll retry automatically once your wallet is topped up.'
    : ' Top up your wallet to complete the payment.';

  await notifModel.create({
    userId,
    subscriptionId: subId,
    type: 'budget_alert',
    title: `Autopay failed for ${name}`,
    message: `Couldn’t auto-pay ${name}: need ${result.needed}, have ${result.have}.${tail}`,
  });
}

export async function runAutopayScan(): Promise<AutopayScanSummary> {
  console.log('[Autopay] Scan started at', new Date().toISOString());

  const { rows } = await pool.query<DueRow>(
    `SELECT id, user_id, name
     FROM subscriptions
     WHERE autopay = TRUE
       AND is_active = TRUE
       AND next_billing_date <= CURRENT_DATE
     ORDER BY next_billing_date ASC`
  );

  const summary: AutopayScanSummary = { due: rows.length, charged: 0, insufficient: 0, skipped: 0 };

  for (const row of rows) {
    try {
      const result = await chargeSubscription(row.user_id, row.id, { source: 'autopay' });
      switch (result.code) {
        case 'paid':
          summary.charged++;
          break;
        case 'insufficient':
          summary.insufficient++;
          await notifyInsufficient(row.user_id, row.id, row.name, result);
          break;
        default:
          // not_due (already charged this period), paused, exceeds_limit, not_found
          summary.skipped++;
      }
    } catch (err) {
      summary.skipped++;
      console.error(`[Autopay] Charge failed for subscription ${row.id}:`, err);
    }
  }

  console.log(
    `[Autopay] Scan complete — ${summary.due} due, ${summary.charged} charged, ` +
    `${summary.insufficient} insufficient, ${summary.skipped} skipped`
  );
  return summary;
}
