import { pool } from '../db';
import crypto from 'crypto';

export type Provider = 'gmail' | 'outlook';

export interface EmailConnection {
  id: string;
  userId: string;
  provider: Provider;
  email: string | null;
  connectedAt: string;
}

interface EmailConnectionRow {
  id: string;
  user_id: string;
  provider: Provider;
  access_token: string;
  refresh_token: string | null;
  token_expiry: Date | null;
  email: string | null;
  connected_at: Date;
}

// ─────────────────────────────────────────────────────────
// Token encryption with AES-256-GCM
// ENCRYPTION_KEY must be a 64-char hex string (32 bytes)
// ─────────────────────────────────────────────────────────
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-char hex string');
  }
  return Buffer.from(key, 'hex');
}

export function encryptToken(plain: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(hex):tag(hex):ciphertext(hex)
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptToken(stored: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, cipherHex] = stored.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

// ─────────────────────────────────────────────────────────
// DB helpers
// ─────────────────────────────────────────────────────────

function toPublic(row: EmailConnectionRow): EmailConnection {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    email: row.email,
    connectedAt: row.connected_at.toISOString(),
  };
}

export interface RawConnectionData {
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  email?: string;
}

export async function upsertConnection(
  userId: string,
  provider: Provider,
  data: RawConnectionData
): Promise<EmailConnection> {
  const encAccess  = encryptToken(data.accessToken);
  const encRefresh = data.refreshToken ? encryptToken(data.refreshToken) : null;

  const { rows } = await pool.query<EmailConnectionRow>(
    `INSERT INTO email_connections (user_id, provider, access_token, refresh_token, token_expiry, email)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       access_token  = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       token_expiry  = EXCLUDED.token_expiry,
       email         = EXCLUDED.email,
       updated_at    = NOW()
     RETURNING *`,
    [userId, provider, encAccess, encRefresh, data.tokenExpiry ?? null, data.email ?? null]
  );
  return toPublic(rows[0]);
}

export async function listConnections(userId: string): Promise<EmailConnection[]> {
  const { rows } = await pool.query<EmailConnectionRow>(
    'SELECT * FROM email_connections WHERE user_id = $1 ORDER BY connected_at ASC',
    [userId]
  );
  return rows.map(toPublic);
}

export async function getConnection(userId: string, provider: Provider): Promise<{
  connection: EmailConnection;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: Date | null;
} | null> {
  const { rows } = await pool.query<EmailConnectionRow>(
    'SELECT * FROM email_connections WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );
  if (!rows[0]) return null;
  return {
    connection: toPublic(rows[0]),
    accessToken: decryptToken(rows[0].access_token),
    refreshToken: rows[0].refresh_token ? decryptToken(rows[0].refresh_token) : null,
    tokenExpiry: rows[0].token_expiry,
  };
}

export async function deleteConnection(userId: string, provider: Provider): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM email_connections WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  );
  return (rowCount ?? 0) > 0;
}

export async function updateAccessToken(
  userId: string,
  provider: Provider,
  accessToken: string,
  tokenExpiry?: Date
): Promise<void> {
  await pool.query(
    `UPDATE email_connections
     SET access_token = $1, token_expiry = $2, updated_at = NOW()
     WHERE user_id = $3 AND provider = $4`,
    [encryptToken(accessToken), tokenExpiry ?? null, userId, provider]
  );
}
