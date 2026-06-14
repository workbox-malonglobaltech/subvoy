import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pool } from '../../db';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin, requireRole } from '../../middleware/requireAdmin';
import { logAudit } from '../../services/audit-logger.service';
import { logError } from '../../services/error-logger.service';
import { sendAnnouncementEmail } from '../../services/email.service';

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface Announcement {
  id: string;
  createdBy: string;
  creatorEmail: string | null;
  title: string;
  body: string;
  channel: string;
  target: string;
  sentAt: string | null;
  recipientCount: number | null;
  createdAt: string;
}

interface Recipient {
  id: string;
  email: string;
  name: string;
}

// ── Validation schemas ────────────────────────────────────────────────────────

const listQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({
  title:   z.string().min(1).max(255),
  body:    z.string().min(1),
  channel: z.enum(['in-app', 'email', 'both']),
  target:  z.enum(['all', 'active']).default('all'),
});

// ── Row mapper ────────────────────────────────────────────────────────────────

function toAnnouncement(row: Record<string, unknown>): Announcement {
  return {
    id:             row.id as string,
    createdBy:      row.created_by as string,
    creatorEmail:   row.creator_email as string | null,
    title:          row.title as string,
    body:           row.body as string,
    channel:        row.channel as string,
    target:         row.target as string,
    sentAt:         row.sent_at as string | null,
    recipientCount: row.recipient_count != null ? Number(row.recipient_count) : null,
    createdAt:      row.created_at as string,
  };
}

// ── GET /admin/announcements ──────────────────────────────────────────────────

router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const message = parsed.error.issues.map(i => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
    res.status(400).json({ success: false, data: null, error: message });
    return;
  }

  const { limit, offset } = parsed.data;

  try {
    const [countResult, dataResult] = await Promise.all([
      pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM announcements`,
      ),
      pool.query(
        `SELECT a.id, a.created_by, u.email AS creator_email,
                a.title, a.body, a.channel, a.target,
                a.sent_at, a.recipient_count, a.created_at
         FROM announcements a
         LEFT JOIN users u ON u.id = a.created_by
         ORDER BY a.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
    ]);

    res.status(200).json({
      success: true,
      data: {
        announcements: dataResult.rows.map(toAnnouncement),
        total:         parseInt(countResult.rows[0].count, 10),
      },
      error: null,
    });
  } catch (err) {
    await logError({ level: 'error', message: 'GET /admin/announcements failed', error: err, route: '/admin/announcements', method: 'GET' });
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch announcements' });
  }
});

// ── POST /admin/announcements ─────────────────────────────────────────────────

router.post('/', authenticate, requireRole('superadmin'), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    const message = parsed.error.issues.map(i => `${i.path.join('.') || 'field'}: ${i.message}`).join(', ');
    res.status(400).json({ success: false, data: null, error: message });
    return;
  }

  const { title, body, channel, target } = parsed.data;
  const adminId = req.user!.id;

  try {
    // 1. Insert the announcement record
    const insertResult = await pool.query(
      `INSERT INTO announcements (created_by, title, body, channel, target)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_by, title, body, channel, target, sent_at, recipient_count, created_at`,
      [adminId, title, body, channel, target],
    );

    const announcementId: string = insertResult.rows[0].id;

    // 2. Fetch recipients based on target
    let recipientRows: Recipient[];
    if (target === 'active') {
      const result = await pool.query<Recipient>(
        `SELECT DISTINCT u.id, u.email, u.name
         FROM users u
         INNER JOIN obligations s ON s.user_id = u.id AND s.is_active = true
         WHERE u.suspended_at IS NULL`,
      );
      recipientRows = result.rows;
    } else {
      const result = await pool.query<Recipient>(
        `SELECT id, email, name
         FROM users
         WHERE suspended_at IS NULL`,
      );
      recipientRows = result.rows;
    }

    const recipientCount = recipientRows.length;

    // 3. In-app notifications (channel 'in-app' or 'both')
    if (channel === 'in-app' || channel === 'both') {
      // Single admin_notifications row to record the broadcast event.
      // Per-user in-app delivery is future scope.
      await pool.query(
        `INSERT INTO admin_notifications (type, title, message, severity, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          'announcement',
          title,
          body,
          'info',
          JSON.stringify({ announcementId, target, recipientCount }),
        ],
      );
    }

    // 4. Email delivery (channel 'email' or 'both')
    if (channel === 'email' || channel === 'both') {
      const emailPromises = recipientRows.map(recipient =>
        sendAnnouncementEmail({
          to:    recipient.email,
          name:  recipient.name,
          title,
          body,
        }),
      );
      // allSettled — one failure must not abort the entire broadcast
      const results = await Promise.allSettled(emailPromises);
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        await logError({
          level:   'warn',
          message: `Announcement ${announcementId} — ${failed} of ${recipientCount} emails failed to send`,
          route:   '/admin/announcements',
          method:  'POST',
          userId:  adminId,
          context: { announcementId, failed, recipientCount },
        });
      }
    }

    // 5. Mark as sent and record recipient count
    const finalResult = await pool.query(
      `UPDATE announcements
       SET sent_at = NOW(), recipient_count = $1
       WHERE id = $2
       RETURNING id, created_by, title, body, channel, target, sent_at, recipient_count, created_at`,
      [recipientCount, announcementId],
    );

    // 6. Fetch creator email for response shape
    const creatorResult = await pool.query<{ email: string }>(
      `SELECT email FROM users WHERE id = $1`,
      [adminId],
    );

    const responseRow = {
      ...finalResult.rows[0],
      creator_email: creatorResult.rows[0]?.email ?? null,
    };

    logAudit({
      adminId,
      action:    'announcement.send',
      targetId:  announcementId,
      details:   { channel, target, recipientCount },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      data:    toAnnouncement(responseRow),
      error:   null,
    });
  } catch (err) {
    await logError({ level: 'error', message: 'POST /admin/announcements failed', error: err, route: '/admin/announcements', method: 'POST', userId: adminId });
    res.status(500).json({ success: false, data: null, error: 'Failed to send announcement' });
  }
});

export default router;
