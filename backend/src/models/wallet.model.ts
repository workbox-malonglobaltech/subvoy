import { pool } from '../db';
import type { Wallet, WalletTransaction, WalletSettings, WalletTransactionType, WalletDirection } from '../../../src/shared/types';

// ── DB row interfaces ─────────────────────────────────────────────────────────

interface WalletRow {
  id: string;
  user_id: string;
  ngn_balance: string; // BIGINT comes as string from pg
  usd_balance: string;
  updated_at: Date;
}

interface TransactionRow {
  id: string;
  user_id: string;
  type: WalletTransactionType;
  currency: string;
  amount: string;
  direction: WalletDirection;
  description: string;
  balance_after: string;
  created_at: Date;
}

interface SettingsRow {
  id: string;
  user_id: string;
  auto_topup_enabled: boolean;
  threshold_usd_cents: number;
  topup_ngn_kobo: string;
  scheduled_day: number | null;
  autopay_default: boolean;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function toWallet(row: WalletRow): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    ngnBalance: Math.round(Number(row.ngn_balance) / 100),
    usdBalance: Math.round(Number(row.usd_balance) / 100),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toTransaction(row: TransactionRow): WalletTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    currency: row.currency,
    amount: Math.round(Number(row.amount) / 100),
    direction: row.direction,
    description: row.description,
    balanceAfter: Math.round(Number(row.balance_after) / 100),
    createdAt: row.created_at.toISOString(),
  };
}

function toSettings(row: SettingsRow): WalletSettings {
  return {
    autoTopupEnabled: row.auto_topup_enabled,
    thresholdUsd: Math.round(row.threshold_usd_cents / 100),
    topupNgn: Math.round(Number(row.topup_ngn_kobo) / 100),
    scheduledDay: row.scheduled_day,
    autopayDefault: row.autopay_default ?? false,
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Returns the wallet for the given user, creating it if it doesn't exist.
 * Safe for concurrent requests — uses ON CONFLICT DO NOTHING.
 */
export async function findOrCreate(userId: string): Promise<Wallet> {
  await pool.query(
    `INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const { rows } = await pool.query<WalletRow>(
    `SELECT id, user_id, ngn_balance, usd_balance, updated_at FROM wallets WHERE user_id = $1`,
    [userId]
  );
  return toWallet(rows[0]);
}

/**
 * Adds koboAmount (negative for deductions) to the NGN balance and logs a transaction.
 * Returns the updated wallet.
 */
/**
 * Minimal query executor — satisfied by both the pg Pool and a PoolClient, so
 * these functions can run standalone OR inside a caller's transaction.
 */
export interface Queryable {
  query: (typeof pool)['query'];
}

export async function topUpNgn(
  userId: string,
  koboAmount: number,
  description: string,
  type: WalletTransactionType = 'deposit',
  db: Queryable = pool
): Promise<Wallet> {
  const direction: WalletDirection = koboAmount >= 0 ? 'in' : 'out';

  const { rows } = await db.query<WalletRow>(
    `UPDATE wallets
     SET ngn_balance = ngn_balance + $1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING id, user_id, ngn_balance, usd_balance, updated_at`,
    [koboAmount, userId]
  );
  const wallet = toWallet(rows[0]);

  // Log transaction
  await db.query(
    `INSERT INTO wallet_transactions
       (user_id, type, currency, amount, direction, description, balance_after)
     VALUES ($1, $2, 'NGN', $3, $4, $5, $6)`,
    [userId, type, Math.abs(koboAmount), direction, description, Number(rows[0].ngn_balance)]
  );

  return wallet;
}

/**
 * Adds centsAmount to the USD balance and logs a transaction.
 */
export async function topUpUsd(
  userId: string,
  centsAmount: number,
  description: string,
  type: WalletTransactionType = 'deposit',
  db: Queryable = pool
): Promise<Wallet> {
  const direction: WalletDirection = centsAmount >= 0 ? 'in' : 'out';

  const { rows } = await db.query<WalletRow>(
    `UPDATE wallets
     SET usd_balance = usd_balance + $1, updated_at = NOW()
     WHERE user_id = $2
     RETURNING id, user_id, ngn_balance, usd_balance, updated_at`,
    [centsAmount, userId]
  );
  const wallet = toWallet(rows[0]);

  await db.query(
    `INSERT INTO wallet_transactions
       (user_id, type, currency, amount, direction, description, balance_after)
     VALUES ($1, $2, 'USD', $3, $4, $5, $6)`,
    [userId, type, Math.abs(centsAmount), direction, description, Number(rows[0].usd_balance)]
  );

  return wallet;
}

export async function getTransactions(userId: string, limit = 20): Promise<WalletTransaction[]> {
  const { rows } = await pool.query<TransactionRow>(
    `SELECT id, user_id, type, currency, amount, direction, description, balance_after, created_at
     FROM wallet_transactions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map(toTransaction);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(userId: string): Promise<WalletSettings> {
  await pool.query(
    `INSERT INTO wallet_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const { rows } = await pool.query<SettingsRow>(
    `SELECT * FROM wallet_settings WHERE user_id = $1`,
    [userId]
  );
  return toSettings(rows[0]);
}

export async function updateSettings(userId: string, data: Partial<WalletSettings>): Promise<WalletSettings> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.autoTopupEnabled !== undefined) {
    fields.push(`auto_topup_enabled = $${idx++}`);
    values.push(data.autoTopupEnabled);
  }
  if (data.thresholdUsd !== undefined) {
    fields.push(`threshold_usd_cents = $${idx++}`);
    values.push(Math.round(data.thresholdUsd * 100));
  }
  if (data.topupNgn !== undefined) {
    fields.push(`topup_ngn_kobo = $${idx++}`);
    values.push(Math.round(data.topupNgn * 100));
  }
  if (data.scheduledDay !== undefined) {
    fields.push(`scheduled_day = $${idx++}`);
    values.push(data.scheduledDay);
  }
  if (data.autopayDefault !== undefined) {
    fields.push(`autopay_default = $${idx++}`);
    values.push(data.autopayDefault);
  }

  if (fields.length > 0) {
    fields.push(`updated_at = NOW()`);
    values.push(userId);
    await pool.query(
      `UPDATE wallet_settings SET ${fields.join(', ')} WHERE user_id = $${idx}`,
      values
    );
  }

  return getSettings(userId);
}
