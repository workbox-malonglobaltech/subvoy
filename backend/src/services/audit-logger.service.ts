/**
 * Audit logging service.
 *
 * Records every admin action to the audit_logs table.
 * Always fire-and-forget — a DB failure never blocks the admin action.
 */

import { pool } from '../db';

export interface AuditEntry {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  pool.query(
    `INSERT INTO audit_logs (admin_id, action, target_type, target_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.adminId,
      entry.action,
      entry.targetType ?? null,
      entry.targetId ?? null,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ipAddress ?? null,
    ],
  ).catch(err => {
    console.error('[audit-logger] Failed to persist audit log:', err);
  });
}
