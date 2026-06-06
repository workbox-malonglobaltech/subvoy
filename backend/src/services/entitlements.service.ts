/**
 * Entitlements / limits resolver.
 *
 * Effective limit for a workspace = per-workspace override → per-plan default
 * (admin-set, in `plan_limits`) → code fallback (so the app works before any
 * admin config exists). -1 means unlimited.
 *
 * Per-plan defaults are cached in memory and invalidated on write, since the
 * limit is read on hot paths (e.g. every "add subscription").
 */

import { pool } from '../db';

export type LimitKey =
  | 'max_payment_obligations'
  | 'max_compliance_obligations'
  | 'max_members';

export const UNLIMITED = -1;

/** Code fallback — used only if a plan/key row is missing from plan_limits. */
const SYSTEM_DEFAULTS: Record<LimitKey, number> = {
  max_payment_obligations: 10,
  max_compliance_obligations: 10,
  max_members: 2,
};

// ── Per-plan default cache (invalidated on write) ───────────────────────────────

let planCache: Map<string, number> | null = null; // key: `${plan}:${limitKey}`

async function loadPlanDefaults(): Promise<Map<string, number>> {
  if (planCache) return planCache;
  const { rows } = await pool.query<{ plan: string; limit_key: string; limit_value: number }>(
    `SELECT plan, limit_key, limit_value FROM plan_limits`
  );
  const map = new Map<string, number>();
  for (const r of rows) map.set(`${r.plan}:${r.limit_key}`, r.limit_value);
  planCache = map;
  return map;
}

/** Call after any write to plan_limits so the next read reflects it. */
export function invalidateLimitsCache(): void {
  planCache = null;
}

/**
 * Resolves the effective integer limit for a workspace + key.
 * Returns UNLIMITED (-1) when unlimited.
 */
export async function getEffectiveLimit(workspaceId: string, key: LimitKey): Promise<number> {
  // 1. Per-workspace override.
  const { rows: ovr } = await pool.query<{ limit_value: number }>(
    `SELECT limit_value FROM workspace_limit_overrides WHERE workspace_id = $1 AND limit_key = $2`,
    [workspaceId, key]
  );
  if (ovr[0]) return ovr[0].limit_value;

  // 2. Per-plan default for the workspace's plan.
  const { rows: ws } = await pool.query<{ plan: string }>(
    `SELECT plan FROM workspaces WHERE id = $1`,
    [workspaceId]
  );
  const plan = ws[0]?.plan ?? 'free';
  const defaults = await loadPlanDefaults();
  const planVal = defaults.get(`${plan}:${key}`);
  if (planVal !== undefined) return planVal;

  // 3. Code fallback.
  return SYSTEM_DEFAULTS[key];
}

/**
 * Throws nothing — returns whether one more item is allowed under the limit.
 * `unlimited` short-circuits to true.
 */
export async function isWithinLimit(workspaceId: string, key: LimitKey, currentCount: number): Promise<boolean> {
  const limit = await getEffectiveLimit(workspaceId, key);
  if (limit === UNLIMITED) return true;
  return currentCount < limit;
}

// ── Admin management (super-admin only) ─────────────────────────────────────────

export interface PlanLimit { plan: string; limitKey: string; limitValue: number; }

export async function listPlanLimits(): Promise<PlanLimit[]> {
  const { rows } = await pool.query<{ plan: string; limit_key: string; limit_value: number }>(
    `SELECT plan, limit_key, limit_value FROM plan_limits ORDER BY plan, limit_key`
  );
  return rows.map(r => ({ plan: r.plan, limitKey: r.limit_key, limitValue: r.limit_value }));
}

export async function setPlanLimit(plan: string, limitKey: string, limitValue: number): Promise<void> {
  await pool.query(
    `INSERT INTO plan_limits (plan, limit_key, limit_value) VALUES ($1, $2, $3)
     ON CONFLICT (plan, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value, updated_at = NOW()`,
    [plan, limitKey, limitValue]
  );
  invalidateLimitsCache();
}

export async function setWorkspaceOverride(workspaceId: string, limitKey: string, limitValue: number): Promise<void> {
  await pool.query(
    `INSERT INTO workspace_limit_overrides (workspace_id, limit_key, limit_value) VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, limit_key) DO UPDATE SET limit_value = EXCLUDED.limit_value, updated_at = NOW()`,
    [workspaceId, limitKey, limitValue]
  );
}

export async function clearWorkspaceOverride(workspaceId: string, limitKey: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM workspace_limit_overrides WHERE workspace_id = $1 AND limit_key = $2`,
    [workspaceId, limitKey]
  );
  return (rowCount ?? 0) > 0;
}
