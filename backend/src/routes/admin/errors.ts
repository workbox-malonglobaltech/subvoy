import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin, requireRole } from '../../middleware/requireAdmin';
import { logAudit } from '../../services/audit-logger.service';
import { logError } from '../../services/error-logger.service';

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorLog {
  id: string;
  level: string;
  message: string;
  stack: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  userId: string | null;
  context: unknown;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

// ── Validation schemas ────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  level:    z.enum(['warn', 'error', 'fatal']).optional(),
  resolved: z.enum(['true', 'false']).optional(),
  route:    z.string().optional(),
  from:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  offset:   z.coerce.number().int().min(0).default(0),
});

// ── Row mapper ────────────────────────────────────────────────────────────────

function toErrorLog(row: Record<string, unknown>): ErrorLog {
  return {
    id:          row.id as string,
    level:       row.level as string,
    message:     row.message as string,
    stack:       row.stack as string | null,
    route:       row.route as string | null,
    method:      row.method as string | null,
    statusCode:  row.status_code != null ? Number(row.status_code) : null,
    userId:      row.user_id as string | null,
    context:     row.context ?? null,
    resolvedAt:  row.resolved_at as string | null,
    resolvedBy:  row.resolved_by as string | null,
    createdAt:   row.created_at as string,
  };
}

// ── GET /admin/errors ─────────────────────────────────────────────────────────

router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const message = parsed.error.issues.map(i => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
    res.status(400).json({ success: false, data: null, error: message });
    return;
  }

  const { level, resolved, route, from, to, limit, offset } = parsed.data;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (level !== undefined) {
      params.push(level);
      conditions.push(`level = $${params.length}`);
    }

    if (resolved === 'true') {
      conditions.push('resolved_at IS NOT NULL');
    } else if (resolved === 'false') {
      conditions.push('resolved_at IS NULL');
    }

    if (route !== undefined) {
      params.push(route);
      conditions.push(`route = $${params.length}`);
    }

    if (from !== undefined) {
      params.push(from);
      conditions.push(`created_at >= $${params.length}::date`);
    }

    if (to !== undefined) {
      params.push(to);
      conditions.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count (reuses same params — no limit/offset yet)
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM error_logs ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Paginated rows — push limit and offset after the WHERE params
    params.push(limit);
    const limitPos = params.length;
    params.push(offset);
    const offsetPos = params.length;

    const dataResult = await pool.query(
      `SELECT id, level, message, stack, route, method, status_code, user_id, context,
              resolved_at, resolved_by, created_at
       FROM error_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitPos} OFFSET $${offsetPos}`,
      params,
    );

    res.status(200).json({
      success: true,
      data: {
        errors: dataResult.rows.map(toErrorLog),
        total,
        limit,
        offset,
      },
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: 'GET /admin/errors failed', error: err, route: '/admin/errors', method: 'GET' });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch error logs' });
  }
});

// ── POST /admin/errors/:id/resolve ────────────────────────────────────────────

router.post('/:id/resolve', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user!.id;

  try {
    const result = await pool.query(
      `UPDATE error_logs
       SET resolved_at = NOW(), resolved_by = $1
       WHERE id = $2 AND resolved_at IS NULL
       RETURNING id, level, message, stack, route, method, status_code, user_id, context,
                 resolved_at, resolved_by, created_at`,
      [adminId, id],
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, data: null, error: 'Error log not found or already resolved' });
      return;
    }

    logAudit({
      adminId,
      action: 'error.resolve',
      targetType: 'error_log',
      targetId: id,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: toErrorLog(result.rows[0]),
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: `POST /admin/errors/${id}/resolve failed`, error: err, route: '/admin/errors/:id/resolve', method: 'POST', userId: adminId });
    res.status(500).json({ success: false, data: null, error: 'Failed to resolve error log' });
  }
});

// ── DELETE /admin/errors/resolved ─────────────────────────────────────────────

router.delete('/resolved', authenticate, requireRole('superadmin'), async (req: Request, res: Response) => {
  const adminId = req.user!.id;

  try {
    const result = await pool.query(
      `DELETE FROM error_logs WHERE resolved_at IS NOT NULL`,
    );

    const rowCount = result.rowCount ?? 0;

    logAudit({
      adminId,
      action: 'error.purge_resolved',
      details: { count: rowCount },
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      data: { deleted: rowCount },
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: 'DELETE /admin/errors/resolved failed', error: err, route: '/admin/errors/resolved', method: 'DELETE', userId: adminId });
    res.status(500).json({ success: false, data: null, error: 'Failed to purge resolved error logs' });
  }
});

export default router;
