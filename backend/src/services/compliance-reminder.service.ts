/**
 * Compliance reminder scan.
 *
 * For each active, not-completed compliance item, fires an in-app reminder when:
 *   - today is exactly one of the item's reminder_offsets days before the due date, OR
 *   - the item is overdue (a daily nudge until it's marked completed).
 *
 * Deduplicated to at most one notification per item per day. v1 notifies the
 * item's creator (user_id); team-wide / assignee reminders are a follow-up.
 */

import { pool } from '../db';
import * as notifModel from '../models/notification';

interface DueComplianceRow {
  item_id: string;
  title: string;
  authority: string | null;
  due_date: Date;
  days_until: number;   // due_date - CURRENT_DATE, negative if overdue
  user_id: string;
}

export async function runComplianceReminderScan(): Promise<number> {
  console.log('[Compliance] Reminder scan at', new Date().toISOString());

  const { rows } = await pool.query<DueComplianceRow>(`
    SELECT
      c.id                          AS item_id,
      c.title,
      c.authority,
      c.due_date,
      (c.due_date - CURRENT_DATE)   AS days_until,
      c.user_id
    FROM compliance_items c
    WHERE c.is_active = TRUE
      AND c.status <> 'completed'
      AND (
        (c.due_date - CURRENT_DATE) = ANY(c.reminder_offsets)
        OR c.due_date < CURRENT_DATE
      )
    ORDER BY c.due_date ASC
  `);

  let sent = 0;
  for (const row of rows) {
    if (await notifModel.alreadyComplianceNotifiedToday(row.user_id, row.item_id)) continue;

    const days = Number(row.days_until);
    const dueStr = new Date(row.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const who = row.authority ? `${row.authority}: ` : '';

    const title = days < 0
      ? `${row.title} is ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue`
      : days === 0
        ? `${row.title} is due today`
        : `${row.title} is due in ${days} day${days !== 1 ? 's' : ''}`;

    const message = days < 0
      ? `${who}${row.title} was due on ${dueStr} and is not yet completed.`
      : `${who}${row.title} is due on ${dueStr}.`;

    await notifModel.create({
      userId: row.user_id,
      complianceItemId: row.item_id,
      type: 'compliance_reminder',
      title,
      message,
    });
    sent++;
  }

  console.log(`[Compliance] Reminder scan complete — ${sent} reminder(s) sent`);
  return sent;
}
