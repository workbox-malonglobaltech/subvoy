/**
 * Unit tests for the entitlements resolver — override → plan default → fallback,
 * plus the isWithinLimit helper.
 */

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../db';
import { getEffectiveLimit, isWithinLimit, invalidateLimitsCache, UNLIMITED } from '../../services/entitlements.service';

const query = (pool as unknown as { query: jest.Mock }).query;

/** Configure the db mock by SQL keyword. */
function setup(opts: { override?: number; plan?: string; planLimits?: Array<[string, string, number]> }) {
  query.mockImplementation((sql: string) => {
    if (/workspace_limit_overrides/.test(sql)) {
      return Promise.resolve({ rows: opts.override !== undefined ? [{ limit_value: opts.override }] : [] });
    }
    if (/FROM workspaces/.test(sql)) {
      // The resolver computes an effective `plan` (with a read-time expiry guard);
      // the unit mock returns it directly since no expired billing row is set.
      return Promise.resolve({ rows: [{ plan: opts.plan ?? 'free' }] });
    }
    if (/FROM plan_limits/.test(sql)) {
      return Promise.resolve({
        rows: (opts.planLimits ?? []).map(([plan, limit_key, limit_value]) => ({ plan, limit_key, limit_value })),
      });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  invalidateLimitsCache(); // plan defaults are module-cached
});

describe('getEffectiveLimit', () => {
  it('returns a per-workspace override when present', async () => {
    setup({ override: 99, plan: 'free', planLimits: [['free', 'max_payment_obligations', 10]] });
    expect(await getEffectiveLimit('ws-1', 'max_payment_obligations')).toBe(99);
  });

  it('falls back to the per-plan default when no override', async () => {
    setup({ plan: 'free', planLimits: [['free', 'max_payment_obligations', 10]] });
    expect(await getEffectiveLimit('ws-1', 'max_payment_obligations')).toBe(10);
  });

  it('uses the plus plan default (unlimited)', async () => {
    setup({ plan: 'plus', planLimits: [['plus', 'max_payment_obligations', -1]] });
    expect(await getEffectiveLimit('ws-1', 'max_payment_obligations')).toBe(UNLIMITED);
  });

  it('falls back to the code default when plan/key row is missing', async () => {
    setup({ plan: 'free', planLimits: [] });
    expect(await getEffectiveLimit('ws-1', 'max_payment_obligations')).toBe(10);
  });
});

describe('isWithinLimit', () => {
  it('always allows when unlimited', async () => {
    setup({ plan: 'plus', planLimits: [['plus', 'max_payment_obligations', -1]] });
    expect(await isWithinLimit('ws-1', 'max_payment_obligations', 9999)).toBe(true);
  });

  it('allows when under the limit', async () => {
    setup({ plan: 'free', planLimits: [['free', 'max_payment_obligations', 10]] });
    expect(await isWithinLimit('ws-1', 'max_payment_obligations', 9)).toBe(true);
  });

  it('blocks when at the limit', async () => {
    setup({ plan: 'free', planLimits: [['free', 'max_payment_obligations', 10]] });
    expect(await isWithinLimit('ws-1', 'max_payment_obligations', 10)).toBe(false);
  });
});
