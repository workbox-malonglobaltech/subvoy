/**
 * Integration tests for the /notifications routes.
 *
 * Dependencies mocked:
 *   - ../db          → pool.query returns deterministic fixtures
 *   - nodemailer     → sendMail is a no-op spy
 *   - node-cron      → schedule is a no-op (prevents background job side effects)
 *
 * Run with:  npx jest src/tests/integration/notifications.test.ts
 * (Requires Jest + ts-jest + supertest installed as devDependencies)
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
// DB mock — centralised so individual tests can override rows
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

const USER_ID  = 'aaaaaaaa-0000-0000-0000-000000000001';
const SUB_ID   = 'bbbbbbbb-0000-0000-0000-000000000002';
const NOTIF_ID = 'cccccccc-0000-0000-0000-000000000003';

// Cookie value doesn't matter — authenticate is mocked to always pass
const AUTH_COOKIE = 'token=test-token';

// Fixture rows
const notifRow = {
  id: NOTIF_ID,
  user_id: USER_ID,
  subscription_id: SUB_ID,
  type: 'payment_reminder',
  title: 'Netflix renews in 2 days',
  message: 'Your Netflix subscription ($15.99) is due on May 1, 2026.',
  is_read: false,
  created_at: new Date('2026-04-13T08:00:00Z'),
};

const prefRow = {
  id: 'dddddddd-0000-0000-0000-000000000004',
  user_id: USER_ID,
  email_enabled: true,
  days_before: 3,
  budget_alert_enabled: false,
  budget_limit: null,
  updated_at: new Date('2026-04-13T08:00:00Z'),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockQuery.mockReset();
});

// ---- GET /notifications ---------------------------------------------------

describe('GET /notifications', () => {
  it('returns notifications list and unread count', async () => {
    // First call → findAllByUser, second call → countUnread
    mockQuery
      .mockResolvedValueOnce({ rows: [notifRow] })       // findAllByUser
      .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // countUnread

    const res = await request(app)
      .get('/notifications')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notifications).toHaveLength(1);
    expect(res.body.data.notifications[0].id).toBe(NOTIF_ID);
    expect(res.body.data.notifications[0].isRead).toBe(false);
    expect(res.body.data.unreadCount).toBe(1);
    expect(res.body.error).toBeNull();
  });

  it('returns 401 when no auth cookie', async () => {
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/notifications')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/fetch notifications/i);
  });
});

// ---- PUT /notifications/read-all -----------------------------------------

describe('PUT /notifications/read-all', () => {
  it('marks all notifications as read', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/notifications/read-all')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();

    // Verify parameterized query was called with the right userId
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_read = TRUE'),
      [USER_ID]
    );
  });
});

// ---- PUT /notifications/:id/read -----------------------------------------

describe('PUT /notifications/:id/read', () => {
  it('marks a single notification as read', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put(`/notifications/${NOTIF_ID}/read`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('is_read = TRUE'),
      [NOTIF_ID, USER_ID]
    );
  });
});

// ---- GET /notifications/preferences --------------------------------------

describe('GET /notifications/preferences', () => {
  it('returns upserted preference row with budget fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [prefRow] });

    const res = await request(app)
      .get('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.emailEnabled).toBe(true);
    expect(res.body.data.daysBefore).toBe(3);
    expect(res.body.data.userId).toBe(USER_ID);
    expect(res.body.data.budgetAlertEnabled).toBe(false);
    expect(res.body.data.budgetLimit).toBeNull();
  });

  it('returns budget limit as number when set', async () => {
    const withLimit = { ...prefRow, budget_alert_enabled: true, budget_limit: '150.00' };
    mockQuery.mockResolvedValueOnce({ rows: [withLimit] });

    const res = await request(app)
      .get('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data.budgetAlertEnabled).toBe(true);
    expect(res.body.data.budgetLimit).toBe(150);
  });
});

// ---- PUT /notifications/preferences --------------------------------------

describe('PUT /notifications/preferences', () => {
  it('updates preferences with valid body', async () => {
    const updatedPref = { ...prefRow, email_enabled: false, days_before: 7 };
    mockQuery.mockResolvedValueOnce({ rows: [updatedPref] });

    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ emailEnabled: false, daysBefore: 7 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.emailEnabled).toBe(false);
    expect(res.body.data.daysBefore).toBe(7);
  });

  it('rejects daysBefore < 1', async () => {
    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ daysBefore: 0 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/daysBefore/i);
  });

  it('rejects daysBefore > 14', async () => {
    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ daysBefore: 15 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects non-boolean emailEnabled', async () => {
    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ emailEnabled: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('saves budgetAlertEnabled and budgetLimit', async () => {
    const updatedPref = { ...prefRow, budget_alert_enabled: true, budget_limit: '100.00' };
    mockQuery.mockResolvedValueOnce({ rows: [updatedPref] });

    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ budgetAlertEnabled: true, budgetLimit: 100 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.budgetAlertEnabled).toBe(true);
    expect(res.body.data.budgetLimit).toBe(100);
  });

  it('allows clearing budgetLimit to null', async () => {
    const cleared = { ...prefRow, budget_alert_enabled: false, budget_limit: null };
    mockQuery.mockResolvedValueOnce({ rows: [cleared] });

    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ budgetAlertEnabled: false, budgetLimit: null });

    expect(res.status).toBe(200);
    expect(res.body.data.budgetLimit).toBeNull();
  });

  it('rejects negative budgetLimit', async () => {
    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ budgetAlertEnabled: true, budgetLimit: -50 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects non-boolean budgetAlertEnabled', async () => {
    const res = await request(app)
      .put('/notifications/preferences')
      .set('Cookie', AUTH_COOKIE)
      .send({ budgetAlertEnabled: 'yes' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---- POST /notifications/scan --------------------------------------------

describe('POST /notifications/scan', () => {
  it('runs reminder scan and returns success', async () => {
    // runReminderScan makes three unconditional queries: DueSubscription JOIN,
    // BudgetRows JOIN, and PriceChange JOIN. Return empty rows for all three.
    mockQuery.mockResolvedValueOnce({ rows: [] }); // due subscriptions
    mockQuery.mockResolvedValueOnce({ rows: [] }); // budget rows
    mockQuery.mockResolvedValueOnce({ rows: [] }); // price change rows

    const res = await request(app)
      .post('/notifications/scan')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe('Scan complete');
  });

  it('returns 500 when scan throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('query failed'));

    const res = await request(app)
      .post('/notifications/scan')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/scan failed/i);
  });
});
