import { pool } from '../db';
import type { BillingHistoryEntry } from '../../../src/shared/types';

interface Row {
  id: string;
  plan: string;
  provider: string | null;
  amount_minor: number;
  currency: string;
  period_end: Date | null;
  created_at: Date;
}

function toEntry(row: Row): BillingHistoryEntry {
  return {
    id: row.id,
    plan: row.plan,
    provider: row.provider,
    amountMinor: row.amount_minor,
    currency: row.currency,
    periodEnd: row.period_end ? row.period_end.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

/** Appends a successful-payment record. */
export async function record(entry: {
  workspaceId: string;
  plan: string;
  provider: string | null;
  reference: string | null;
  amountMinor: number;
  currency: string;
  periodEnd: Date | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO billing_history (workspace_id, plan, provider, reference, amount_minor, currency, period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [entry.workspaceId, entry.plan, entry.provider, entry.reference, entry.amountMinor, entry.currency, entry.periodEnd]
  );
}

/** Most-recent-first payment history for a workspace. */
export async function listByWorkspace(workspaceId: string, limit = 20): Promise<BillingHistoryEntry[]> {
  const { rows } = await pool.query<Row>(
    `SELECT id, plan, provider, amount_minor, currency, period_end, created_at
     FROM billing_history WHERE workspace_id = $1
     ORDER BY created_at DESC LIMIT $2`,
    [workspaceId, limit]
  );
  return rows.map(toEntry);
}
