import { pool } from '../db';

export interface Notification {
  id: string;
  userId: string;
  subscriptionId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  subscription_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    type: row.type,
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findAllByUser(userId: string): Promise<Notification[]> {
  const { rows } = await pool.query<NotificationRow>(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [userId]
  );
  return rows.map(toNotification);
}

export async function countUnread(userId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return parseInt(rows[0].count, 10);
}

export async function markRead(id: string, userId: string): Promise<void> {
  await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
}

export async function create(data: {
  userId: string;
  subscriptionId?: string;
  complianceItemId?: string;
  type?: string;
  title: string;
  message: string;
}): Promise<Notification> {
  const { rows } = await pool.query<NotificationRow>(
    `INSERT INTO notifications (user_id, subscription_id, compliance_item_id, type, title, message)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.userId, data.subscriptionId ?? null, data.complianceItemId ?? null, data.type ?? 'payment_reminder', data.title, data.message]
  );
  return toNotification(rows[0]);
}

/** True if a notification already exists today for this compliance item (dedup). */
export async function alreadyComplianceNotifiedToday(userId: string, complianceItemId: string): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM notifications
     WHERE user_id = $1 AND compliance_item_id = $2
       AND created_at >= CURRENT_DATE`,
    [userId, complianceItemId]
  );
  return parseInt(rows[0].count, 10) > 0;
}

export async function alreadyNotifiedToday(userId: string, subscriptionId: string): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM notifications
     WHERE user_id = $1 AND subscription_id = $2
       AND created_at >= CURRENT_DATE`,
    [userId, subscriptionId]
  );
  return parseInt(rows[0].count, 10) > 0;
}

/**
 * Returns true if a price_change notification already exists today for this subscription.
 * Prevents duplicate alerts if the scan runs more than once in a day.
 */
export async function alreadyPriceAlertedToday(userId: string, subscriptionId: string): Promise<boolean> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM notifications
     WHERE user_id = $1 AND subscription_id = $2
       AND type = 'price_change'
       AND created_at >= CURRENT_DATE`,
    [userId, subscriptionId]
  );
  return parseInt(rows[0].count, 10) > 0;
}
