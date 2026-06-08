/**
 * Unit tests for the payment service.
 *
 * The service runs the whole charge inside a transaction obtained from
 * pool.connect(). We mock that client with a query() that responds based on the
 * SQL it receives, and assert on the resulting ChargeResult plus the
 * COMMIT/ROLLBACK behaviour. Post-commit model reads and the notification are
 * mocked at the module level.
 */

jest.mock('../../db', () => ({ pool: { connect: jest.fn() } }));
jest.mock('../../models/subscription', () => ({ findById: jest.fn() }));
jest.mock('../../models/wallet.model', () => ({ findOrCreate: jest.fn() }));
jest.mock('../../models/notification', () => ({ create: jest.fn() }));

import { chargeSubscription } from '../../services/payment.service';
import { pool } from '../../db';
import * as subModel from '../../models/subscription';
import * as walletModel from '../../models/wallet.model';
import * as notifModel from '../../models/notification';

const connectMock = (pool as unknown as { connect: jest.Mock }).connect;

interface SubFixture {
  user_id?: string;
  amount?: string;
  currency?: string;
  is_active?: boolean;
  autopay_max_amount?: string | null;
  is_due?: boolean;
}

interface WalletFixture {
  ngn_balance?: string;
  usd_balance?: string;
}

/**
 * Builds a fake pg client whose query() answers each SQL by keyword match.
 * Returns the client plus the jest.fn so tests can assert on the calls made.
 */
function makeClient(opts: { sub: SubFixture | null; wallet?: WalletFixture }) {
  const sub = opts.sub;
  const wallet = opts.wallet ?? { ngn_balance: '0', usd_balance: '0' };

  const query = jest.fn(async (sql: string) => {
    if (/FROM subscriptions[\s\S]*FOR UPDATE/.test(sql)) {
      return {
        rows: sub
          ? [{
              id: 'sub-1',
              user_id: sub.user_id ?? 'user-1',
              name: 'Netflix',
              amount: sub.amount ?? '15.99',
              currency: sub.currency ?? 'USD',
              is_active: sub.is_active ?? true,
              autopay_max_amount: sub.autopay_max_amount ?? null,
              is_due: sub.is_due ?? true,
            }]
          : [],
      };
    }
    if (/SELECT ngn_balance, usd_balance FROM wallets[\s\S]*FOR UPDATE/.test(sql)) {
      return { rows: [{ ngn_balance: wallet.ngn_balance ?? '0', usd_balance: wallet.usd_balance ?? '0' }] };
    }
    if (/UPDATE wallets SET/.test(sql)) {
      // Reflect a deduction so balance_after is plausible (value not asserted here).
      return { rows: [{ ngn_balance: wallet.ngn_balance ?? '0', usd_balance: wallet.usd_balance ?? '0' }] };
    }
    if (/UPDATE subscriptions/.test(sql)) {
      return { rows: [{ next_billing_date: new Date('2026-07-01') }] };
    }
    // BEGIN / COMMIT / ROLLBACK / INSERT wallets / INSERT wallet_transactions
    return { rows: [] };
  });

  return { client: { query, release: jest.fn() }, query };
}

function sqlsOf(query: jest.Mock): string[] {
  return query.mock.calls.map(c => String(c[0]));
}

beforeEach(() => {
  jest.clearAllMocks();
  (subModel.findById as jest.Mock).mockResolvedValue({ id: 'sub-1', name: 'Netflix' });
  (walletModel.findOrCreate as jest.Mock).mockResolvedValue({ id: 'w-1', usdBalance: 84, ngnBalance: 0 });
  (notifModel.create as jest.Mock).mockResolvedValue({});
});

