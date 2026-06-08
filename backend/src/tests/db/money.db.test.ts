/**
 * REAL-DATABASE test for the wallet credit money path (C1). Runs the genuine
 * transaction against Postgres — the thing the mocked suite cannot verify.
 *
 * Requires a migrated DB at DATABASE_URL (CI provides one). Run: npm run test:db
 */
import crypto from 'crypto';
import { pool } from '../../db';
import { creditWalletAndCompleteSession } from '../../routes/webhook';
import * as walletModel from '../../models/wallet.model';

async function makeUser(): Promise<string> {
  const email = `db-money-${crypto.randomBytes(6).toString('hex')}@example.com`;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, 'x', 'DB Money') RETURNING id`,
    [email]
  );
  return rows[0].id;
}

afterAll(async () => { await pool.end(); });

describe('wallet credit (real Postgres)', () => {
  it('credits the wallet + completes the session atomically and idempotently', async () => {
    const userId = await makeUser();
    await walletModel.findOrCreate(userId);

    const reference = `db_${crypto.randomBytes(8).toString('hex')}`;
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO wallet_topup_sessions (user_id, paystack_reference, amount_ngn_kobo, destination, status)
       VALUES ($1, $2, $3, 'ngn', 'pending') RETURNING id`,
      [userId, reference, 500000]
    );
    const sessionId = rows[0].id;

    await creditWalletAndCompleteSession({
      sessionId, userId, amountNgnKobo: 500000, destination: 'ngn', reference, source: 'paystack_verify',
    });

    const after1 = await walletModel.findOrCreate(userId);
    expect(after1.ngnBalance).toBe(5000); // 500000 kobo = ₦5,000

    const s1 = await pool.query<{ status: string }>(`SELECT status FROM wallet_topup_sessions WHERE id = $1`, [sessionId]);
    expect(s1.rows[0].status).toBe('completed');

    // Second delivery (webhook after verify) must NOT double-credit.
    await creditWalletAndCompleteSession({
      sessionId, userId, amountNgnKobo: 500000, destination: 'ngn', reference, source: 'paystack_webhook',
    });
    const after2 = await walletModel.findOrCreate(userId);
    expect(after2.ngnBalance).toBe(5000);
  });
});
