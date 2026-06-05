/**
 * Integration tests for GET /fx/rates
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

jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'aaaaaaaa-0000-0000-0000-000000000001', tokenVersion: 0 }),
  hashPassword: jest.fn(),
  comparePassword: jest.fn(),
  signToken: jest.fn(),
}));

jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../jobs/fx.job',       () => ({ startFxJob: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const mockQuery = jest.fn();
jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import app from '../../index';

beforeEach(() => mockQuery.mockReset());

const rateRows = [
  { base_currency: 'USD', target_currency: 'NGN', rate: '1601.500000', fetched_at: new Date('2026-04-16T00:00:00Z') },
  { base_currency: 'USD', target_currency: 'GBP', rate: '0.792000',    fetched_at: new Date('2026-04-16T00:00:00Z') },
  { base_currency: 'USD', target_currency: 'EUR', rate: '0.924000',    fetched_at: new Date('2026-04-16T00:00:00Z') },
  { base_currency: 'USD', target_currency: 'CAD', rate: '1.382000',    fetched_at: new Date('2026-04-16T00:00:00Z') },
  { base_currency: 'USD', target_currency: 'USD', rate: '1.000000',    fetched_at: new Date('2026-04-16T00:00:00Z') },
];

describe('GET /fx/rates', () => {
  it('returns rates with fetchedAt and stale flag', async () => {
    mockQuery.mockResolvedValueOnce({ rows: rateRows });

    const res = await request(app).get('/fx/rates');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fetchedAt).toBe('2026-04-16T00:00:00.000Z');
    expect(typeof res.body.data.stale).toBe('boolean');
  });

  it('returns rates keyed as USD_NGN, USD_GBP etc.', async () => {
    mockQuery.mockResolvedValueOnce({ rows: rateRows });

    const res = await request(app).get('/fx/rates');

    expect(res.body.data.rates.USD_NGN).toBe(1601.5);
    expect(res.body.data.rates.USD_GBP).toBe(0.792);
    expect(res.body.data.rates.USD_EUR).toBe(0.924);
    expect(res.body.data.rates.USD_CAD).toBe(1.382);
  });

  it('returns stale: true when fetchedAt is older than 26 hours', async () => {
    const oldDate = new Date(Date.now() - 27 * 60 * 60 * 1000); // 27h ago
    const staleRows = rateRows.map(r => ({ ...r, fetched_at: oldDate }));
    mockQuery.mockResolvedValueOnce({ rows: staleRows });

    const res = await request(app).get('/fx/rates');

    expect(res.status).toBe(200);
    expect(res.body.data.stale).toBe(true);
  });

  it('returns stale: false when rates are fresh', async () => {
    const freshRows = rateRows.map(r => ({ ...r, fetched_at: new Date() }));
    mockQuery.mockResolvedValueOnce({ rows: freshRows });

    const res = await request(app).get('/fx/rates');

    expect(res.body.data.stale).toBe(false);
  });

  it('returns empty rates when no rates cached yet', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/fx/rates');

    expect(res.status).toBe(200);
    expect(res.body.data.rates).toEqual({});
    expect(res.body.data.stale).toBe(true); // epoch is always stale
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/fx/rates');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/fetch FX rates/i);
  });

  it('is accessible without auth cookie (public endpoint)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: rateRows });

    // No Cookie header
    const res = await request(app).get('/fx/rates');

    expect(res.status).toBe(200);
  });
});
