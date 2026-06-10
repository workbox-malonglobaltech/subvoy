import { pool } from '../db';

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  daysBefore: number;
  budgetAlertEnabled: boolean;
  budgetLimit: number | null;
  /** Per-currency monthly budgets, e.g. { NGN: 50000, USD: 200 }. */
  budgetLimits: Record<string, number>;
  updatedAt: string;
}

interface PrefRow {
  id: string;
  user_id: string;
  email_enabled: boolean;
  days_before: number;
  budget_alert_enabled: boolean;
  budget_limit: string | null;
  budget_limits: Record<string, number> | null;
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
    budgetLimits: row.budget_limits ?? {},
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
  budgetLimits?: Record<string, number>;
}): Promise<NotificationPreference> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.emailEnabled !== undefined)       { fields.push(`email_enabled = $${idx++}`);        values.push(data.emailEnabled); }
  if (data.daysBefore !== undefined)         { fields.push(`days_before = $${idx++}`);           values.push(data.daysBefore); }
  if (data.budgetAlertEnabled !== undefined) { fields.push(`budget_alert_enabled = $${idx++}`); values.push(data.budgetAlertEnabled); }
  if ('budgetLimit' in data)                 { fields.push(`budget_limit = $${idx++}`);          values.push(data.budgetLimit ?? null); }
  if (data.budgetLimits !== undefined)       { fields.push(`budget_limits = $${idx++}`);         values.push(JSON.stringify(data.budgetLimits)); }
  fields.push('updated_at = NOW()');
  values.push(userId);

  const { rows } = await pool.query<PrefRow>(
    `UPDATE notification_preferences SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
    values
  );
  return toPref(rows[0]);
}
