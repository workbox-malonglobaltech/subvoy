import { pool } from '../db';
import * as notifModel from '../models/notification';
import * as subModel from '../models/subscription';
import { sendReminderEmail, sendBudgetAlertEmail } from './email.service';
import { runComplianceReminderScan } from './compliance-reminder.service';

interface DueSubscription {
  sub_id: string;
  sub_name: string;
  amount: string;
  currency: string;
  next_billing_date: Date;
  user_id: string;
  user_email: string;
  user_name: string | null;
  email_enabled: boolean;
  days_before: number;
}

// Hour-of-day (0–23) at which reminders are delivered in each user's local time.
const SEND_HOUR = 8;

export async function runReminderScan(): Promise<void> {
  console.log('[Reminder] Running scan at', new Date().toISOString());
  const defaultTz = process.env.REMINDER_TIMEZONE ?? 'UTC';

  // Only users for whom it is currently the local send-hour — so the hourly job
  // delivers at ~08:00 in each user's own timezone (users.timezone), not one global time.
  const { rows } = await pool.query<DueSubscription>(`
    SELECT
      s.id           AS sub_id,
      s.name         AS sub_name,
      s.amount,
      s.currency,
      s.next_billing_date,
      u.id           AS user_id,
      u.email        AS user_email,
      u.name         AS user_name,
      COALESCE(np.email_enabled, TRUE)  AS email_enabled,
      COALESCE(np.days_before, 3)       AS days_before
    FROM obligations s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN notification_preferences np ON np.user_id = s.user_id
    WHERE s.is_active = TRUE
      AND s.next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (COALESCE(np.days_before, 3) * INTERVAL '1 day')
      AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE COALESCE(NULLIF(u.timezone, ''), $1))) = $2
  `, [defaultTz, SEND_HOUR]);

  let sent = 0;
  for (const row of rows) {
    const alreadySent = await notifModel.alreadyNotifiedToday(row.user_id, row.sub_id);
    if (alreadySent) continue;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(row.next_billing_date); due.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    const dueDateStr = due.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const amount = parseFloat(row.amount);
    const userName = row.user_name ?? row.user_email.split('@')[0];

    // Create in-app notification
    await notifModel.create({
      userId: row.user_id,
      subscriptionId: row.sub_id,
      title: `${row.sub_name} renews ${daysUntil === 0 ? 'today' : `in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}`}`,
      message: `Your ${row.sub_name} subscription (${new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(amount)}) is due on ${dueDateStr}.`,
    });

    // Send email if enabled (email.service handles missing RESEND_API_KEY gracefully)
    if (row.email_enabled) {
      try {
        await sendReminderEmail({
          toEmail: row.user_email,
          userName,
          subName: row.sub_name,
          amount,
          currency: row.currency,
          dueDate: dueDateStr,
          daysUntil,
        });
        console.log(`[Reminder] Email sent to ${row.user_email} for ${row.sub_name}`);
      } catch (err) {
        console.error(`[Reminder] Email failed for ${row.user_email}:`, err);
      }
    }

    sent++;
  }

  console.log(`[Reminder] Scan complete — ${sent} reminder(s) sent`);

  // ── Budget alerts ──────────────────────────────────────────────────────────
  // Find users who have budget alerts enabled and whose monthly spend exceeds limit.
  // Only alert once per calendar month (check notification table for existing budget alert).
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  interface BudgetRow {
    user_id: string;
    user_email: string;
    user_name: string | null;
    currency: string;
    monthly_spend: string;
    budget_limits: Record<string, number> | null;
  }

  // Per-currency monthly spend for users with budget alerts on and at least one
  // currency budget set. Currencies are summed natively (never converted).
  const { rows: budgetRows } = await pool.query<BudgetRow>(`
    SELECT
      u.id    AS user_id,
      u.email AS user_email,
      u.name  AS user_name,
      s.currency,
      SUM(
        CASE s.billing_cycle
          WHEN 'yearly'  THEN s.amount / 12
          WHEN 'weekly'  THEN s.amount * 52 / 12
          ELSE s.amount
        END
      ) AS monthly_spend,
      np.budget_limits
    FROM notification_preferences np
    JOIN users u ON u.id = np.user_id
    JOIN obligations s ON s.user_id = np.user_id AND s.is_active = TRUE
    WHERE np.budget_alert_enabled = TRUE
      AND np.budget_limits <> '{}'::jsonb
    GROUP BY u.id, u.email, u.name, s.currency, np.budget_limits
  `);

  // Collect, per user, every currency whose native spend exceeds its own budget.
  interface Exceeded { currency: string; spend: number; limit: number; }
  const overByUser = new Map<string, { email: string; name: string | null; exceeded: Exceeded[] }>();
  for (const row of budgetRows) {
    const limits = row.budget_limits ?? {};
    const limit = limits[row.currency];
    if (!limit) continue;
    const spend = parseFloat(row.monthly_spend);
    if (spend <= limit) continue;
    const entry = overByUser.get(row.user_id)
      ?? { email: row.user_email, name: row.user_name, exceeded: [] };
    entry.exceeded.push({ currency: row.currency, spend, limit });
    overByUser.set(row.user_id, entry);
  }

  const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  for (const [userId, info] of overByUser) {
    // Only once per calendar month per user (across all currencies).
    const { rows: existing } = await pool.query(
      `SELECT id FROM notifications
       WHERE user_id = $1 AND type = 'budget_alert'
         AND created_at >= date_trunc('month', NOW())`,
      [userId]
    );
    if (existing.length > 0) continue;

    const userName = info.name ?? info.email.split('@')[0];
    const summary = info.exceeded.map(e => `${fmt(e.spend, e.currency)} of ${fmt(e.limit, e.currency)}`).join('; ');

    await notifModel.create({
      userId,
      title: 'Monthly budget exceeded',
      message: `Your spend has exceeded your budget: ${summary}.`,
      type: 'budget_alert',
    });

    // One email per over-budget currency (the template is single-currency).
    for (const e of info.exceeded) {
      try {
        await sendBudgetAlertEmail({
          toEmail: info.email, userName,
          monthlySpend: e.spend, budgetLimit: e.limit, currency: e.currency, month,
        });
      } catch (err) {
        console.error(`[Reminder] Budget alert email failed for ${info.email}:`, err);
      }
    }
    console.log(`[Reminder] Budget alert sent to ${info.email} (${info.exceeded.length} currency/ies)`);
  }

  // ── Price change detection ─────────────────────────────────────────────────
  // Find all active subscriptions where amount differs from last_known_amount.
  // Round to 2dp to avoid floating-point false positives.

  interface PriceChangeRow {
    sub_id: string;
    sub_name: string;
    currency: string;
    current_amount: string;
    last_known_amount: string;
    user_id: string;
  }

  const { rows: priceRows } = await pool.query<PriceChangeRow>(`
    SELECT
      s.id          AS sub_id,
      s.name        AS sub_name,
      s.currency,
      s.amount      AS current_amount,
      s.last_known_amount,
      s.user_id
    FROM obligations s
    WHERE s.is_active = TRUE
      AND s.last_known_amount IS NOT NULL
      AND ROUND(s.amount::numeric, 2) <> ROUND(s.last_known_amount::numeric, 2)
  `);

  for (const row of priceRows) {
    // Deduplicate — skip if we already alerted today
    const alerted = await notifModel.alreadyPriceAlertedToday(row.user_id, row.sub_id);
    if (alerted) continue;

    const oldAmount  = parseFloat(row.last_known_amount);
    const newAmount  = parseFloat(row.current_amount);
    const currency   = row.currency;
    const fmt        = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
    const direction  = newAmount > oldAmount ? 'increased' : 'decreased';

    await notifModel.create({
      userId: row.user_id,
      subscriptionId: row.sub_id,
      type: 'price_change',
      title: `${row.sub_name} price ${direction}`,
      message: `${row.sub_name} changed from ${fmt(oldAmount)} to ${fmt(newAmount)}/mo.`,
    });

    // Update stored amount so alert doesn't repeat
    await subModel.updateLastKnownAmount(row.sub_id, newAmount);

    console.log(`[Reminder] Price change alert: ${row.sub_name} ${fmt(oldAmount)} → ${fmt(newAmount)}`);
  }

  console.log(`[Reminder] Price change scan complete — ${priceRows.length} change(s) detected`);

  // ── Compliance reminders ─────────────────────────────────────────────────────
  // Isolated so a compliance-scan failure never aborts the subscription reminders.
  try {
    await runComplianceReminderScan();
  } catch (err) {
    console.error('[Reminder] Compliance reminder scan failed:', err);
  }
}
