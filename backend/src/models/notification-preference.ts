import { pool } from '../db';

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  daysBefore: number;
  budgetAlertEnabled: boolean;
  budgetLimit: number | null;
  updatedAt: string;
}

interface PrefRow {
  id: string;
  user_id: string;
  email_enabled: boolean;
  days_before: number;
  budget_alert_enabled: boolean;
  budget_limit: string | null;
  updated_at: Date;
}

function toPref(row: PrefRow): NotificationPreference {
  return {
    id: row.id,
    userId: row.user_id,
    emailEnabled: row.email_enabled,
    daysBefore: row.days_before,
    budgetAlertEnabled: row.budget_alert_enabled,
    budgetLimit: row.budget_limit !== null ? parseFloat(row.budget_limit) : null,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function getOrCreate(userId: string): Promise<NotificationPreference> {
  const { rows } = await pool.query<PrefRow>(
    `INSERT INTO notification_preferences (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [userId]
  );
  return toPref(rows[0]);
}

export async function update(userId: string, data: {
  emailEnabled?: boolean;
  daysBefore?: number;
  budgetAlertEnabled?: boolean;
  budgetLimit?: number | null;
}): Promise<NotificationPreference> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.emailEnabled !== undefined)       { fields.push(`email_enabled = $${idx++}`);        values.push(data.emailEnabled); }
  if (data.daysBefore !== undefined)         { fields.push(`days_before = $${idx++}`);           values.push(data.daysBefore); }
  if (data.budgetAlertEnabled !== undefined) { fields.push(`budget_alert_enabled = $${idx++}`); values.push(data.budgetAlertEnabled); }
  if ('budgetLimit' in data)                 { fields.push(`budget_limit = $${idx++}`);          values.push(data.budgetLimit ?? null); }
  fields.push('updated_at = NOW()');
  values.push(userId);

  const { rows } = await pool.query<PrefRow>(
    `UPDATE notification_preferences SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values
  );
  return toPref(rows[0]);
}