describe('chargeSubscription — manual', () => {
  it('charges a USD subscription when the balance is sufficient', async () => {
    const { client, query } = makeClient({ sub: { amount: '15.99', currency: 'USD' }, wallet: { usd_balance: '10000' } });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'manual' });

    expect(result.code).toBe('paid');
    const sqls = sqlsOf(query);
    expect(sqls).toContain('BEGIN');
    expect(sqls).toContain('COMMIT');
    // Subscription is locked by workspace_id (tenant scope).
    expect(sqls.some(s => /FROM subscriptions[\s\S]*WHERE id = \$1 AND workspace_id = \$2[\s\S]*FOR UPDATE/.test(s))).toBe(true);
    expect(sqls.some(s => /UPDATE wallets SET usd_balance/.test(s))).toBe(true);
    expect(sqls.some(s => /INSERT INTO wallet_transactions/.test(s))).toBe(true);
    expect(notifModel.create).toHaveBeenCalledTimes(1);
    // Wallet stays USER-scoped: derived from the locked row's user_id, not the workspace.
    expect(walletModel.findOrCreate).toHaveBeenCalledWith('user-1');
    expect(client.release).toHaveBeenCalled();
  });

  it('returns 402-style insufficient and rolls back when the balance is too low', async () => {
    const { client, query } = makeClient({ sub: { amount: '50.00', currency: 'USD' }, wallet: { usd_balance: '1000' } });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'manual' });

    expect(result).toMatchObject({ code: 'insufficient', needed: '$50.00', have: '$10.00' });
    const sqls = sqlsOf(query);
    expect(sqls).toContain('ROLLBACK');
    expect(sqls.some(s => /UPDATE wallets SET/.test(s))).toBe(false);
    expect(notifModel.create).not.toHaveBeenCalled();
  });

  it('returns not_found when the subscription does not exist', async () => {
    const { client } = makeClient({ sub: null });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'missing', { source: 'manual' });
    expect(result.code).toBe('not_found');
  });

  it('returns paused for an inactive subscription', async () => {
    const { client } = makeClient({ sub: { is_active: false } });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'manual' });
    expect(result.code).toBe('paused');
  });

  it('deducts from the NGN balance for an NGN subscription', async () => {
    const { client, query } = makeClient({ sub: { amount: '5000', currency: 'NGN' }, wallet: { ngn_balance: '1000000' } });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'manual' });
    expect(result.code).toBe('paid');
    expect(sqlsOf(query).some(s => /UPDATE wallets SET ngn_balance/.test(s))).toBe(true);
  });

  it('ignores the autopay cap when paying manually', async () => {
    const { client } = makeClient({
      sub: { amount: '99.00', currency: 'USD', autopay_max_amount: '10.00' },
      wallet: { usd_balance: '20000' },
    });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'manual' });
    expect(result.code).toBe('paid');
  });
});

describe('chargeSubscription — autopay', () => {
  it('rejects as not_due when the billing date has not arrived (idempotency guard)', async () => {
    const { client, query } = makeClient({ sub: { is_due: false }, wallet: { usd_balance: '999999' } });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'autopay' });
    expect(result.code).toBe('not_due');
    expect(sqlsOf(query)).toContain('ROLLBACK');
    expect(sqlsOf(query).some(s => /UPDATE wallets SET/.test(s))).toBe(false);
  });

  it('skips when the amount exceeds the autopay cap', async () => {
    const { client } = makeClient({
      sub: { amount: '99.00', currency: 'USD', autopay_max_amount: '10.00', is_due: true },
      wallet: { usd_balance: '20000' },
    });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'autopay' });
    expect(result).toMatchObject({ code: 'exceeds_limit', limit: 10 });
  });

  it('charges a due autopay subscription within the cap', async () => {
    const { client } = makeClient({
      sub: { amount: '9.99', currency: 'USD', autopay_max_amount: '20.00', is_due: true },
      wallet: { usd_balance: '5000' },
    });
    connectMock.mockResolvedValue(client);

    const result = await chargeSubscription('ws-1', 'sub-1', { source: 'autopay' });
    expect(result.code).toBe('paid');
  });
});

describe('chargeSubscription — error handling', () => {
  it('rolls back and rethrows if a query fails mid-transaction', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })  // BEGIN
      .mockRejectedValueOnce(new Error('db exploded')); // sub lock
    const client = { query, release: jest.fn() };
    connectMock.mockResolvedValue(client);

    await expect(chargeSubscription('ws-1', 'sub-1', { source: 'manual' })).rejects.toThrow('db exploded');
    expect(query.mock.calls.map(c => String(c[0]))).toContain('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });
});
