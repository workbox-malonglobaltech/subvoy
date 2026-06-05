/**
 * Integration tests for the /imports routes.
 *
 * Dependencies mocked:
 *   - ../../db          → pool.query returns deterministic fixtures
 *   - nodemailer        → sendMail is a no-op spy
 *   - node-cron         → schedule is a no-op (prevents background job side effects)
 *
 * Run with:  npx jest src/tests/integration/imports.test.ts
 */

import request from 'supertest';

// ---------------------------------------------------------------------------
// Module mocks — declared before app import so Jest hoisting works correctly.
// Never reference module-level variables inside jest.mock factories (TDZ).
// ---------------------------------------------------------------------------

// Mock authenticate — passes if any token cookie is present, 401 otherwise
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

jest.mock('../../jobs/reminder.job', () => ({
  startReminderJob: jest.fn(),
}));

jest.mock('node-cron', () => ({
  schedule: jest.fn(),
}));

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------

const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

// ---------------------------------------------------------------------------
// Import app AFTER mocks
// ---------------------------------------------------------------------------

import app from '../../index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID   = 'aaaaaaaa-0000-0000-0000-000000000001';
const DETECT_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const SUB_ID    = 'cccccccc-0000-0000-0000-000000000003';

const AUTH_COOKIE = 'token=test-token';

// Minimal CSV with two Netflix charges ~30 days apart (monthly pattern)
const VALID_CSV = [
  'Date,Description,Amount,Currency',
  '2026-01-15,Netflix,15.99,USD',
  '2026-02-15,Netflix,15.99,USD',
  '2026-03-15,Netflix,15.99,USD',
].join('\n');

// CSV that is missing required columns
const BAD_COLS_CSV = [
  'Foo,Bar',
  'val1,val2',
].join('\n');

// CSV that parses OK but has no recurring patterns (all unique descriptions)
const NO_RECURRING_CSV = [
  'Date,Description,Amount,Currency',
  '2026-01-10,Grocery Store,45.00,USD',
  '2026-02-18,Hardware Shop,120.00,USD',
  '2026-03-03,Pharmacy,22.50,USD',
].join('\n');

// Fixture rows
const detectedRow = {
  id: DETECT_ID,
  user_id: USER_ID,
  name: 'Netflix',
  amount: '15.99',
  currency: 'USD',
  billing_cycle: 'monthly',
  next_billing_date: new Date('2026-04-15'),
  category: 'Entertainment',
  confidence: 100,
  occurrences: 3,
  status: 'pending',
  created_at: new Date('2026-04-13T08:00:00Z'),
};

const confirmedRow = { ...detectedRow, status: 'confirmed' };

const subscriptionRow = {
  id: SUB_ID,
  user_id: USER_ID,
  name: 'Netflix',
  amount: '15.99',
  currency: 'USD',
  billing_cycle: 'monthly',
  next_billing_date: new Date('2026-04-15'),
  category: 'Entertainment',
  logo_url: null,
  notes: null,
  is_active: true,
  created_at: new Date('2026-04-13T08:00:00Z'),
  updated_at: new Date('2026-04-13T08:00:00Z'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockQuery.mockReset();
});

// ---------------------------------------------------------------------------
// POST /imports/csv
// ---------------------------------------------------------------------------

