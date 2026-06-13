import { pool } from '../db';
import { User, UserRole } from '../../../src/shared/types';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  password_hash: string;
  token_version: number;
  role: UserRole;
  suspended_at: Date | null;
  created_at: Date;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    hasPassword: !!(row.password_hash && row.password_hash.length > 0),
    role: row.role ?? 'user',
    suspendedAt: row.suspended_at ? row.suspended_at.toISOString() : null,
  };
}

/** Returns the public user object without the password hash. */
export async function findByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, name, password_hash, token_version, role, suspended_at, created_at FROM users WHERE email = $1',
    [email]
  );
  if (!rows[0]) return null;
  return toUser(rows[0]);
}

/**
 * Fetches ONLY the bcrypt hash for login comparison.
 */
export async function getPasswordHash(email: string): Promise<string | null> {
  const { rows } = await pool.query<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE email = $1',
    [email]
  );
  return rows[0]?.password_hash ?? null;
}

export async function findById(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, name, password_hash, token_version, role, suspended_at, created_at FROM users WHERE id = $1',
    [id]
  );
  if (!rows[0]) return null;
  return toUser(rows[0]);
}

/** Finds a user by their linked Supabase identity (auth_user_id). */
export async function findByAuthId(authUserId: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    'SELECT id, email, name, password_hash, token_version, role, suspended_at, created_at FROM users WHERE auth_user_id = $1',
    [authUserId]
  );
  if (!rows[0]) return null;
  return toUser(rows[0]);
}

/** Links an existing user to a Supabase identity (migration bridge). */
export async function linkAuthUserId(userId: string, authUserId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET auth_user_id = $1, updated_at = NOW() WHERE id = $2',
    [authUserId, userId]
  );
}

/** Creates a user provisioned by Supabase (no local password). */
export async function createFromAuth(data: { email: string; name: string | null; authUserId: string }): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    "INSERT INTO users (email, password_hash, name, auth_user_id) VALUES ($1, '', $2, $3) RETURNING *",
    [data.email, data.name, data.authUserId]
  );
  return toUser(rows[0]);
}

/** Returns token_version for JWT validation — separate query to avoid coupling. */
export async function getTokenVersion(userId: string): Promise<number | null> {
  const { rows } = await pool.query<{ token_version: number }>(
    'SELECT token_version FROM users WHERE id = $1',
    [userId]
  );
  return rows[0]?.token_version ?? null;
}

/** Increments token_version, instantly invalidating all existing JWTs for this user. */
export async function incrementTokenVersion(userId: string): Promise<void> {
  await pool.query(
    'UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1',
    [userId]
  );
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name?: string;
}): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
    [data.email, data.passwordHash, data.name ?? null]
  );
  return toUser(rows[0]);
}

export async function updatePasswordHash(userId: string, newHash: string): Promise<void> {
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newHash, userId]
  );
}

export async function updateName(userId: string, name: string | null): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    'UPDATE users SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, password_hash, token_version, role, suspended_at, created_at',
    [name, userId]
  );
  if (!rows[0]) return null;
  return toUser(rows[0]);
}

/** Store the user's IANA timezone (for local-time reminder delivery). */
export async function updateTimezone(userId: string, timezone: string): Promise<void> {
  await pool.query('UPDATE users SET timezone = $1, updated_at = NOW() WHERE id = $2', [timezone, userId]);
}

export async function deleteUser(userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM users WHERE id = $1',
    [userId]
  );
  return (rowCount ?? 0) > 0;
}

// ── Admin-only helpers ────────────────────────────────────────────────────────

export interface UserListRow {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  suspended_at: Date | null;
  created_at: Date;
}

export async function listUsers(opts: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ users: User[]; total: number }> {
  const { search, limit, offset } = opts;
  const pattern = search ? `%${search}%` : null;

  const countRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users
     WHERE ($1::text IS NULL OR email ILIKE $1 OR name ILIKE $1)`,
    [pattern],
  );

  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, name, password_hash, token_version, role, suspended_at, created_at
     FROM users
     WHERE ($1::text IS NULL OR email ILIKE $1 OR name ILIKE $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [pattern, limit, offset],
  );

  return {
    users: rows.map(toUser),
    total: parseInt(countRes.rows[0].count, 10),
  };
}

export async function setUserRole(userId: string, role: UserRole): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET role = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, name, password_hash, token_version, role, suspended_at, created_at`,
    [role, userId],
  );
  if (!rows[0]) return null;
  return toUser(rows[0]);
}

export async function suspendUser(userId: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET suspended_at = NOW(), token_version = token_version + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, password_hash, token_version, role, suspended_at, created_at`,
    [userId],
  );
  if (!rows[0]) return null;
  return toUser(rows[0]);
}

export async function unsuspendUser(userId: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET suspended_at = NULL, updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, password_hash, token_version, role, suspended_at, created_at`,
    [userId],
  );
  if (!rows[0]) return null;
  return toUser(rows[0]);
}
