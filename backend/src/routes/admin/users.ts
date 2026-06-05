import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin, requireRole } from '../../middleware/requireAdmin';
import { pool } from '../../db';
import {
  listUsers,
  findById,
  suspendUser,
  unsuspendUser,
  setUserRole,
  deleteUser,
  incrementTokenVersion,
} from '../../models/user';
import { logAudit } from '../../services/audit-logger.service';
import { logError } from '../../services/error-logger.service';
import { AdminUserDetail, User, UserRole } from '../../../../src/shared/types';

const router = Router();

router.use(authenticate, requireAdmin);

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserEnrichmentRow {
  id: string;
  subscription_count: string;
  ngn_balance: string;
  usd_balance: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function enrichUsers(users: User[]): Promise<AdminUserDetail[]> {
  if (users.length === 0) return [];

  const ids = users.map(u => u.id);
  const { rows } = await pool.query<UserEnrichmentRow>(
    `SELECT
       u.id,
       COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true) AS subscription_count,
       COALESCE(w.ngn_balance, '0') AS ngn_balance,
       COALESCE(w.usd_balance, '0') AS usd_balance
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     LEFT JOIN wallets w ON w.user_id = u.id
     WHERE u.id = ANY($1)
     GROUP BY u.id, w.ngn_balance, w.usd_balance`,
    [ids],
  );

  const enrichmentMap = new Map(rows.map(r => [r.id, r]));

  return users.map(user => {
    const e = enrichmentMap.get(user.id);
    return {
      ...user,
      subscriptionCount:  e ? parseInt(e.subscription_count, 10) : 0,
      walletNgnBalance:   e ? parseInt(e.ngn_balance, 10) / 100 : 0,
      walletUsdBalance:   e ? parseInt(e.usd_balance, 10) / 100 : 0,
    };
  });
}

// ── Query schemas ─────────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const roleBodySchema = z.object({
  role: z.enum(['user', 'staff', 'superadmin']),
});

// ── GET /admin/users ──────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.issues[0].message });
    return;
  }

  const { search, limit, offset } = parsed.data;

  try {
    const { users, total } = await listUsers({ search, limit, offset });
    const enriched = await enrichUsers(users);

    res.status(200).json({
      success: true,
      data: { users: enriched, total, limit, offset },
      error: null,
    });
  } catch (err) {
    logError({ message: 'Failed to list users', error: err, route: '/admin/users', method: 'GET', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch users' });
  }
});

// ── GET /admin/users/:id ──────────────────────────────────────────────────────

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const user = await findById(id);
    if (!user) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }

    const [enriched] = await enrichUsers([user]);

    res.status(200).json({ success: true, data: enriched, error: null });
  } catch (err) {
    logError({ message: 'Failed to fetch user', error: err, route: `/admin/users/${id}`, method: 'GET', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch user' });
  }
});

// ── POST /admin/users/:id/suspend ─────────────────────────────────────────────

router.post('/:id/suspend', requireRole('superadmin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const ip = req.ip ?? req.socket?.remoteAddress;

  try {
    const existing = await findById(id);
    if (!existing) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }
    if (existing.suspendedAt !== null) {
      res.status(400).json({ success: false, data: null, error: 'User is already suspended' });
      return;
    }

    const updated = await suspendUser(id);

    logAudit({ adminId: req.user!.id, action: 'user.suspend', targetType: 'user', targetId: id, ipAddress: ip });

    res.status(200).json({ success: true, data: updated, error: null });
  } catch (err) {
    logError({ message: 'Failed to suspend user', error: err, route: `/admin/users/${id}/suspend`, method: 'POST', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to suspend user' });
  }
});

// ── POST /admin/users/:id/unsuspend ──────────────────────────────────────────

router.post('/:id/unsuspend', requireRole('superadmin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const ip = req.ip ?? req.socket?.remoteAddress;

  try {
    const existing = await findById(id);
    if (!existing) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }

    const updated = await unsuspendUser(id);

    logAudit({ adminId: req.user!.id, action: 'user.unsuspend', targetType: 'user', targetId: id, ipAddress: ip });

    res.status(200).json({ success: true, data: updated, error: null });
  } catch (err) {
    logError({ message: 'Failed to unsuspend user', error: err, route: `/admin/users/${id}/unsuspend`, method: 'POST', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to unsuspend user' });
  }
});

// ── PATCH /admin/users/:id/role ───────────────────────────────────────────────

router.patch('/:id/role', requireRole('superadmin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const ip = req.ip ?? req.socket?.remoteAddress;

  if (req.user!.id === id) {
    res.status(400).json({ success: false, data: null, error: 'Cannot change your own role' });
    return;
  }

  const parsed = roleBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.issues[0].message });
    return;
  }

  const { role } = parsed.data;

  try {
    const existing = await findById(id);
    if (!existing) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }

    const oldRole = existing.role;
    const updated = await setUserRole(id, role as UserRole);

    logAudit({
      adminId: req.user!.id,
      action: 'user.role_change',
      targetType: 'user',
      targetId: id,
      details: { from: oldRole, to: role },
      ipAddress: ip,
    });

    res.status(200).json({ success: true, data: updated, error: null });
  } catch (err) {
    logError({ message: 'Failed to change user role', error: err, route: `/admin/users/${id}/role`, method: 'PATCH', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to update role' });
  }
});

// ── DELETE /admin/users/:id ───────────────────────────────────────────────────

router.delete('/:id', requireRole('superadmin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const ip = req.ip ?? req.socket?.remoteAddress;

  if (req.user!.id === id) {
    res.status(400).json({ success: false, data: null, error: 'Cannot delete your own account' });
    return;
  }

  try {
    const existing = await findById(id);
    if (!existing) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }

    await deleteUser(id);

    logAudit({ adminId: req.user!.id, action: 'user.delete', targetType: 'user', targetId: id, ipAddress: ip });

    res.status(200).json({ success: true, data: { deleted: true }, error: null });
  } catch (err) {
    logError({ message: 'Failed to delete user', error: err, route: `/admin/users/${id}`, method: 'DELETE', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to delete user' });
  }
});

// ── POST /admin/users/:id/force-logout ───────────────────────────────────────

router.post('/:id/force-logout', requireRole('superadmin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const ip = req.ip ?? req.socket?.remoteAddress;

  try {
    const existing = await findById(id);
    if (!existing) {
      res.status(404).json({ success: false, data: null, error: 'User not found' });
      return;
    }

    await incrementTokenVersion(id);

    logAudit({ adminId: req.user!.id, action: 'user.force_logout', targetType: 'user', targetId: id, ipAddress: ip });

    res.status(200).json({ success: true, data: { loggedOut: true }, error: null });
  } catch (err) {
    logError({ message: 'Failed to force logout user', error: err, route: `/admin/users/${id}/force-logout`, method: 'POST', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to force logout user' });
  }
});

export default router;
