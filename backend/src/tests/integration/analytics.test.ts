/**
 * Integration tests for /analytics routes.
 *
 * Dependencies mocked:
 *   - ../../db              → pool.query returns deterministic fixtures
 *   - authenticate          → injects test user when cookie present
 *   - auth.service          → no-op mocks
 *   - reminder.job + cron   → prevents background job side effects
 */

import request from 'supertest';

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (!req.cookies?.token) {
      return res.status(401).json({ success: false, data: null, error: 'Authentication required' });
    }
    req.user = { id: 'aaaaaaaa-0000-0000-0000-000000000001' };
    next();
  },
}));

// Analytics is workspace-scoped — resolve the active workspace deterministically.
jest.mock('../../middleware/workspaceContext', () => ({
  workspaceContext: (req: any, _res: any, next: any) => {
    req.workspace = { id: 'ws-123', type: 'personal', role: 'owner' };
    next();
  },
  requireCapability: () => (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'aaaaaaaa-0000-0000-0000-000000000001', tokenVersion: 0 }),
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  signToken: jest.fn(),
}));

jest.mock('../../jobs/reminder.job', () => ({
  startReminderJob: jest.fn(),
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import app from '../../index';

const AUTH_COOKIE = 'token=test-token';

const monthRows = [
  { month: '2025-05', total: '0.00' },
  { month: '2025-06', total: '0.00' },
  { month: '2025-07', total: '0.00' },
  { month: '2025-08', total: '0.00' },
  { month: '2025-09', total: '0.00' },
  { month: '2025-10', total: '0.00' },
  { month: '2025-11', total: '0.00' },
  { month: '2025-12', total: '0.00' },
  { month: '2026-01', total: '0.00' },
  { month: '2026-02', total: '0.00' },
  { month: '2026-03', total: '0.00' },
  { month: '2026-04', total: '15.99' },
];

const subRows = [
  {
    id: 'bbbbbbbb-0000-0000-0000-000000000002',
    user_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'Netflix',
    amount: '15.99',
    currency: 'USD',
    billing_cycle: 'monthly',
    next_billing_date: new Date('2026-05-01T00:00:00Z'),
    category: 'Entertainment',
    logo_url: null,
    notes: null,
    is_active: true,
    created_at: new Date('2026-04-01T00:00:00Z'),
    updated_at: new Date('2026-04-01T00:00:00Z'),
  },
];

beforeEach(() => {
  mockQuery.mockReset();
});

// ---- GET /analytics/monthly --------------------------------------------------

describe('GET /analytics/monthly', () => {
  it('returns 12 month data points with totals', async () => {
    mockQuery.mockResolvedValueOnce({ rows: monthRows });

    const res = await request(app)
      .get('/analytics/monthly')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.months).toHaveLength(12);

    const april = res.body.data.months.find((m: any) => m.month === '2026-04');
    expect(april).toBeDefined();
    expect(april.total).toBe(15.99);

    // All zero months parsed as numbers
    const jan = res.body.data.months.find((m: any) => m.month === '2026-01');
    expect(jan.total).toBe(0);
  });

  it('returns totals as numbers (not strings)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: monthRows });

    const res = await request(app)
      .get('/analytics/monthly')
      .set('Cookie', AUTH_COOKIE);

    res.body.data.months.forEach((m: any) => {
      expect(typeof m.total).toBe('number');
    });
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/analytics/monthly');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/analytics/monthly')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/fetch analytics/i);
  });
});

// ---- GET /analytics/export ---------------------------------------------------

describe('GET /analytics/export', () => {
  it('returns CSV with correct headers and data', async () => {
    mockQuery.mockResolvedValueOnce({ rows: subRows });

    const res = await request(app)
      .get('/analytics/export')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);

    const lines = res.text.split('\r\n');
    expect(lines[0]).toBe('Name,Amount,Currency,Billing Cycle,Next Billing Date,Category,Notes,Active');

    // Data row
    expect(lines[1]).toContain('Netflix');
    expect(lines[1]).toContain('15.99');
    expect(lines[1]).toContain('monthly');
    expect(lines[1]).toContain('Yes');
  });

  it('returns CSV with only header when no subscriptions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/analytics/export')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    const lines = res.text.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(1); // header only
  });

  it('escapes double-quotes in name and notes fields', async () => {
    const rowWithQuotes = [{
      ...subRows[0],
      name: 'My "Premium" Plan',
      notes: 'Has "quotes"',
    }];
    mockQuery.mockResolvedValueOnce({ rows: rowWithQuotes });

    const res = await request(app)
      .get('/analytics/export')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.text).toContain('"My ""Premium"" Plan"');
    expect(res.text).toContain('"Has ""quotes"""');
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/analytics/export');
    expect(res.status).toBe(401);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/analytics/export')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/export/i);
  });
});
