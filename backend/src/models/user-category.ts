import { pool } from '../db';

export interface UserCategory {
  id: string;
  name: string;
  createdAt: string;
}

interface Row {
  id: string;
  name: string;
  created_at: Date;
}

function toCategory(row: Row): UserCategory {
  return { id: row.id, name: row.name, createdAt: row.created_at.toISOString() };
}

export async function list(userId: string): Promise<UserCategory[]> {
  const { rows } = await pool.query<Row>(
    'SELECT id, name, created_at FROM user_categories WHERE user_id = $1 ORDER BY name ASC',
    [userId]
  );
  return rows.map(toCategory);
}

export async function create(userId: string, name: string): Promise<UserCategory> {
  const { rows } = await pool.query<Row>(
    `INSERT INTO user_categories (user_id, name)
     VALUES ($1, $2)
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, created_at`,
    [userId, name.trim()]
  );
  return toCategory(rows[0]);
}

export async function remove(userId: string, id: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM user_categories WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return (rowCount ?? 0) > 0;
}
