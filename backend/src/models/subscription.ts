import { pool } from '../db';
import { Subscription, CreateSubscriptionInput, UpdateSubscriptionInput } from '../../../src/shared/types';

interface SubscriptionRow {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: string;
  name: string;
  amount: string;
  currency: string;
  billing_cycle: string;
  next_billing_date: Date;
  category: string | null;
  logo_url: string | null;
  notes: string | null;
  is_active: boolean;
  autopay: boolean;
  autopay_max_amount: string | null;
  last_known_amount: string | null;
  created_at: Date;
  updated_at: Date;
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: (row.kind ?? 'payment') as Subscription['kind'],
    name: row.name,
    amount: parseFloat(row.amount),
    currency: row.currency,
    billingCycle: row.billing_cycle as Subscription['billingCycle'],
    nextBillingDate: row.next_billing_date.toISOString().split('T')[0],
    category: row.category,
    logoUrl: row.logo_url,
    notes: row.notes,
    isActive: row.is_active,
    autopay: row.autopay ?? false,
    autopayMaxAmount: row.autopay_max_amount != null ? parseFloat(row.autopay_max_amount) : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllByWorkspace(workspaceId: string): Promise<Subscription[]> {
  const { rows } = await pool.query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE workspace_id = $1 AND is_active = TRUE ORDER BY next_billing_date ASC',
    [workspaceId]
  );
  return rows.map(toSubscription);
}

/**
 * User-scoped fetch for the personal-scope consumers that have not yet been
 * re-scoped to workspaces (analytics export). Returns the user's active
 * subscriptions across all workspaces they own rows in. Subscriptions are still
 * authored with a user_id, so this remains correct for the personal use case.
 */
export async function findAllByUser(userId: string): Promise<Subscription[]> {
  const { rows } = await pool.query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE user_id = $1 AND is_active = TRUE ORDER BY next_billing_date ASC',
    [userId]
  );
  return rows.map(toSubscription);
}

export async function findById(id: string, workspaceId: string): Promise<Subscription | null> {
  const { rows } = await pool.query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  if (!rows[0]) return null;
  return toSubscription(rows[0]);
}

