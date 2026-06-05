/**
 * Admin alert service.
 *
 * When recentErrorCount() exceeds ALERT_THRESHOLD within ALERT_WINDOW_MS,
 * this service:
 *   1. Creates an admin_notification row (visible in the portal)
 *   2. Emails every superadmin
 *
 * A simple in-memory flag prevents the same alert from firing more than
 * once per cooldown window.
 */

import { pool } from '../db';
import { recentErrorCount } from './error-logger.service';
import { sendAdminAlertEmail } from './email.service';

const ALERT_THRESHOLD = 10;            // errors within the 5-minute window
const COOLDOWN_MS     = 5 * 60 * 1000; // minimum gap between repeated alerts

let lastAlertAt = 0;

/**
 * Called after every error is logged. Decides whether to fire an alert.
 * Fire-and-forget — never throws to callers.
 */
export function checkAndAlert(context?: { route?: string }): void {
  const now = Date.now();
  if (now - lastAlertAt < COOLDOWN_MS) return; // Still in cooldown

  const count = recentErrorCount();
  if (count < ALERT_THRESHOLD) return;

  lastAlertAt = now; // Lock immediately to prevent concurrent alerts

  fireAlert(count, context?.route).catch(err => {
    console.error('[admin-alert] Failed to fire alert:', err);
  });
}

async function fireAlert(errorCount: number, route?: string): Promise<void> {
  const title   = `High error rate detected`;
  const message = `${errorCount} errors occurred in the last 5 minutes.${route ? ` Most recent route: ${route}` : ''}`;

  // 1. Create admin_notification row
  await pool.query(
    `INSERT INTO admin_notifications (type, title, message, severity, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'high_error_rate',
      title,
      message,
      'critical',
      JSON.stringify({ errorCount, route: route ?? null }),
    ],
  );

  // 2. Fetch all superadmin emails
  const { rows } = await pool.query<{ email: string; name: string | null }>(
    `SELECT email, name FROM users WHERE role = 'superadmin' AND suspended_at IS NULL`,
  );

  // 3. Email each superadmin
  await Promise.allSettled(
    rows.map(admin =>
      sendAdminAlertEmail({
        to:      admin.email,
        name:    admin.name ?? admin.email,
        title,
        message,
        errorCount,
      }),
    ),
  );
}

/** Reset the cooldown (used in tests). */
export function _resetAlertCooldown(): void {
  lastAlertAt = 0;
}
