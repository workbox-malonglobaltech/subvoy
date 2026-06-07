import crypto from 'crypto';
import { pool } from '../db';
import type { WorkspaceInvite, WorkspaceRole } from '../../../src/shared/types';

const INVITE_TTL_DAYS = 14;

interface InviteRow {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: WorkspaceInvite['status'];
  expires_at: Date;
  created_at: Date;
}

function toInvite(row: InviteRow): WorkspaceInvite {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expires_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

/** Row joined with the workspace name + the raw token, for resolving by token. */
export interface InviteWithWorkspace extends WorkspaceInvite {
  token: string;
  workspaceName: string;
  expired: boolean;
}

export async function createInvite(
  workspaceId: string,
  email: string,
  role: Exclude<WorkspaceRole, 'owner'>,
  invitedBy: string
): Promise<{ invite: WorkspaceInvite; token: string }> {
  const token = crypto.randomBytes(32).toString('hex');
  const { rows } = await pool.query<InviteRow>(
    `INSERT INTO workspace_invites (workspace_id, email, role, token, invited_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' days')::interval)
     ON CONFLICT (workspace_id, email) WHERE status = 'pending'
     DO UPDATE SET role = EXCLUDED.role, token = EXCLUDED.token,
                   expires_at = EXCLUDED.expires_at, invited_by = EXCLUDED.invited_by, created_at = NOW()
     RETURNING *`,
    [workspaceId, email.toLowerCase(), role, token, invitedBy, String(INVITE_TTL_DAYS)]
  );
  return { invite: toInvite(rows[0]), token };
}

export async function listPending(workspaceId: string): Promise<WorkspaceInvite[]> {
  const { rows } = await pool.query<InviteRow>(
    `SELECT * FROM workspace_invites WHERE workspace_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
    [workspaceId]
  );
  return rows.map(toInvite);
}

export async function revoke(id: string, workspaceId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE workspace_invites SET status = 'revoked' WHERE id = $1 AND workspace_id = $2 AND status = 'pending'`,
    [id, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}

/** Resolves a pending invite by token, with workspace name + expiry flag. */
export async function findByToken(token: string): Promise<InviteWithWorkspace | null> {
  const { rows } = await pool.query<InviteRow & { workspace_name: string; expired: boolean }>(
    `SELECT i.*, w.name AS workspace_name, (i.expires_at < NOW()) AS expired
     FROM workspace_invites i JOIN workspaces w ON w.id = i.workspace_id
     WHERE i.token = $1`,
    [token]
  );
  const r = rows[0];
  if (!r) return null;
  return { ...toInvite(r), token: r.token, workspaceName: r.workspace_name, expired: r.expired };
}

export async function markAccepted(id: string): Promise<void> {
  await pool.query(
    `UPDATE workspace_invites SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
    [id]
  );
}
