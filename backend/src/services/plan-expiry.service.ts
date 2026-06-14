/**
 * Plan-expiry enforcement.
 *
 * v1 billing is pay-per-period: a successful charge activates a plan until
 * `current_period_end` with no native auto-renew. This scan reverts any plan
 * whose period has lapsed back to free, so entitlements stop granting paid
 * limits. Runs daily; the entitlements resolver also guards expiry at read time
 * so there's no window of over-entitlement between runs.
 */
import { pool } from '../db';

export async function runPlanExpiryScan(): Promise<{ expired: number }> {
  // Flip lapsed active/canceled billing rows to 'expired' and collect them.
  const { rows } = await pool.query<{ workspace_id: string }>(
    `UPDATE workspace_billing
        SET status = 'expired', updated_at = NOW()
      WHERE current_period_end IS NOT NULL
        AND current_period_end < NOW()
        AND status IN ('active', 'canceled')
      RETURNING workspace_id`
  );

  if (rows.length > 0) {
    await pool.query(
      `UPDATE workspaces SET plan = 'free', updated_at = NOW() WHERE id = ANY($1::uuid[])`,
      [rows.map(r => r.workspace_id)]
    );
  }

  console.log(`[PlanExpiry] Scan complete — ${rows.length} plan(s) reverted to free`);
  return { expired: rows.length };
}