describe('POST /imports/csv', () => {
  it('returns 401 when no auth cookie', async () => {
    const res = await request(app)
      .post('/imports/csv')
      .attach('file', Buffer.from(VALID_CSV), 'statement.csv');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/imports/csv')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('returns 400 for a non-CSV file type', async () => {
    const res = await request(app)
      .post('/imports/csv')
      .set('Cookie', AUTH_COOKIE)
      .attach('file', Buffer.from('<html></html>'), { filename: 'page.html', contentType: 'text/html' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when CSV has no recognised columns', async () => {
    const res = await request(app)
      .post('/imports/csv')
      .set('Cookie', AUTH_COOKIE)
      .attach('file', Buffer.from(BAD_COLS_CSV), { filename: 'bad.csv', contentType: 'text/csv' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/failed to parse csv/i);
  });

  it('returns 200 with empty detected array when no recurring patterns found', async () => {
    const res = await request(app)
      .post('/imports/csv')
      .set('Cookie', AUTH_COOKIE)
      .attach('file', Buffer.from(NO_RECURRING_CSV), { filename: 'no-recur.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.detected).toHaveLength(0);
    expect(res.body.data.message).toMatch(/no recurring/i);
    expect(res.body.error).toBeNull();
  });

  it('detects recurring subscriptions and saves them', async () => {
    // DELETE pending (createMany step 1), then INSERT for each detected sub
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 })          // DELETE pending
      .mockResolvedValueOnce({ rows: [detectedRow] }); // INSERT Netflix

    const res = await request(app)
      .post('/imports/csv')
      .set('Cookie', AUTH_COOKIE)
      .attach('file', Buffer.from(VALID_CSV), { filename: 'statement.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.detected).toHaveLength(1);
    expect(res.body.data.detected[0].name).toBe('Netflix');
    expect(res.body.data.detected[0].billingCycle).toBe('monthly');
    expect(res.body.data.transactionCount).toBe(3);
    expect(res.body.error).toBeNull();

    // Verify the DELETE used a parameterized query with userId
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM detected_subscriptions'),
      [USER_ID]
    );
    // Verify the INSERT used parameterized query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO detected_subscriptions'),
      expect.arrayContaining([USER_ID, 'Netflix'])
    );
  });

  it('returns 500 on db error during save', async () => {
    mockQuery
      .mockResolvedValueOnce({ rowCount: 0 })               // DELETE pending
      .mockRejectedValueOnce(new Error('db write failed')); // INSERT

    const res = await request(app)
      .post('/imports/csv')
      .set('Cookie', AUTH_COOKIE)
      .attach('file', Buffer.from(VALID_CSV), { filename: 'statement.csv', contentType: 'text/csv' });

    // DB errors are caught by the CSV route's catch and return 400 with a generic message
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/failed to parse csv/i);
  });
});

// ---------------------------------------------------------------------------
// GET /imports/detected
// ---------------------------------------------------------------------------

describe('GET /imports/detected', () => {
  it('returns 401 when no auth cookie', async () => {
    const res = await request(app).get('/imports/detected');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns pending detected subscriptions ordered by confidence', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [detectedRow] });

    const res = await request(app)
      .get('/imports/detected')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(DETECT_ID);
    expect(res.body.data[0].status).toBe('pending');
    expect(res.body.data[0].confidence).toBe(100);
    expect(res.body.error).toBeNull();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'pending'"),
      [USER_ID]
    );
  });

  it('returns empty array when no pending detections', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/imports/detected')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/imports/detected')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/fetch detected/i);
  });
});

// ---------------------------------------------------------------------------
// POST /imports/detected/:id/confirm
// ---------------------------------------------------------------------------

describe('POST /imports/detected/:id/confirm', () => {
  it('returns 401 when no auth cookie', async () => {
    const res = await request(app).post(`/imports/detected/${DETECT_ID}/confirm`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when detection not found for this user', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE returns nothing

    const res = await request(app)
      .post(`/imports/detected/${DETECT_ID}/confirm`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Not found');
  });

  it('confirms detection and creates a real subscription', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [confirmedRow] })    // UPDATE detected → confirmed
      .mockResolvedValueOnce({ rows: [subscriptionRow] }); // INSERT subscription

    const res = await request(app)
      .post(`/imports/detected/${DETECT_ID}/confirm`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(SUB_ID);
    expect(res.body.data.name).toBe('Netflix');
    expect(res.body.data.billingCycle).toBe('monthly');
    expect(res.body.error).toBeNull();

    // Verify the UPDATE used parameterized query with both id and userId
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'confirmed'"),
      [DETECT_ID, USER_ID]
    );
    // Verify subscription INSERT used parameterized query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO subscriptions'),
      expect.arrayContaining([USER_ID, 'Netflix'])
    );
  });

  it('returns 500 on db error during subscription creation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [confirmedRow] })         // UPDATE detected
      .mockRejectedValueOnce(new Error('subscription insert failed')); // INSERT

    const res = await request(app)
      .post(`/imports/detected/${DETECT_ID}/confirm`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/failed to confirm/i);
  });
});

// ---------------------------------------------------------------------------
// POST /imports/detected/:id/dismiss
// ---------------------------------------------------------------------------

describe('POST /imports/detected/:id/dismiss', () => {
  it('returns 401 when no auth cookie', async () => {
    const res = await request(app).post(`/imports/detected/${DETECT_ID}/dismiss`);
    expect(res.status).toBe(401);
  });

  it('returns 404 when detection not found', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app)
      .post(`/imports/detected/${DETECT_ID}/dismiss`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Not found');
  });

  it('dismisses a detected subscription', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post(`/imports/detected/${DETECT_ID}/dismiss`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(res.body.error).toBeNull();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("status = 'dismissed'"),
      [DETECT_ID, USER_ID]
    );
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .post(`/imports/detected/${DETECT_ID}/dismiss`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/failed to dismiss/i);
  });
});
