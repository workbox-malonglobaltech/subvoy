import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { logError } from '../../services/error-logger.service';

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

// ── Validation schema ─────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  adminId: z.string().uuid('adminId must be a valid UUID').optional(),
  action:  z.string().optional(),
  from:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD').optional(),
  to:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD').optional(),
  limit:   z.coerce.number().int().min(1).max(100).default(20),
  offset:  z.coerce.number().int().min(0).default(0),
});

// ── Row mapper ────────────────────────────────────────────────────────────────

function toAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id:          row.id as string,
    adminId:     row.admin_id as string,
    adminEmail:  row.admin_email as string | null,
    action:      row.action as string,
    targetType:  row.target_type as string | null,
    targetId:    row.target_id as string | null,
    details:     row.details ?? null,
    ipAddress:   row.ip_address as string | null,
    createdAt:   row.created_at as string,
  };
}

// ── GET /admin/audit ──────────────────────────────────────────────────────────

router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const message = parsed.error.issues.map(i => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
    res.status(400).json({ success: false, data: null, error: message });
    return;
  }

  const { adminId, action, from, to, limit, offset } = parsed.data;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (adminId !== undefined) {
      params.push(adminId);
      conditions.push(`al.admin_id = $${params.length}`);
    }

    if (action !== undefined) {
      params.push(action);
      conditions.push(`al.action = $${params.length}`);
    }

    if (from !== undefined) {
      params.push(from);
      conditions.push(`al.created_at >= $${params.length}::date`);
    }

    if (to !== undefined) {
      params.push(to);
      conditions.push(`al.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count and paginated rows run in parallel
    const [countResult, dataResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM audit_logs al
         LEFT JOIN users ON users.id = al.admin_id
         ${whereClause}`,
        params,
      ),
      pool.query(
        `SELECT al.id, al.admin_id, users.email AS admin_email,
                al.action, al.target_type, al.target_id,
                al.details, al.ip_address, al.created_at
         FROM audit_logs al
         LEFT JOIN users ON users.id = al.admin_id
         ${whereClause}
         ORDER BY al.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset],
      ),
    ]);

    res.status(200).json({
      success: true,
      data: {
        logs:   dataResult.rows.map(toAuditLog),
        total:  parseInt(countResult.rows[0].count, 10),
        limit,
        offset,
      },
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: 'GET /admin/audit failed', error: err, route: '/admin/audit', method: 'GET' });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch audit logs' });
  }
});

export default router;
