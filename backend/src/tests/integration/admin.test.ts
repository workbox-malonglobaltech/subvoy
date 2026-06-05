/**
 * Integration tests for superadmin routes:
 *   GET    /admin/users
 *   GET    /admin/users/:id
 *   POST   /admin/users/:id/suspend
 *   POST   /admin/users/:id/unsuspend
 *   PATCH  /admin/users/:id/role
 *   DELETE /admin/users/:id
 *   POST   /admin/users/:id/force-logout
 *   GET    /admin/stats
 */

import request from 'supertest';

// ── Mocks (hoisted before any module that loads them) ─────────────────────────

const SUPERADMIN_ID = 'admin-001';
const STAFF_ID      = 'staff-001';
const TARGET_ID     = 'user-002';

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    const cookie: string = req.cookies?.token ?? '';
    if (!cookie) {
      return _res.status(401).json({ success: false, data: null, error: 'Authentication required' });
    }
    if (cookie === 'superadmin-token') {
      req.user = { id: SUPERADMIN_ID, role: 'superadmin' };
    } else if (cookie === 'staff-token') {
      req.user = { id: STAFF_ID, role: 'staff' };
    } else {
      req.user = { id: 'user-999', role: 'user' };
    }
    next();
  },
}));

jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../jobs/fx.job',       () => ({ startFxJob: jest.fn() }));
jest.mock('../../jobs/wallet.job',   () => ({ startWalletJob: jest.fn() }));
jest.mock('node-cron',               () => ({ schedule: jest.fn() }));

jest.mock('../../services/audit-logger.service', () => ({
  logAudit: jest.fn(),
}));

jest.mock('../../services/error-logger.service', () => ({
  logError: jest.fn(),
  logWarn:  jest.fn(),
  logFatal: jest.fn(),
  recentErrorCount: jest.fn().mockReturnValue(0),
}));

const mockQuery = jest.fn();
jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import app from '../../index';
import { logAudit } from '../../services/audit-logger.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id:           TARGET_ID,
    email:        'target@test.com',
    name:         'Target User',
    password_hash:'$hashed',
    token_version: 0,
    role:         'user',
    suspended_at: null,
    created_at:   new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function enrichmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id:                 TARGET_ID,
    subscription_count: '3',
    ngn_balance:        '500000',
    usd_balance:        '2000',
    ...overrides,
  };
}

const SUPERADMIN_COOKIE = 'token=superadmin-token';
const STAFF_COOKIE      = 'token=staff-token';
const USER_COOKIE       = 'token=user-token';

beforeEach(() => {
  mockQuery.mockReset();
  (logAudit as jest.Mock).mockClear();
});

// ── GET /admin/users ──────────────────────────────────────────────────────────

describe('GET /admin/users', () => {
  it('returns 200 with enriched user list for superadmin', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })              // COUNT for listUsers
      .mockResolvedValueOnce({ rows: [userRow()] })                    // SELECT for listUsers
      .mockResolvedValueOnce({ rows: [enrichmentRow()] });             // enrichment query

    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.users).toHaveLength(1);
    expect(res.body.data.users[0]).toMatchObject({
      id:                TARGET_ID,
      subscriptionCount: 3,
      walletNgnBalance:  5000,
      walletUsdBalance:  20,
    });
    expect(res.body.data.limit).toBe(20);
    expect(res.body.data.offset).toBe(0);
  });

  it('returns 200 with enriched user list for staff', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', STAFF_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(0);
  });

  it('applies search, limit, and offset query params', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/admin/users?search=alice&limit=5&offset=10')
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.data.limit).toBe(5);
    expect(res.body.data.offset).toBe(10);
  });

  it('returns 400 for invalid limit (over 100)', async () => {
    const res = await request(app)
      .get('/admin/users?limit=999')
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for regular users', async () => {
    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', USER_COOKIE);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with no cookie', async () => {
    const res = await request(app).get('/admin/users');
    expect(res.status).toBe(401);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/admin/users')
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ── GET /admin/users/:id ──────────────────────────────────────────────────────

describe('GET /admin/users/:id', () => {
  it('returns 200 with enriched user for superadmin', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })        // findById
      .mockResolvedValueOnce({ rows: [enrichmentRow()] }); // enrichment

    const res = await request(app)
      .get(`/admin/users/${TARGET_ID}`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id:                TARGET_ID,
      subscriptionCount: 3,
      walletNgnBalance:  5000,
      walletUsdBalance:  20,
    });
  });

  it('returns 200 with enriched user for staff', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })
      .mockResolvedValueOnce({ rows: [enrichmentRow()] });

    const res = await request(app)
      .get(`/admin/users/${TARGET_ID}`)
      .set('Cookie', STAFF_COOKIE);

    expect(res.status).toBe(200);
  });

  it('returns 404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get(`/admin/users/${TARGET_ID}`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 403 for regular users', async () => {
    const res = await request(app)
      .get(`/admin/users/${TARGET_ID}`)
      .set('Cookie', USER_COOKIE);

    expect(res.status).toBe(403);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get(`/admin/users/${TARGET_ID}`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(500);
  });
});

