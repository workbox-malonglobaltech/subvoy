/**
 * Integration tests for the /reports routes.
 *
 * Endpoints covered:
 *   GET  /reports/payments
 *   POST /reports/email
 *
 * Dependencies mocked:
 *   - ../../middleware/authenticate    → injects req.user synchronously
 *   - ../../jobs/reminder.job          → prevents cron from starting
 *   - ../../jobs/fx.job                → prevents cron from starting
 *   - node-cron                        → schedule() is a no-op
 *   - ../../db                         → pool.query returns controlled fixtures
 *   - ../../models/user                → findById returns controlled fixtures
 *   - ../../services/email.service     → sendPaymentReportEmail is a spy
 *
 * Run with:  npx jest src/tests/integration/reports.test.ts
 */

import request from 'supertest';

// ---------------------------------------------------------------------------
// Module mocks — declared BEFORE any import that loads the mocked modules
// ---------------------------------------------------------------------------

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (!req.cookies?.token) {
      return res
        .status(401)
        .json({ success: false, data: null, error: 'Authentication required' });
    }
    req.user = { id: 'user-reports-001' };
    next();
  },
}));

jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../jobs/fx.job', () => ({ startFxJob: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const mockQuery = jest.fn();
jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../models/user', () => ({
  findById: jest.fn(),
}));

jest.mock('../../services/email.service', () => ({
  sendPaymentReportEmail: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import app + mocked modules AFTER jest.mock declarations
// ---------------------------------------------------------------------------

import app from '../../index';
import * as userModel from '../../models/user';
import { sendPaymentReportEmail } from '../../services/email.service';

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-reports-001';
const AUTH_COOKIE = 'token=fake';

/** A wallet_transactions row as returned by pg (BIGINT → string). */
function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-001',
    description: 'Paid: Netflix',
    currency: 'USD',
    amount: '1500',         // 1500 cents → $15 after / 100
    balance_after: '5000',  // 5000 cents → $50 after / 100
    created_at: new Date('2026-04-01T10:00:00Z'),
    ...overrides,
  };
}

const sampleEmailPayments = [
  {
    id: 'tx-001',
    description: 'Paid: Netflix',
    currency: 'USD',
    amount: 15,
    paidAt: '2026-04-01T10:00:00Z',
  },
];

const mockFindById = userModel.findById as jest.Mock;
const mockSendEmail = sendPaymentReportEmail as jest.Mock;

beforeEach(() => {
  mockQuery.mockReset();
  mockFindById.mockReset();
  mockSendEmail.mockReset();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// GET /reports/payments
// ---------------------------------------------------------------------------

describe('GET /reports/payments', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/reports/payments');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 200 with payments, amounts divided by 100', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow()] });

    const res = await request(app)
      .get('/reports/payments')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const p = res.body.data[0];
    expect(p.id).toBe('tx-001');
    expect(p.description).toBe('Paid: Netflix');
    expect(p.currency).toBe('USD');
    expect(p.amount).toBe(15);       // 1500 / 100
    expect(p.balanceAfter).toBe(50); // 5000 / 100
    expect(typeof p.paidAt).toBe('string');
  });

  it('returns an empty array when there are no matching payments', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/reports/payments')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  it('passes from/to parameters to the database query', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [paymentRow()] });

    const res = await request(app)
      .get('/reports/payments?from=2026-01-01&to=2026-04-30')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('wallet_transactions'),
      expect.arrayContaining([USER_ID, '2026-01-01', '2026-04-30']),
    );
  });

  it('returns 400 when the from date is not YYYY-MM-DD', async () => {
    const res = await request(app)
      .get('/reports/payments?from=01-01-2026')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when the to date is not YYYY-MM-DD', async () => {
    const res = await request(app)
      .get('/reports/payments?to=April-30-2026')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when limit exceeds 500', async () => {
    const res = await request(app)
      .get('/reports/payments?limit=501')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when limit is less than 1', async () => {
    const res = await request(app)
      .get('/reports/payments?limit=0')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when limit is not a number', async () => {
    const res = await request(app)
      .get('/reports/payments?limit=abc')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the database throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/reports/payments')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/payment history/i);
  });
});

// ---------------------------------------------------------------------------
// POST /reports/email
// ---------------------------------------------------------------------------

describe('POST /reports/email', () => {
  it('returns 401 without auth cookie', async () => {
    const res = await request(app)
      .post('/reports/email')
      .send({ payments: sampleEmailPayments });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('sends the report and returns { sent: true }', async () => {
    mockFindById.mockResolvedValueOnce({
      id: USER_ID,
      email: 'test@test.com',
      name: 'Test User',
    });
    mockSendEmail.mockResolvedValueOnce(undefined);

    const res = await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({ payments: sampleEmailPayments });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ sent: true });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@test.com',
        name: 'Test User',
        periodLabel: 'All time',
        payments: expect.arrayContaining([
          expect.objectContaining({ name: 'Netflix', currency: 'USD', amount: 15 }),
        ]),
      }),
    );
  });

  it('strips "Paid: " prefix from description before emailing', async () => {
    mockFindById.mockResolvedValueOnce({ id: USER_ID, email: 'a@b.com', name: 'A' });
    mockSendEmail.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({
        payments: [{ ...sampleEmailPayments[0], description: 'Paid: Spotify' }],
      });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        payments: expect.arrayContaining([
          expect.objectContaining({ name: 'Spotify' }),
        ]),
      }),
    );
  });

  it('uses "YYYY-MM-DD to YYYY-MM-DD" periodLabel when both from and to are provided', async () => {
    mockFindById.mockResolvedValueOnce({ id: USER_ID, email: 'a@b.com', name: 'A' });
    mockSendEmail.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({ from: '2026-01-01', to: '2026-03-31', payments: sampleEmailPayments });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ periodLabel: '2026-01-01 to 2026-03-31' }),
    );
  });

  it('uses "From YYYY-MM-DD" periodLabel when only from is provided', async () => {
    mockFindById.mockResolvedValueOnce({ id: USER_ID, email: 'a@b.com', name: 'A' });
    mockSendEmail.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({ from: '2026-02-01', payments: sampleEmailPayments });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ periodLabel: 'From 2026-02-01' }),
    );
  });

  it('uses "Until YYYY-MM-DD" periodLabel when only to is provided', async () => {
    mockFindById.mockResolvedValueOnce({ id: USER_ID, email: 'a@b.com', name: 'A' });
    mockSendEmail.mockResolvedValueOnce(undefined);

    await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({ to: '2026-04-30', payments: sampleEmailPayments });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ periodLabel: 'Until 2026-04-30' }),
    );
  });

  it('returns 401 when the user is not found in the database', async () => {
    mockFindById.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({ payments: sampleEmailPayments });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/user not found/i);
  });

  it('returns 400 when the payments field is missing', async () => {
    const res = await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when a payment item is missing required fields', async () => {
    const res = await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({ payments: [{ id: 'tx-1' }] }); // missing description, currency, amount, paidAt

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when the currency code is not exactly 3 characters', async () => {
    const res = await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({
        payments: [{ ...sampleEmailPayments[0], currency: 'US' }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 when the email service throws', async () => {
    mockFindById.mockResolvedValueOnce({ id: USER_ID, email: 'a@b.com', name: 'A' });
    mockSendEmail.mockRejectedValueOnce(new Error('SMTP failure'));

    const res = await request(app)
      .post('/reports/email')
      .set('Cookie', AUTH_COOKIE)
      .send({ payments: sampleEmailPayments });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/report email/i);
  });
});
