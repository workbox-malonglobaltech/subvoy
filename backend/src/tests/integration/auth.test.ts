/**
 * Integration tests for the /auth routes.
 *
 * Dependencies mocked:
 *   - ../../db              → pool.query returns deterministic fixtures keyed by SQL content
 *   - ../../services/auth.service → hashPassword, comparePassword, signToken, verifyToken
 *   - ../../jobs/reminder.job     → prevents the cron job from starting
 *
 * Run with:  npx jest src/tests/integration/auth.test.ts
 */

import request from 'supertest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any import that loads the mocked modules
// ---------------------------------------------------------------------------

jest.mock('../../db', () => ({
  pool: { query: jest.fn() },
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

// ---------------------------------------------------------------------------
// Import app AFTER mocks are hoisted
// ---------------------------------------------------------------------------

import app from '../../index';
import { pool } from '../../db';
import { comparePassword } from '../../services/auth.service';

// ---------------------------------------------------------------------------
// Helpers / fixtures
// ---------------------------------------------------------------------------

const USER_ID = 'user-123';
const AUTH_COOKIE = 'token=mock-jwt';

const existingUserRow = {
  id: USER_ID,
  email: 'test@test.com',
  name: 'Test',
  password_hash: '$hashed',
  token_version: 0,
  created_at: new Date('2026-04-01T00:00:00Z'),
};

const newUserRow = {
  id: USER_ID,
  email: 'new@test.com',
  name: 'New',
  password_hash: '$hashed',
  token_version: 0,
  created_at: new Date('2026-04-01T00:00:00Z'),
};

/**
 * Central mock implementation for pool.query.
 * Inspects the SQL string to return the appropriate fixture.
 */
function buildQueryMock(overrides: { existingUser?: boolean } = {}) {
  return (sql: string) => {
    const s = sql.trim().toUpperCase();

    // INSERT users → return new user row
    if (s.startsWith('INSERT INTO USERS')) {
      return Promise.resolve({ rows: [newUserRow] });
    }

    // SELECT password_hash FROM users (getPasswordHash — single column select)
    // Must check before broader PASSWORD_HASH matches like findByEmail
    if (s.startsWith('SELECT PASSWORD_HASH FROM USERS')) {
      return Promise.resolve({ rows: [{ password_hash: '$hashed' }] });
    }

    // SELECT token_version FROM users WHERE id (getTokenVersion — single column select)
    if (s.startsWith('SELECT TOKEN_VERSION FROM USERS')) {
      return Promise.resolve({ rows: [{ token_version: 0 }] });
    }

    // SELECT ... FROM users WHERE email (findByEmail — multi-column select with password_hash + token_version)
    if (s.includes('FROM USERS') && s.includes('WHERE EMAIL')) {
      if (overrides.existingUser) {
        return Promise.resolve({ rows: [existingUserRow] });
      }
      // Default: no existing user (used by register happy-path)
      return Promise.resolve({ rows: [] });
    }

    // SELECT ... FROM users WHERE id (findById — multi-column select)
    if (s.includes('FROM USERS') && s.includes('WHERE ID')) {
      return Promise.resolve({ rows: [existingUserRow] });
    }

    // UPDATE users (incrementTokenVersion on logout, updatePasswordHash on password change)
    if (s.startsWith('UPDATE USERS')) {
      return Promise.resolve({ rows: [] });
    }

    // Default fallback
    return Promise.resolve({ rows: [] });
  };
}

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
// POST /auth/register
// ---------------------------------------------------------------------------

describe('POST /auth/register', () => {
  it('returns 201 and sets an httpOnly cookie when given valid credentials', async () => {
    // No existing user → INSERT succeeds
    mockQuery.mockImplementation(buildQueryMock({ existingUser: false }));

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@test.com', password: 'Secure1234!', name: 'New' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({ email: 'new@test.com' });
    // Cookie must be present
    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.startsWith('token='))).toBe(true);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@test.com', password: 'Short1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password has no uppercase letter', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@test.com', password: 'alllowercase1234' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password has no digit', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@test.com', password: 'NoDigitsHere!!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email is malformed', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'Secure1234!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ password: 'Secure1234!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when email is already registered', async () => {
    // Simulate existing user returned by findByEmail
    mockQuery.mockImplementation(buildQueryMock({ existingUser: true }));

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com', password: 'Secure1234!', name: 'Test' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/already in use/i);
  });

  it('returns 500 when the database throws during INSERT', async () => {
    // First call (findByEmail) returns empty, second call (INSERT) throws
    mockQuery
      .mockResolvedValueOnce({ rows: [] })           // findByEmail → no existing user
      .mockRejectedValueOnce(new Error('db down'));   // INSERT → failure

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'new@test.com', password: 'Secure1234!', name: 'New' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------

describe('POST /auth/login', () => {
  it('returns 200 and sets an httpOnly cookie with valid credentials', async () => {
    mockQuery.mockImplementation(buildQueryMock({ existingUser: true }));
    (comparePassword as jest.Mock).mockResolvedValue(true);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'Secure1234!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({ email: 'test@test.com' });
    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.startsWith('token='))).toBe(true);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
  });

  it('returns 401 when password does not match', async () => {
    mockQuery.mockImplementation(buildQueryMock({ existingUser: true }));
    (comparePassword as jest.Mock).mockResolvedValue(false);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@test.com', password: 'WrongPass9!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/invalid email or password/i);
  });

  it('returns 401 when the user does not exist', async () => {
    // findByEmail → no rows; getPasswordHash → no rows
    mockQuery.mockResolvedValue({ rows: [] });
    (comparePassword as jest.Mock).mockResolvedValue(false);

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'ghost@test.com', password: 'SomePass1234!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ password: 'Secure1234!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when body is empty', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------

describe('POST /auth/logout', () => {
  it('returns 200 and clears the token cookie for an authenticated user', async () => {
    // authenticate middleware: verifyToken returns { userId, tokenVersion: 0 }
    // getTokenVersion query returns token_version: 0 (versions match → auth passes)
    mockQuery.mockImplementation(buildQueryMock({ existingUser: true }));

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    // Cookie should be cleared (Max-Age=0 or Expires in the past)
    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
    expect(tokenCookie).toBeDefined();
    expect(tokenCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });

  it('returns 401 when no auth cookie is provided', async () => {
    const res = await request(app).post('/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('still returns 200 even when the DB update for token revocation fails', async () => {
    // The authenticate middleware runs two queries before the route handler:
    // getTokenVersion (version check) and findById (suspension check). Both must
    // succeed so authentication passes; only then does the route's
    // incrementTokenVersion UPDATE run — and that is the call we want to fail.
    mockQuery
      .mockResolvedValueOnce({ rows: [{ token_version: 0 }] }) // getTokenVersion (middleware)
      .mockResolvedValueOnce({ rows: [existingUserRow] })       // findById (middleware)
      .mockRejectedValueOnce(new Error('db timeout'));           // incrementTokenVersion (route)

    const res = await request(app)
      .post('/auth/logout')
      .set('Cookie', AUTH_COOKIE);

    // The route catches the error and still clears the cookie
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

describe('GET /auth/me', () => {
  it('returns 200 with the user object for an authenticated request', async () => {
    mockQuery.mockImplementation(buildQueryMock({ existingUser: true }));

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toMatchObject({
      id: USER_ID,
      email: 'test@test.com',
      name: 'Test',
    });
    // createdAt should be an ISO string, not a raw Date object
    expect(typeof res.body.data.createdAt).toBe('string');
    // Password hash must never be exposed
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.password_hash).toBeUndefined();
  });

  it('returns 401 when no auth cookie is provided', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when the authenticated user is no longer in the database', async () => {
    // The authenticate middleware itself re-verifies the user against the DB
    // (getTokenVersion + findById) BEFORE the route handler runs. If the user
    // has been deleted, the middleware short-circuits with 401 "Session expired"
    // — this is the intended hardened contract: a valid-looking token for a
    // non-existent user must be treated as an invalid session, not surfaced as
    // a 404 (which would leak that the account is simply gone).
    mockQuery
      .mockResolvedValueOnce({ rows: [{ token_version: 0 }] }) // getTokenVersion (middleware)
      .mockResolvedValueOnce({ rows: [] });                     // findById (middleware) → user deleted

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/session expired/i);
  });

  it('returns 401 when the database throws during authentication', async () => {
    // findById in the authenticate middleware throws. The middleware's catch
    // block converts any thrown error into a 401 ("Invalid or expired token")
    // rather than letting it bubble to a 500 — failing closed is the secure
    // contract for an auth gate.
    mockQuery
      .mockResolvedValueOnce({ rows: [{ token_version: 0 }] }) // getTokenVersion (middleware)
      .mockRejectedValueOnce(new Error('db down'));              // findById (middleware) → throws

    const res = await request(app)
      .get('/auth/me')
      .set('Cookie', AUTH_COOKIE);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
