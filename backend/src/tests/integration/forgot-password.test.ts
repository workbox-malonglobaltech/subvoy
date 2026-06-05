/**
 * Integration tests for /auth/forgot-password and /auth/reset-password routes.
 *
 * Dependencies mocked:
 *   - ../../db                  → pool.query returns deterministic fixtures
 *   - ../../services/auth.service
 *   - ../../services/email.service → sendPasswordResetEmail is a no-op spy
 *   - ../../jobs/reminder.job   → startReminderJob no-op
 *   - node-cron                 → schedule no-op
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
  hashPassword: jest.fn().mockResolvedValue('$hashed$newpassword'),
  comparePassword: jest.fn(),
  signToken: jest.fn(),
}));

const mockSendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);

jest.mock('../../services/email.service', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
  sendReminderEmail: jest.fn(),
  sendBudgetAlertEmail: jest.fn(),
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

const USER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

const userRow = {
  id: USER_ID,
  name: 'Test User',
  email: 'test@example.com',
  token_version: 0,
  created_at: new Date('2026-01-01T00:00:00Z'),
};

const validTokenRow = {
  id: 'tttttttt-0000-0000-0000-000000000009',
  user_id: USER_ID,
  token_hash: 'anyhash',
  expires_at: new Date(Date.now() + 3_600_000), // 1 hour from now
  used_at: null,
};

beforeEach(() => {
  mockQuery.mockReset();
  mockSendPasswordResetEmail.mockClear();
});

// ---- POST /auth/forgot-password ---------------------------------------------

describe('POST /auth/forgot-password', () => {
  it('returns 200 and sends email when user exists', async () => {
    // Query 1: SELECT user, Query 2: DELETE old tokens, Query 3: INSERT new token
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow] })  // user lookup
      .mockResolvedValueOnce({ rows: [] })          // DELETE old tokens
      .mockResolvedValueOnce({ rows: [] });         // INSERT new token

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toMatch(/reset link/i);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'test@example.com' })
    );
  });

  it('returns 200 without sending email when user does not exist (prevents enumeration)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user not found

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('returns 200 even when email send fails (does not surface error)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    mockSendPasswordResetEmail.mockRejectedValueOnce(new Error('Resend 403'));

    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'test@example.com' });

    // Must still return 200 — never reveal email send failure
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects invalid email with 400', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing email with 400', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---- POST /auth/reset-password ----------------------------------------------

describe('POST /auth/reset-password', () => {
  it('resets password with valid token', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [validTokenRow] }) // token lookup
      .mockResolvedValueOnce({ rows: [] })               // UPDATE users password
      .mockResolvedValueOnce({ rows: [] });              // UPDATE token used_at

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'rawtoken123', newPassword: 'NewPassword1!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();

    // Password update query
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining(['$hashed$newpassword', USER_ID])
    );
    // Token marked used
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE password_reset_tokens'),
      [validTokenRow.id]
    );
  });

  it('returns 400 for invalid/non-existent token', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // token not found

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'badtoken', newPassword: 'NewPassword1!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('returns 400 for expired token', async () => {
    const expiredRow = { ...validTokenRow, expires_at: new Date(Date.now() - 1000) };
    mockQuery.mockResolvedValueOnce({ rows: [expiredRow] });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'rawtoken123', newPassword: 'NewPassword1!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('returns 400 for already-used token', async () => {
    const usedRow = { ...validTokenRow, used_at: new Date('2026-04-14T00:00:00Z') };
    mockQuery.mockResolvedValueOnce({ rows: [usedRow] });

    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'rawtoken123', newPassword: 'NewPassword1!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  it('rejects weak password — too short', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'rawtoken123', newPassword: 'short1A' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects weak password — no uppercase', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'rawtoken123', newPassword: 'alllowercase1!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects weak password — no number', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'rawtoken123', newPassword: 'NoNumbersHere!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing token with 400', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ newPassword: 'NewPassword1!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing newPassword with 400', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ token: 'rawtoken123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
