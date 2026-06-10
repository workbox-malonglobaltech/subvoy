/**
 * Integration tests for the /subscriptions routes.
 *
 * Dependencies mocked:
 *   - ../../db                    → pool.query returns deterministic fixtures
 *   - ../../middleware/authenticate → injects req.user = { id: 'user-123' }
 *   - ../../services/auth.service  → verifyToken (required by authenticate module at import time)
 *   - ../../jobs/reminder.job      → prevents the cron job from starting
 *
 * Run with:  npx jest src/tests/integration/subscriptions.test.ts
 */

import request from 'supertest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
}));

// Bypass authentication for every request — inject a known test user
jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-123' };
    next();
  },
}));

// Resolve the active workspace deterministically — mirror the authenticate mock.
jest.mock('../../middleware/workspaceContext', () => ({
  workspaceContext: (req: any, _res: any, next: any) => {
    req.workspace = { id: 'ws-123', type: 'personal', role: 'owner' };
    next();
  },
  requireCapability: () => (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/auth.service', () => ({
  hashPassword: jest.fn().mockResolvedValue('$hashed'),
  comparePassword: jest.fn().mockResolvedValue(true),
  signToken: jest.fn().mockReturnValue('mock-jwt'),
  verifyToken: jest.fn().mockReturnValue({ userId: 'user-123', tokenVersion: 0 }),
}));

jest.mock('../../jobs/reminder.job', () => ({
  startReminderJob: jest.fn(),
}));

// Entitlements: allow by default; the count query still runs against the db mock.
jest.mock('../../services/entitlements.service', () => ({
  isWithinLimit: jest.fn().mockResolvedValue(true),
  getEffectiveLimit: jest.fn().mockResolvedValue(10),
  UNLIMITED: -1,
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks are hoisted
// ---------------------------------------------------------------------------

import app from '../../index';
import { pool } from '../../db';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-123';
const WS_ID   = 'ws-123';
const SUB_ID  = 'sub-123';

const subRow = {
  id: SUB_ID,
  workspace_id: WS_ID,
  user_id: USER_ID,
  kind: 'payment',
  name: 'Netflix',
  amount: '15.99',
  currency: 'USD',
  billing_cycle: 'monthly',
  next_billing_date: new Date('2026-05-01'),
  is_active: true,
  category: 'Entertainment',
  notes: null,
  logo_url: null,
  created_at: new Date('2026-04-01T00:00:00Z'),
  updated_at: new Date('2026-04-01T00:00:00Z'),
};

const summaryCurrencyRow = {
  currency: 'USD', monthly: '15.99', yearly: '191.88', count: '1',
};
const summaryCountsRow = {
  active_count: '1', due_7_days: '0', due_30_days: '1',
};

const summaryCategoryRow = {
  category: 'Entertainment',
  total: '15.99',
};

const mockQuery = pool.query as jest.Mock;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET /subscriptions
// ---------------------------------------------------------------------------

describe('GET /subscriptions', () => {
  it('returns 200 with an array of subscriptions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [subRow] });

    const res = await request(app).get('/subscriptions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: SUB_ID,
      name: 'Netflix',
      amount: 15.99,
      currency: 'USD',
      billingCycle: 'monthly',
    });
  });

  it('returns 200 with an empty array when the user has no subscriptions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/subscriptions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when the database throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/subscriptions');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/fetch subscriptions/i);
  });
});

// ---------------------------------------------------------------------------
// POST /subscriptions
// ---------------------------------------------------------------------------

