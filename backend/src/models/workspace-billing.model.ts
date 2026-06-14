import { pool } from '../db';

export interface WorkspaceBilling {
  workspaceId: string;
  plan: string;
  provider: string | null;
  status: 'inactive' | 'pending' | 'active' | 'canceled';
  currentPeriodEnd: string | null;
}

interface Row {
  workspace_id: string;
  plan: string;
  provider: string | null;
  status: WorkspaceBilling['status'];
  current_period_end: Date | null;
}

function toBilling(row: Row): WorkspaceBilling {
  return {
    workspaceId: row.workspace_id,
    plan: row.plan,
    provider: row.provider,
    status: row.status,
    currentPeriodEnd: row.current_period_end ? row.current_period_end.toISOString() : null,
  };
}

export async function get(workspaceId: string): Promise<WorkspaceBilling | null> {
  const { rows } = await pool.query<Row>(
    `SELECT workspace_id, plan, provider, status, current_period_end
     FROM workspace_billing WHERE workspace_id = $1`,
    [workspaceId]
  );
  return rows[0] ? toBilling(rows[0]) : null;
}

/** Records a started checkout (status=pending) so the webhook can match it. */
export async function markPending(
  workspaceId: string,
  plan: string,
  provider: string,
  reference: string
): Promise<void> {
  await pool.query(
    `INSERT INTO workspace_billing (workspace_id, plan, provider, reference, status, updated_at)
     VALUES ($1, $2, $3, $4, 'pending', NOW())
     ON CONFLICT (workspace_id) DO UPDATE
       SET plan = EXCLUDED.plan, provider = EXCLUDED.provider,
           reference = EXCLUDED.reference, status = 'pending', updated_at = NOW()`,
    [workspaceId, plan, provider, reference]
  );
}

/** Activates a plan for one period after a successful charge. */
export async function markActive(
  workspaceId: string,
  plan: string,
  provider: string,
  periodEnd: Date
): Promise<void> {
  await pool.query(
    `INSERT INTO workspace_billing (workspace_id, plan, provider, status, current_period_end, updated_at)
     VALUES ($1, $2, $3, 'active', $4, NOW())
     ON CONFLICT (workspace_id) DO UPDATE
       SET plan = EXCLUDED.plan, provider = EXCLUDED.provider, status = 'active',
           current_period_end = EXCLUDED.current_period_end, updated_at = NOW()`,
    [workspaceId, plan, provider, periodEnd]
  );
}

/**
 * Marks an active plan as canceled. The workspace keeps access until
 * current_period_end; the plan-expiry job reverts it to free when the period
 * lapses. Only transitions from 'active' (no-op otherwise).
 */
export async function markCanceled(workspaceId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE workspace_billing SET status = 'canceled', updated_at = NOW()
     WHERE workspace_id = $1 AND status = 'active'`,
    [workspaceId]
  );
  return (rowCount ?? 0) > 0;
}

/** Finds the workspace tied to a checkout reference (webhook fallback path). */
export async function findByReference(reference: string): Promise<{ workspaceId: string; plan: string } | null> {
  const { rows } = await pool.query<{ workspace_id: string; plan: string }>(
    `SELECT workspace_id, plan FROM workspace_billing WHERE reference = $1`,
    [reference]
  );
  return rows[0] ? { workspaceId: rows[0].workspace_id, plan: rows[0].plan } : null;
}
