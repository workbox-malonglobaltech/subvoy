import { pool } from '../db';
import type { Workspace, WorkspaceType, WorkspaceRole, WorkspaceMemberDetail } from '../../../src/shared/types';

interface WorkspaceRow {
  id: string;
  type: WorkspaceType;
  name: string;
  owner_id: string;
  country: string | null;
  plan: string;
  created_at: Date;
  updated_at: Date;
  role?: WorkspaceRole; // present when joined with workspace_members
}

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    role: row.role,
    country: row.country,
    plan: row.plan,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * Ensures the user has their (single) Personal workspace, creating it + the owner
 * membership if absent. Idempotent and concurrency-safe — relies on the partial
 * unique index uq_workspaces_personal_per_user. Call on every signup path.
 */
export async function ensurePersonalWorkspace(userId: string): Promise<Workspace> {
  const { rows } = await pool.query<WorkspaceRow>(
    `INSERT INTO workspaces (type, name, owner_id)
     VALUES ('personal', 'Personal', $1)
     ON CONFLICT (owner_id) WHERE type = 'personal' DO NOTHING
     RETURNING *`,
    [userId]
  );

  let ws = rows[0];
  if (!ws) {
    const existing = await pool.query<WorkspaceRow>(
      `SELECT * FROM workspaces WHERE owner_id = $1 AND type = 'personal'`,
      [userId]
    );
    ws = existing.rows[0];
  }

  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (workspace_id, user_id) DO NOTHING`,
    [ws.id, userId]
  );

  return toWorkspace(ws);
}

/** Creates a Business workspace owned by the user, with the user as owner member. */
export async function createBusinessWorkspace(
  userId: string,
  name: string,
  country?: string | null
): Promise<Workspace> {
  const { rows } = await pool.query<WorkspaceRow>(
    `INSERT INTO workspaces (type, name, owner_id, country)
     VALUES ('business', $1, $2, $3)
     RETURNING *`,
    [name, userId, country ?? null]
  );
  const ws = rows[0];
  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [ws.id, userId]
  );
  return toWorkspace(ws);
}

/** Sets the workspace's plan (entitlements source of truth). */
export async function setPlan(workspaceId: string, plan: string): Promise<void> {
  await pool.query(
    `UPDATE workspaces SET plan = $1, updated_at = NOW() WHERE id = $2`,
    [plan, workspaceId]
  );
}

export async function findById(id: string): Promise<Workspace | null> {
  const { rows } = await pool.query<WorkspaceRow>(`SELECT * FROM workspaces WHERE id = $1`, [id]);
  return rows[0] ? toWorkspace(rows[0]) : null;
}

/** Lists the workspaces a user belongs to, with their role, personal first. */
export async function listForUser(userId: string): Promise<Workspace[]> {
  const { rows } = await pool.query<WorkspaceRow>(
    `SELECT w.*, m.role
     FROM workspace_members m
     JOIN workspaces w ON w.id = m.workspace_id
     WHERE m.user_id = $1
     ORDER BY (w.type = 'personal') DESC, w.created_at ASC`,
    [userId]
  );
  return rows.map(toWorkspace);
}

/** Returns the user's role in a workspace, or null if they are not a member. */
export async function getMemberRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  const { rows } = await pool.query<{ role: WorkspaceRole }>(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return rows[0]?.role ?? null;
}

// ── Team management ─────────────────────────────────────────────────────────────

interface MemberDetailRow {
  user_id: string;
  email: string;
  name: string | null;
  role: WorkspaceRole;
  created_at: Date;
}

function toMemberDetail(row: MemberDetailRow): WorkspaceMemberDetail {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  };
}

/** Lists a workspace's members with their identity — owner first, then by join date. */
export async function listMembers(workspaceId: string): Promise<WorkspaceMemberDetail[]> {
  const { rows } = await pool.query<MemberDetailRow>(
    `SELECT m.user_id, u.email, u.name, m.role, m.created_at
     FROM workspace_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.workspace_id = $1
     ORDER BY (m.role = 'owner') DESC, m.created_at ASC`,
    [workspaceId]
  );
  return rows.map(toMemberDetail);
}

/**
 * Adds (or re-roles) a member by email. Returns null if no user has that email
 * so the caller can return a 404. Existing membership is upserted to the new role.
 */
export async function addMemberByEmail(
  workspaceId: string,
  email: string,
  role: Exclude<WorkspaceRole, 'owner'>
): Promise<WorkspaceMemberDetail | null> {
  const { rows: userRows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email]
  );
  const user = userRows[0];
  if (!user) return null;

  await pool.query(
    `INSERT INTO workspace_members (workspace_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [workspaceId, user.id, role]
  );

  const { rows } = await pool.query<MemberDetailRow>(
    `SELECT m.user_id, u.email, u.name, m.role, m.created_at
     FROM workspace_members m JOIN users u ON u.id = m.user_id
     WHERE m.workspace_id = $1 AND m.user_id = $2`,
    [workspaceId, user.id]
  );
  return toMemberDetail(rows[0]);
}

export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: Exclude<WorkspaceRole, 'owner'>
): Promise<WorkspaceMemberDetail | null> {
  await pool.query(
    `UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3`,
    [role, workspaceId, userId]
  );
  const { rows } = await pool.query<MemberDetailRow>(
    `SELECT m.user_id, u.email, u.name, m.role, m.created_at
     FROM workspace_members m JOIN users u ON u.id = m.user_id
     WHERE m.workspace_id = $1 AND m.user_id = $2`,
    [workspaceId, userId]
  );
  return rows[0] ? toMemberDetail(rows[0]) : null;
}

export async function countMembers(workspaceId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM workspace_members WHERE workspace_id = $1`,
    [workspaceId]
  );
  return parseInt(rows[0].count, 10);
}

export async function removeMember(workspaceId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId]
  );
  return (rowCount ?? 0) > 0;
}
