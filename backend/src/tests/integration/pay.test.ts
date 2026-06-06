/**
 * Integration tests for POST /subscriptions/:id/pay.
 *
 * The payment service is mocked — this verifies the route maps each
 * ChargeResult code to the correct HTTP status and envelope.
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'user-123' }; next(); },
}));

jest.mock('../../middleware/workspaceContext', () => ({
  workspaceContext: (req: any, _res: any, next: any) => {
    req.workspace = { id: 'ws-123', type: 'personal', role: 'owner' };
    next();
  },
  requireCapability: () => (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'user-123', tokenVersion: 0 }),
}));

jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));

jest.mock('../../services/payment.service', () => ({ chargeSubscription: jest.fn() }));

import app from '../../index';
import { chargeSubscription } from '../../services/payment.service';

const charge = chargeSubscription as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('POST /subscriptions/:id/pay', () => {
  it('returns 200 with subscription + wallet on a successful charge', async () => {
    charge.mockResolvedValue({
      code: 'paid',
      subscription: { id: 'sub-1', name: 'Netflix' },
      wallet: { id: 'w-1', usdBalance: 84 },
    });

    const res = await request(app).post('/subscriptions/sub-1/pay');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subscription.id).toBe('sub-1');
    expect(res.body.data.wallet.usdBalance).toBe(84);
    expect(charge).toHaveBeenCalledWith('ws-123', 'sub-1', { source: 'manual' });
  });

  it('returns 402 when the wallet balance is insufficient', async () => {
    charge.mockResolvedValue({ code: 'insufficient', needed: '$15.99', have: '$2.00' });

    const res = await request(app).post('/subscriptions/sub-1/pay');

    expect(res.status).toBe(402);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/Insufficient balance.*\$15\.99.*\$2\.00/);
  });

  it('returns 404 when the subscription is not found', async () => {
    charge.mockResolvedValue({ code: 'not_found' });
    const res = await request(app).post('/subscriptions/missing/pay');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when the subscription is paused', async () => {
    charge.mockResolvedValue({ code: 'paused' });
    const res = await request(app).post('/subscriptions/sub-1/pay');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/paused/i);
  });

  it('returns 500 when the service throws', async () => {
    charge.mockRejectedValue(new Error('db down'));
    const res = await request(app).post('/subscriptions/sub-1/pay');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
