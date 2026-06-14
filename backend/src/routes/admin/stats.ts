import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { pool } from '../../db';
import { logError } from '../../services/error-logger.service';
import { AdminStats } from '../../../../src/shared/types';

const router = Router();

router.use(authenticate, requireAdmin);

// ── GET /admin/stats ──────────────────────────────────────────────────────────

router.get('/', async (req: Request, res: Response) => {
  try {
    const [
      totalUsersRes,
      activeSubscriptionsRes,
      newUsersLast7DaysRes,
      errorsLast24hRes,
      unresolvedErrorsRes,
      unreadAdminNotificationsRes,
    ] = await Promise.all([
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM users'),
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM obligations WHERE is_active = true'),
      pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM users WHERE created_at >= NOW() - INTERVAL '7 days'"),
      pool.query<{ count: string }>("SELECT COUNT(*) AS count FROM error_logs WHERE created_at >= NOW() - INTERVAL '24 hours'"),
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM error_logs WHERE resolved_at IS NULL'),
      pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM admin_notifications WHERE read_at IS NULL'),
    ]);

    const stats: AdminStats = {
      totalUsers:                parseInt(totalUsersRes.rows[0].count, 10),
      activeSubscriptions:       parseInt(activeSubscriptionsRes.rows[0].count, 10),
      newUsersLast7Days:         parseInt(newUsersLast7DaysRes.rows[0].count, 10),
      errorsLast24h:             parseInt(errorsLast24hRes.rows[0].count, 10),
      unresolvedErrors:          parseInt(unresolvedErrorsRes.rows[0].count, 10),
      unreadAdminNotifications:  parseInt(unreadAdminNotificationsRes.rows[0].count, 10),
    };

    res.status(200).json({ success: true, data: stats, error: null });
  } catch (err) {
    logError({ message: 'Failed to fetch admin stats', error: err, route: '/admin/stats', method: 'GET', statusCode: 500, userId: req.user?.id });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch admin stats' });
  }
});

export default router;
