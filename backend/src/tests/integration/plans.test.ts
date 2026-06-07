/**
 * Integration tests for GET /plans (catalog).
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'u1', role: 'user' }; next(); },
}));
jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'u1', tokenVersion: 0 }),
}));
jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../models/plan.model', () => ({ listActive: jest.fn(), findByKey: jest.fn() }));

import app from '../../index';
import * as planModel from '../../models/plan.model';

const plans = [
  { key: 'free', displayName: 'Free', audience: 'personal', priceMinor: 0, currency: 'USD', interval: null, features: [], sortOrder: 1 },
  { key: 'plus', displayName: 'Plus', audience: 'personal', priceMinor: 250, currency: 'USD', interval: 'month', features: [], sortOrder: 2 },
  { key: 'team', displayName: 'Team', audience: 'business', priceMinor: 1200, currency: 'USD', interval: 'month', features: [], sortOrder: 2 },
];

beforeEach(() => {
  jest.clearAllMocks();
  (planModel.listActive as jest.Mock).mockResolvedValue(plans);
});

describe('GET /plans', () => {
  it('returns the full catalog', async () => {
    const res = await request(app).get('/plans');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
  });

  it('filters by audience', async () => {
    const res = await request(app).get('/plans?audience=business');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].key).toBe('team');
  });

  it('returns 500 when the model throws', async () => {
    (planModel.listActive as jest.Mock).mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/plans');
    expect(res.status).toBe(500);
  });
});