describe('POST /subscriptions', () => {
  const validBody = {
    name: 'Netflix',
    amount: 15.99,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: '2026-05-01',
    category: 'Entertainment',
  };

  it('returns 201 with the created subscription given a valid body', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })  // limit count check
      .mockResolvedValueOnce({ rows: [subRow] });          // INSERT

    const res = await request(app)
      .post('/subscriptions')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({
      id: SUB_ID,
      name: 'Netflix',
      amount: 15.99,
      billingCycle: 'monthly',
    });
  });

  it('returns 400 when name is missing', async () => {
    const { name: _omit, ...noName } = validBody;

    const res = await request(app)
      .post('/subscriptions')
      .send(noName);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when name is an empty string', async () => {
    const res = await request(app)
      .post('/subscriptions')
      .send({ ...validBody, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is negative', async () => {
    const res = await request(app)
      .post('/subscriptions')
      .send({ ...validBody, amount: -5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when amount is zero', async () => {
    const res = await request(app)
      .post('/subscriptions')
      .send({ ...validBody, amount: 0 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when billingCycle is an invalid value', async () => {
    const res = await request(app)
      .post('/subscriptions')
      .send({ ...validBody, billingCycle: 'daily' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when nextBillingDate does not match YYYY-MM-DD', async () => {
    const res = await request(app)
      .post('/subscriptions')
      .send({ ...validBody, nextBillingDate: '01-05-2026' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when currency is not exactly 3 characters', async () => {
    const res = await request(app)
      .post('/subscriptions')
      .send({ ...validBody, currency: 'US' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when logoUrl uses HTTP instead of HTTPS', async () => {
    const res = await request(app)
      .post('/subscriptions')
      .send({ ...validBody, logoUrl: 'http://example.com/logo.png' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the database throws during INSERT', async () => {
    mockQuery.mockRejectedValueOnce(new Error('constraint violation'));

    const res = await request(app)
      .post('/subscriptions')
      .send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PUT /subscriptions/:id
// ---------------------------------------------------------------------------

describe('PUT /subscriptions/:id', () => {
  it('returns 200 with the updated subscription given a valid body', async () => {
    const updatedRow = { ...subRow, name: 'Netflix Premium', amount: '22.99' };
    mockQuery.mockResolvedValueOnce({ rows: [updatedRow] });

    const res = await request(app)
      .put(`/subscriptions/${SUB_ID}`)
      .send({ name: 'Netflix Premium', amount: 22.99 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({ name: 'Netflix Premium', amount: 22.99 });
  });

  it('returns 200 when only isActive is toggled (partial update)', async () => {
    const deactivatedRow = { ...subRow, is_active: false };
    mockQuery.mockResolvedValueOnce({ rows: [deactivatedRow] });

    const res = await request(app)
      .put(`/subscriptions/${SUB_ID}`)
      .send({ isActive: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
  });

  it('returns 404 when the subscription does not belong to the user', async () => {
    // The UPDATE returns no rows → subscription not found or wrong user
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/subscriptions/nonexistent-id')
      .send({ name: 'Hacked' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 400 when amount is negative in the update body', async () => {
    const res = await request(app)
      .put(`/subscriptions/${SUB_ID}`)
      .send({ amount: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the database throws during UPDATE', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db error'));

    const res = await request(app)
      .put(`/subscriptions/${SUB_ID}`)
      .send({ name: 'Netflix' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DELETE /subscriptions/:id
// ---------------------------------------------------------------------------

describe('DELETE /subscriptions/:id', () => {
  it('returns 200 on successful soft-delete', async () => {
    // softDelete calls pool.query → rowCount: 1 means a row was updated
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    const res = await request(app).delete(`/subscriptions/${SUB_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBeNull();
  });

  it('returns 404 when the subscription does not exist or belongs to another user', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app).delete('/subscriptions/nonexistent-id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 500 when the database throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).delete(`/subscriptions/${SUB_ID}`);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /subscriptions/summary
// ---------------------------------------------------------------------------

describe('GET /subscriptions/summary', () => {
  it('returns 200 with per-currency spend and category breakdown', async () => {
    // Route issues three queries: per-currency, counts, category breakdown
    mockQuery
      .mockResolvedValueOnce({ rows: [summaryCurrencyRow] })
      .mockResolvedValueOnce({ rows: [summaryCountsRow] })
      .mockResolvedValueOnce({ rows: [summaryCategoryRow] });

    const res = await request(app).get('/subscriptions/summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();

    const { data } = res.body;
    expect(Array.isArray(data.byCurrency)).toBe(true);
    expect(data.byCurrency[0]).toMatchObject({ currency: 'USD', monthlySpend: 15.99, yearlySpend: 191.88, count: 1 });
    expect(data.activeCount).toBe(1);
    expect(data.due7Days).toBe(0);
    expect(data.byCategory[0]).toMatchObject({ category: 'Entertainment', total: 15.99 });
  });

  it('returns 200 with empty/zeroed values when the user has no active subscriptions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                                                  // no currencies
      .mockResolvedValueOnce({ rows: [{ active_count: '0', due_7_days: '0', due_30_days: '0' }] })
      .mockResolvedValueOnce({ rows: [] });                                                 // no categories

    const res = await request(app).get('/subscriptions/summary');

    expect(res.status).toBe(200);
    expect(res.body.data.byCurrency).toEqual([]);
    expect(res.body.data.activeCount).toBe(0);
    expect(res.body.data.byCategory).toEqual([]);
  });

  it('returns 500 when the database throws on the stats query', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/subscriptions/summary');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/fetch summary/i);
  });
});