// ── POST /admin/users/:id/suspend ─────────────────────────────────────────────

describe('POST /admin/users/:id/suspend', () => {
  it('suspends a non-suspended user and logs audit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })                             // findById (not suspended)
      .mockResolvedValueOnce({ rows: [userRow({ suspended_at: new Date() })] }); // suspendUser RETURNING

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/suspend`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      adminId:    SUPERADMIN_ID,
      action:     'user.suspend',
      targetType: 'user',
      targetId:   TARGET_ID,
    }));
  });

  it('returns 400 when user is already suspended', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [userRow({ suspended_at: new Date() })] });

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/suspend`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already suspended/i);
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('returns 404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/suspend`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(404);
  });

  it('returns 403 for staff (superadmin-only endpoint)', async () => {
    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/suspend`)
      .set('Cookie', STAFF_COOKIE);

    expect(res.status).toBe(403);
  });

  it('returns 500 on DB error', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })
      .mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/suspend`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(500);
  });
});

// ── POST /admin/users/:id/unsuspend ──────────────────────────────────────────

describe('POST /admin/users/:id/unsuspend', () => {
  it('unsuspends a user and logs audit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow({ suspended_at: new Date() })] }) // findById
      .mockResolvedValueOnce({ rows: [userRow()] });                             // unsuspendUser RETURNING

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/unsuspend`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.unsuspend',
    }));
  });

  it('returns 404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/unsuspend`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(404);
  });

  it('returns 403 for staff', async () => {
    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/unsuspend`)
      .set('Cookie', STAFF_COOKIE);

    expect(res.status).toBe(403);
  });
});

// ── PATCH /admin/users/:id/role ───────────────────────────────────────────────

describe('PATCH /admin/users/:id/role', () => {
  it('changes a user role and logs audit with from/to details', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow({ role: 'user' })] })         // findById
      .mockResolvedValueOnce({ rows: [userRow({ role: 'staff' })] });       // setUserRole RETURNING

    const res = await request(app)
      .patch(`/admin/users/${TARGET_ID}/role`)
      .set('Cookie', SUPERADMIN_COOKIE)
      .send({ role: 'staff' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action:  'user.role_change',
      details: { from: 'user', to: 'staff' },
    }));
  });

  it('returns 400 if superadmin tries to change their own role', async () => {
    const res = await request(app)
      .patch(`/admin/users/${SUPERADMIN_ID}/role`)
      .set('Cookie', SUPERADMIN_COOKIE)
      .send({ role: 'user' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot change your own role/i);
  });

  it('returns 400 for invalid role value', async () => {
    const res = await request(app)
      .patch(`/admin/users/${TARGET_ID}/role`)
      .set('Cookie', SUPERADMIN_COOKIE)
      .send({ role: 'god' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .patch(`/admin/users/${TARGET_ID}/role`)
      .set('Cookie', SUPERADMIN_COOKIE)
      .send({ role: 'staff' });

    expect(res.status).toBe(404);
  });

  it('returns 403 for staff', async () => {
    const res = await request(app)
      .patch(`/admin/users/${TARGET_ID}/role`)
      .set('Cookie', STAFF_COOKIE)
      .send({ role: 'user' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when role field is missing', async () => {
    const res = await request(app)
      .patch(`/admin/users/${TARGET_ID}/role`)
      .set('Cookie', SUPERADMIN_COOKIE)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────

describe('DELETE /admin/users/:id', () => {
  it('deletes a user and logs audit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })          // findById
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });     // deleteUser

    const res = await request(app)
      .delete(`/admin/users/${TARGET_ID}`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ deleted: true });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'user.delete',
    }));
  });

  it('returns 400 if superadmin tries to delete themselves', async () => {
    const res = await request(app)
      .delete(`/admin/users/${SUPERADMIN_ID}`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot delete your own account/i);
  });

  it('returns 404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete(`/admin/users/${TARGET_ID}`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(404);
  });

  it('returns 403 for staff', async () => {
    const res = await request(app)
      .delete(`/admin/users/${TARGET_ID}`)
      .set('Cookie', STAFF_COOKIE);

    expect(res.status).toBe(403);
  });

  it('returns 500 on DB error', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })
      .mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .delete(`/admin/users/${TARGET_ID}`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(500);
  });
});

// ── POST /admin/users/:id/force-logout ───────────────────────────────────────

describe('POST /admin/users/:id/force-logout', () => {
  it('increments token version and logs audit', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })  // findById
      .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // incrementTokenVersion

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/force-logout`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ loggedOut: true });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
      action:     'user.force_logout',
      targetId:   TARGET_ID,
    }));
  });

  it('returns 404 when user does not exist', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/force-logout`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(404);
  });

  it('returns 403 for staff', async () => {
    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/force-logout`)
      .set('Cookie', STAFF_COOKIE);

    expect(res.status).toBe(403);
  });

  it('returns 500 on DB error during token increment', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [userRow()] })
      .mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .post(`/admin/users/${TARGET_ID}/force-logout`)
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(500);
  });
});

