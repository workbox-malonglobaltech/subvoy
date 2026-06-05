/**
 * Integration tests for the /categories routes.
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

const USER_ID    = 'aaaaaaaa-0000-0000-0000-000000000001';
const CAT_ID     = 'cccccccc-0000-0000-0000-000000000003';
const AUTH_COOKIE = 'token=test-token';

const catRow = {
  id: CAT_ID,
  name: 'Productivity',
  created_at: new Date('2026-04-15T00:00:00Z'),
};

beforeEach(() => {
  mockQuery.mockReset();
});

// ---- GET /categories --------------------------------------------------------

describe('GET /categories', () => {
  it('returns builtin and custom categories', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [catRow] });

    const res = await request(app)
      .get('/categories')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.builtin)).toBe(true);
    expect(res.body.data.builtin).toContain('Entertainment');
    expect(res.body.data.custom).toHaveLength(1);
    expect(res.body.data.custom[0].id).toBe(CAT_ID);
    expect(res.body.data.custom[0].name).toBe('Productivity');
    expect(res.body.error).toBeNull();
  });

  it('returns empty custom array when user has none', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/categories')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data.custom).toHaveLength(0);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/categories');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/categories')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/fetch categories/i);
  });
});

// ---- POST /categories -------------------------------------------------------

describe('POST /categories', () => {
  it('creates a new custom category', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [catRow] });

    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Productivity' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(CAT_ID);
    expect(res.body.data.name).toBe('Productivity');
    expect(res.body.error).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO user_categories'),
      [USER_ID, 'Productivity']
    );
  });

  it('trims whitespace from name', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ ...catRow, name: 'Productivity' }] });

    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: '  Productivity  ' });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Productivity');
  });

  it('rejects empty name with 400', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects missing name with 400', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects name longer than 100 chars with 400', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'a'.repeat(101) });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects case-insensitive duplicate of a built-in category with 409', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'entertainment' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already exists/i);
    // db should NOT be called — rejected before reaching model
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('rejects exact-match duplicate of built-in with 409', async () => {
    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Entertainment' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app)
      .post('/categories')
      .send({ name: 'Productivity' });

    expect(res.status).toBe(401);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .post('/categories')
      .set('Cookie', AUTH_COOKIE)
      .send({ name: 'Productivity' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/create category/i);
  });
});

// ---- DELETE /categories/:id -------------------------------------------------

describe('DELETE /categories/:id', () => {
  it('deletes a category and returns 200', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .delete(`/categories/${CAT_ID}`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM user_categories'),
      [CAT_ID, USER_ID]
    );
  });

  it('returns 404 when category not found or not owned by user', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });

    const res = await request(app)
      .delete(`/categories/${CAT_ID}`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).delete(`/categories/${CAT_ID}`);
    expect(res.status).toBe(401);
  });

  it('returns 500 on db error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .delete(`/categories/${CAT_ID}`)
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/delete category/i);
  });
});