export async function create(
  workspaceId: string,
  userId: string,
  data: CreateSubscriptionInput
): Promise<Subscription> {
  const { rows } = await pool.query<SubscriptionRow>(
    `INSERT INTO subscriptions
       (workspace_id, user_id, name, amount, currency, billing_cycle, next_billing_date, category, logo_url, notes, autopay, autopay_max_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
    [
      workspaceId,
      userId,
      data.name,
      data.amount,
      data.currency ?? 'USD',
      data.billingCycle,
      data.nextBillingDate,
      data.category ?? null,
      data.logoUrl ?? null,
      data.notes ?? null,
      data.autopay ?? false,
      data.autopayMaxAmount ?? null,
    ]
  );
  return toSubscription(rows[0]);
}

/**
 * Creates a subscription for a user in their Personal workspace, resolving the
 * workspace_id from the user's personal workspace inside the same INSERT (single
 * round-trip). Used by personal-scope consumers (CSV import confirm) that don't
 * carry workspace context. Keyed on user_id first so callers asserting on the
 * params see [userId, name, ...].
 */
export async function createForUser(userId: string, data: CreateSubscriptionInput): Promise<Subscription> {
  const { rows } = await pool.query<SubscriptionRow>(
    `INSERT INTO subscriptions
       (user_id, workspace_id, name, amount, currency, billing_cycle, next_billing_date, category, logo_url, notes, autopay, autopay_max_amount)
     VALUES (
       $1,
       (SELECT id FROM workspaces WHERE owner_id = $1 AND type = 'personal' LIMIT 1),
       $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
     ) RETURNING *`,
    [
      userId,
      data.name,
      data.amount,
      data.currency ?? 'USD',
      data.billingCycle,
      data.nextBillingDate,
      data.category ?? null,
      data.logoUrl ?? null,
      data.notes ?? null,
      data.autopay ?? false,
      data.autopayMaxAmount ?? null,
    ]
  );
  return toSubscription(rows[0]);
}

export async function update(
  id: string,
  workspaceId: string,
  data: UpdateSubscriptionInput
): Promise<Subscription | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.name !== undefined) { fields.push(`name = $${idx++}`); values.push(data.name); }
  if (data.amount !== undefined) {
    fields.push(`amount = $${idx++}`); values.push(data.amount);
    // User explicitly changed the amount — sync last_known_amount so no spurious price-change alert fires
    fields.push(`last_known_amount = $${idx++}`); values.push(data.amount);
  }
  if (data.currency !== undefined) { fields.push(`currency = $${idx++}`); values.push(data.currency); }
  if (data.billingCycle !== undefined) { fields.push(`billing_cycle = $${idx++}`); values.push(data.billingCycle); }
  if (data.nextBillingDate !== undefined) { fields.push(`next_billing_date = $${idx++}`); values.push(data.nextBillingDate); }
  if (data.category !== undefined) { fields.push(`category = $${idx++}`); values.push(data.category); }
  if (data.logoUrl !== undefined) { fields.push(`logo_url = $${idx++}`); values.push(data.logoUrl); }
  if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes); }
  if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }
  if (data.autopay !== undefined) { fields.push(`autopay = $${idx++}`); values.push(data.autopay); }
  if (data.autopayMaxAmount !== undefined) { fields.push(`autopay_max_amount = $${idx++}`); values.push(data.autopayMaxAmount); }

  if (fields.length === 0) return findById(id, workspaceId);

  fields.push(`updated_at = NOW()`);
  values.push(id, workspaceId);

  const { rows } = await pool.query<SubscriptionRow>(
    `UPDATE subscriptions SET ${fields.join(', ')} WHERE id = $${idx++} AND workspace_id = $${idx++} RETURNING *`,
    values
  );
  if (!rows[0]) return null;
  return toSubscription(rows[0]);
}

export async function findAllByWorkspaceIncludingInactive(workspaceId: string): Promise<Subscription[]> {
  const { rows } = await pool.query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE workspace_id = $1 ORDER BY is_active DESC, next_billing_date ASC',
    [workspaceId]
  );
  return rows.map(toSubscription);
}

export async function softDelete(id: string, workspaceId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'UPDATE subscriptions SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}

export async function hardDelete(id: string, workspaceId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM subscriptions WHERE id = $1 AND workspace_id = $2',
    [id, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Updates last_known_amount after a price-change alert has been fired.
 * Called by the reminder service so the alert doesn't repeat next scan.
 */
export async function updateLastKnownAmount(id: string, amount: number): Promise<void> {
  await pool.query(
    'UPDATE subscriptions SET last_known_amount = $1, updated_at = NOW() WHERE id = $2',
    [amount, id]
  );
}

/**
 * Advances next_billing_date by one billing cycle and returns the updated subscription.
 * Used after a wallet payment is recorded.
 */
export async function advanceNextBillingDate(id: string, workspaceId: string): Promise<Subscription | null> {
  const { rows } = await pool.query<SubscriptionRow>(
    `UPDATE subscriptions
     SET next_billing_date =
       CASE billing_cycle
         WHEN 'weekly'  THEN next_billing_date + INTERVAL '7 days'
         WHEN 'monthly' THEN next_billing_date + INTERVAL '1 month'
         WHEN 'yearly'  THEN next_billing_date + INTERVAL '1 year'
         ELSE next_billing_date
       END,
       updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2
     RETURNING *`,
    [id, workspaceId]
  );
  if (!rows[0]) return null;
  return toSubscription(rows[0]);
}

export async function bulkDelete(ids: string[], workspaceId: string): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
  const { rowCount } = await pool.query(
    `UPDATE subscriptions SET is_active = FALSE, updated_at = NOW()
     WHERE id IN (${placeholders}) AND workspace_id = $1`,
    [workspaceId, ...ids]
  );
  return rowCount ?? 0;
}
