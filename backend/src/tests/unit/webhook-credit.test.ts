/**
 * Regression tests for the wallet top-up credit path (C1).
 *
 * The credit MUST happen inside the same transaction that completes the session,
 * so a crash can never leave a user charged-but-not-credited. These tests assert
 * the wallet model is invoked on the transaction client, that COMMIT/ROLLBACK
 * behave correctly, and that an already-completed session is an idempotent no-op.
 */

const connect = jest.fn();
jest.mock('../../db', () => ({ pool: { connect: (...a: unknown[]) => connect(...a), query: jest.fn() } }));
jest.mock('../../models/wallet.model', () => ({ topUpNgn: jest.fn(), topUpUsd: jest.fn() }));
jest.mock('../../models/user', () => ({ findById: jest.fn().mockResolvedValue(null) }));
jest.mock('../../services/paystack.service', () => ({ validateWebhookSignature: jest.fn() }));
jest.mock('../../services/email.service', () => ({ sendWalletFundedEmail: jest.fn() }));

import { creditWalletAndCompleteSession } from '../../routes/webhook';
import * as walletModel from '../../models/wallet.model';

function fakeClient(status: string, opts: { topUpThrows?: boolean } = {}) {
  const calls: string[] = [];
  const query = jest.fn(async (sql: string) => {
    calls.push(sql.trim().split('\n')[0]);
    if (/FOR UPDATE/.test(sql)) return { rows: [{ status }] };
    return { rows: [] };
  });
  const client = { query, release: jest.fn() };
  if (opts.topUpThrows) {
    (walletModel.topUpNgn as jest.Mock).mockRejectedValueOnce(new Error('credit failed'));
  } else {
    (walletModel.topUpNgn as jest.Mock).mockResolvedValue({});
    (walletModel.topUpUsd as jest.Mock).mockResolvedValue({});
  }
  connect.mockResolvedValue(client);
  return { client, calls };
}

const base = { sessionId: 's1', userId: 'u1', amountNgnKobo: 500000, reference: 'ref1', source: 'paystack_webhook' as const };

beforeEach(() => jest.clearAllMocks());

describe('creditWalletAndCompleteSession (atomicity)', () => {
  it('credits NGN on the transaction client and commits', async () => {
    const { client, calls } = fakeClient('pending');
    await creditWalletAndCompleteSession({ ...base, destination: 'ngn' });

    // wallet credited with the SAME client as the 5th arg
    expect(walletModel.topUpNgn).toHaveBeenCalledWith('u1', 500000, expect.any(String), 'deposit', client);
    // session completed + committed, no rollback
    expect(calls.some(c => /UPDATE wallet_topup_sessions/.test(c))).toBe(true);
    expect(calls).toContain('COMMIT');
    expect(calls).not.toContain('ROLLBACK');
  });

  it('runs the USD conversion (deposit, debit, credit) on the client', async () => {
    const { client } = fakeClient('pending');
    await creditWalletAndCompleteSession({ ...base, destination: 'usd' });
    expect((walletModel.topUpNgn as jest.Mock).mock.calls.length).toBe(2); // deposit + conversion debit
    expect(walletModel.topUpUsd).toHaveBeenCalledWith('u1', expect.any(Number), expect.any(String), 'conversion', client);
  });

  it('is an idempotent no-op when the session is already completed', async () => {
    const { calls } = fakeClient('completed');
    await creditWalletAndCompleteSession({ ...base, destination: 'ngn' });
    expect(walletModel.topUpNgn).not.toHaveBeenCalled();
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
  });

  it('rolls back and rethrows if crediting fails (session stays pending for retry)', async () => {
    const { calls } = fakeClient('pending', { topUpThrows: true });
    await expect(creditWalletAndCompleteSession({ ...base, destination: 'ngn' })).rejects.toThrow('credit failed');
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
  });
});
