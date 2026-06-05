import { pool } from '../db';
import * as notifModel from '../models/notification';
import * as subModel from '../models/subscription';
import { sendReminderEmail, sendBudgetAlertEmail } from './email.service';

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

export async function runReminderScan(): Promise<void> {
  console.log('[Reminder] Running scan at', new Date().toISOString());

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
    FROM subscriptions s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN notification_preferences np ON np.user_id = s.user_id
    WHERE s.is_active = TRUE
      AND s.next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + (COALESCE(np.days_before, 3) * INTERVAL '1 day')
  `);

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
    monthly_spend: string;
    budget_limit: string;
  }

  const { rows: budgetRows } = await pool.query<BudgetRow>(`
    SELECT
      u.id           AS user_id,
      u.email        AS user_email,
      u.name         AS user_name,
      SUM(
        CASE s.billing_cycle
          WHEN 'yearly'  THEN s.amount / 12
          WHEN 'weekly'  THEN s.amount * 52 / 12
          ELSE s.amount
        END
      )              AS monthly_spend,
      np.budget_limit
    FROM notification_preferences np
    JOIN users u ON u.id = np.user_id
    JOIN subscriptions s ON s.user_id = np.user_id AND s.is_active = TRUE
    WHERE np.budget_alert_enabled = TRUE
      AND np.budget_limit IS NOT NULL
    GROUP BY u.id, u.email, u.name, np.budget_limit
    HAVING SUM(
      CASE s.billing_cycle
        WHEN 'yearly'  THEN s.amount / 12
        WHEN 'weekly'  THEN s.amount * 52 / 12
        ELSE s.amount
      END
    ) > np.budget_limit
  `);

  for (const row of budgetRows) {
    // Only send once per month — check for an existing budget_alert notification this month
    const { rows: existing } = await pool.query(
      `SELECT id FROM notifications
       WHERE user_id = $1
         AND type = 'budget_alert'
         AND created_at >= date_trunc('month', NOW())`,
      [row.user_id]
    );
    if (existing.length > 0) continue;

    const monthlySpend = parseFloat(row.monthly_spend);
    const budgetLimit  = parseFloat(row.budget_limit);
    const userName     = row.user_name ?? row.user_email.split('@')[0];

    // In-app notification
    await notifModel.create({
      userId: row.user_id,
      title: `Budget exceeded — ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monthlySpend)} spent this month`,
      message: `Your monthly subscription spend of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monthlySpend)} has exceeded your budget of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(budgetLimit)}.`,
      type: 'budget_alert',
    });

    // Email
    try {
      await sendBudgetAlertEmail({
        toEmail: row.user_email,
        userName,
        monthlySpend,
        budgetLimit,
        currency: 'USD',
        month,
      });
      console.log(`[Reminder] Budget alert sent to ${row.user_email}`);
    } catch (err) {
      console.error(`[Reminder] Budget alert email failed for ${row.user_email}:`, err);
    }
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
    FROM subscriptions s
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
}
