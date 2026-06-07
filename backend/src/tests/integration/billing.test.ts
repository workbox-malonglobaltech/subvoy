/**
 * Integration tests for /billing (checkout + status). The billing service is
 * mocked — this verifies route wiring + status-code mapping.
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'u1', role: 'user' }; next(); },
}));
jest.mock('../../middleware/workspaceContext', () => ({
  workspaceContext: (req: any, _res: any, next: any) => { req.workspace = { id: 'ws-1', type: 'business', role: 'owner' }; next(); },
  requireCapability: () => (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../services/auth.service', () => ({ verifyToken: jest.fn().mockReturnValue({ userId: 'u1', tokenVersion: 0 }) }));
jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../services/billing.service', () => ({ initiateCheckout: jest.fn(), handleWebhook: jest.fn() }));
jest.mock('../../models/workspace.model', () => ({ findById: jest.fn() }));
jest.mock('../../models/user', () => ({ findById: jest.fn() }));
jest.mock('../../models/workspace-billing.model', () => ({ get: jest.fn() }));

import app from '../../index';
import * as billingService from '../../services/billing.service';
import * as workspaceModel from '../../models/workspace.model';
import * as userModel from '../../models/user';
import * as billingModel from '../../models/workspace-billing.model';

beforeEach(() => {
  jest.clearAllMocks();
  (workspaceModel.findById as jest.Mock).mockResolvedValue({ id: 'ws-1', country: 'US', plan: 'free' });
  (userModel.findById as jest.Mock).mockResolvedValue({ id: 'u1', email: 'a@b.com' });
});

describe('POST /billing/checkout', () => {
  it('returns the checkout url', async () => {
    (billingService.initiateCheckout as jest.Mock).mockResolvedValue({ ok: true, url: 'https://pay/x' });
    const res = await request(app).post('/billing/checkout').send({ planKey: 'plus' });
    expect(res.status).toBe(200);
    expect(res.body.data.url).toBe('https://pay/x');
    expect(billingService.initiateCheckout).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'ws-1', planKey: 'plus', country: 'US', userEmail: 'a@b.com' }));
  });

  it('returns 503 when billing is not configured', async () => {
    (billingService.initiateCheckout as jest.Mock).mockResolvedValue({ ok: false, reason: 'not_configured' });
    const res = await request(app).post('/billing/checkout').send({ planKey: 'plus' });
    expect(res.status).toBe(503);
  });

  it('returns 400 for a free plan', async () => {
    (billingService.initiateCheckout as jest.Mock).mockResolvedValue({ ok: false, reason: 'free_plan' });
    const res = await request(app).post('/billing/checkout').send({ planKey: 'free' });
    expect(res.status).toBe(400);
  });

  it('400s a missing planKey', async () => {
    const res = await request(app).post('/billing/checkout').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /billing/status', () => {
  it('returns the billing row when present', async () => {
    (billingModel.get as jest.Mock).mockResolvedValue({ workspaceId: 'ws-1', plan: 'plus', provider: 'paystack', status: 'active', currentPeriodEnd: null });
    const res = await request(app).get('/billing/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ plan: 'plus', status: 'active' });
  });

  it('falls back to an inactive default when no row', async () => {
    (billingModel.get as jest.Mock).mockResolvedValue(null);
    const res = await request(app).get('/billing/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ plan: 'free', status: 'inactive' });
  });
});
