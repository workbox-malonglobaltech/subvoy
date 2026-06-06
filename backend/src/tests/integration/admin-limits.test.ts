/**
 * Integration tests for /admin/limits — super-admin entitlements management.
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'admin-1', role: 'superadmin' }; next(); },
}));
jest.mock('../../middleware/requireAdmin', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'admin-1', tokenVersion: 0 }),
}));
jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../services/audit-logger.service', () => ({ logAudit: jest.fn() }));

jest.mock('../../services/entitlements.service', () => ({
  listPlanLimits: jest.fn(),
  setPlanLimit: jest.fn(),
  setWorkspaceOverride: jest.fn(),
  clearWorkspaceOverride: jest.fn(),
}));

import app from '../../index';
import * as entitlements from '../../services/entitlements.service';
import { logAudit } from '../../services/audit-logger.service';

beforeEach(() => jest.clearAllMocks());

describe('GET /admin/limits', () => {
  it('returns the plan limits', async () => {
    (entitlements.listPlanLimits as jest.Mock).mockResolvedValue([
      { plan: 'free', limitKey: 'max_payment_obligations', limitValue: 10 },
    ]);
    const res = await request(app).get('/admin/limits');
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ plan: 'free', limitValue: 10 });
  });
});

describe('PUT /admin/limits', () => {
  it('updates a plan limit and audit-logs it', async () => {
    (entitlements.setPlanLimit as jest.Mock).mockResolvedValue(undefined);
    const res = await request(app).put('/admin/limits').send({ plan: 'free', limitKey: 'max_payment_obligations', limitValue: 5 });
    expect(res.status).toBe(200);
    expect(entitlements.setPlanLimit).toHaveBeenCalledWith('free', 'max_payment_obligations', 5);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'plan_limit.update' }));
  });

  it('accepts -1 (unlimited) but rejects < -1', async () => {
    const ok = await request(app).put('/admin/limits').send({ plan: 'plus', limitKey: 'max_payment_obligations', limitValue: -1 });
    expect(ok.status).toBe(200);
    const bad = await request(app).put('/admin/limits').send({ plan: 'plus', limitKey: 'x', limitValue: -5 });
    expect(bad.status).toBe(400);
  });
});

describe('workspace overrides', () => {
  it('sets an override', async () => {
    (entitlements.setWorkspaceOverride as jest.Mock).mockResolvedValue(undefined);
    const res = await request(app).put('/admin/limits/overrides')
      .send({ workspaceId: '550e8400-e29b-41d4-a716-446655440000', limitKey: 'max_payment_obligations', limitValue: 50 });
    expect(res.status).toBe(200);
    expect(entitlements.setWorkspaceOverride).toHaveBeenCalled();
  });

  it('clears an override (404 when none)', async () => {
    (entitlements.clearWorkspaceOverride as jest.Mock).mockResolvedValue(false);
    const res = await request(app).delete('/admin/limits/overrides/ws-1/max_payment_obligations');
    expect(res.status).toBe(404);
  });
});
