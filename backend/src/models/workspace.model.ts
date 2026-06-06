import { pool } from '../db';
import type { Workspace, WorkspaceType, WorkspaceRole } from '../../../src/shared/types';

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
