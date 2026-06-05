import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { logAudit } from '../../services/audit-logger.service';
import { logError } from '../../services/error-logger.service';

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  metadata: unknown;
  readAt: string | null;
  readBy: string | null;
  createdAt: string;
}

// ── Validation schemas ────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(20),
  offset:     z.coerce.number().int().min(0).default(0),
});

// ── Row mapper ────────────────────────────────────────────────────────────────

function toAdminNotification(row: Record<string, unknown>): AdminNotification {
  return {
    id:        row.id as string,
    type:      row.type as string,
    title:     row.title as string,
    message:   row.message as string,
    severity:  row.severity as string,
    metadata:  row.metadata ?? null,
    readAt:    row.read_at as string | null,
    readBy:    row.read_by as string | null,
    createdAt: row.created_at as string,
  };
}

// ── GET /admin/notifications ──────────────────────────────────────────────────

router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const message = parsed.error.issues.map(i => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
    res.status(400).json({ success: false, data: null, error: message });
    return;
  }

  const { unreadOnly, limit, offset } = parsed.data;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (unreadOnly === 'true') {
      conditions.push('read_at IS NULL');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Run total count, unread count, and paginated data in parallel
    const [countResult, unreadResult, dataResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM admin_notifications ${whereClause}`,
        params,
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM admin_notifications WHERE read_at IS NULL`,
      ),
      pool.query(
        `SELECT id, type, title, message, severity, metadata, read_at, read_by, created_at
         FROM admin_notifications
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    res.status(200).json({
      success: true,
      data: {
        notifications: dataResult.rows.map(toAdminNotification),
        total:         parseInt(countResult.rows[0].count, 10),
        unreadCount:   parseInt(unreadResult.rows[0].count, 10),
      },
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: 'GET /admin/notifications failed', error: err, route: '/admin/notifications', method: 'GET' });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch notifications' });
  }
});

// ── POST /admin/notifications/:id/read ───────────────────────────────────────

router.post('/:id/read', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user!.id;

  try {
    const result = await pool.query(
      `UPDATE admin_notifications
       SET read_at = NOW(), read_by = $1
       WHERE id = $2 AND read_at IS NULL
       RETURNING id, type, title, message, severity, metadata, read_at, read_by, created_at`,
      [adminId, id],
    );

    if (result.rowCount === 0) {
      // Distinguish "not found" from "already read" for a clearer error
      const check = await pool.query<{ id: string }>(
        `SELECT id FROM admin_notifications WHERE id = $1`,
        [id],
      );
      if (check.rowCount === 0) {
        res.status(404).json({ success: false, data: null, error: 'Notification not found' });
      } else {
        res.status(409).json({ success: false, data: null, error: 'Notification already marked as read' });
      }
      return;
    }

    res.status(200).json({
      success: true,
      data: toAdminNotification(result.rows[0]),
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: `POST /admin/notifications/${id}/read failed`, error: err, route: '/admin/notifications/:id/read', method: 'POST', userId: adminId });
    res.status(500).json({ success: false, data: null, error: 'Failed to mark notification as read' });
  }
});

// ── POST /admin/notifications/read-all ───────────────────────────────────────

router.post('/read-all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const adminId = req.user!.id;

  try {
    const result = await pool.query(
      `UPDATE admin_notifications
       SET read_at = NOW(), read_by = $1
       WHERE read_at IS NULL`,
      [adminId],
    );

    const rowCount = result.rowCount ?? 0;

    logAudit({
      adminId,
      action: 'notifications.read_all',
      details: { updated: rowCount },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: { updated: rowCount },
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: 'POST /admin/notifications/read-all failed', error: err, route: '/admin/notifications/read-all', method: 'POST', userId: adminId });
    res.status(500).json({ success: false, data: null, error: 'Failed to mark all notifications as read' });
  }
});

export default router;