// ── GET /admin/stats ──────────────────────────────────────────────────────────

describe('GET /admin/stats', () => {
  function statsCountRow(n: number) {
    return { rows: [{ count: String(n) }] };
  }

  it('returns 200 with all integer stat counts for superadmin', async () => {
    mockQuery
      .mockResolvedValueOnce(statsCountRow(120))  // totalUsers
      .mockResolvedValueOnce(statsCountRow(45))   // activeSubscriptions
      .mockResolvedValueOnce(statsCountRow(8))    // newUsersLast7Days
      .mockResolvedValueOnce(statsCountRow(3))    // errorsLast24h
      .mockResolvedValueOnce(statsCountRow(12))   // unresolvedErrors
      .mockResolvedValueOnce(statsCountRow(2));   // unreadAdminNotifications

    const res = await request(app)
      .get('/admin/stats')
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(res.body.data).toEqual({
      totalUsers:                120,
      activeSubscriptions:       45,
      newUsersLast7Days:         8,
      errorsLast24h:             3,
      unresolvedErrors:          12,
      unreadAdminNotifications:  2,
    });
    // All values must be integers, not strings
    Object.values(res.body.data as Record<string, unknown>).forEach(v => {
      expect(typeof v).toBe('number');
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  it('returns 200 for staff role', async () => {
    mockQuery
      .mockResolvedValueOnce(statsCountRow(0))
      .mockResolvedValueOnce(statsCountRow(0))
      .mockResolvedValueOnce(statsCountRow(0))
      .mockResolvedValueOnce(statsCountRow(0))
      .mockResolvedValueOnce(statsCountRow(0))
      .mockResolvedValueOnce(statsCountRow(0));

    const res = await request(app)
      .get('/admin/stats')
      .set('Cookie', STAFF_COOKIE);

    expect(res.status).toBe(200);
  });

  it('returns 403 for regular users', async () => {
    const res = await request(app)
      .get('/admin/stats')
      .set('Cookie', USER_COOKIE);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with no cookie', async () => {
    const res = await request(app).get('/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 500 when any parallel query throws', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .get('/admin/stats')
      .set('Cookie', SUPERADMIN_COOKIE);

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/failed to fetch admin stats/i);
  });
});
