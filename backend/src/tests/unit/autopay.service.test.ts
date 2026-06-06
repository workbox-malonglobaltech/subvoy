/**
 * Unit tests for the autopay scan.
 *
 * The payment service is mocked — these tests cover the scan's own logic:
 * selecting due subscriptions, tallying outcomes, and notifying (once per day,
 * with copy that depends on whether auto top-up is enabled) on insufficient funds.
 */

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/payment.service', () => ({ chargeSubscription: jest.fn() }));
jest.mock('../../models/notification', () => ({
  create: jest.fn(),
  alreadyNotifiedToday: jest.fn(),
}));

import { runAutopayScan } from '../../services/autopay.service';
import { pool } from '../../db';
import { chargeSubscription } from '../../services/payment.service';
import * as notifModel from '../../models/notification';

const query = (pool as unknown as { query: jest.Mock }).query;
const charge = chargeSubscription as jest.Mock;

const dueRows = [
  { id: 'sub-1', workspace_id: 'ws-1', user_id: 'user-1', name: 'Netflix' },
  { id: 'sub-2', workspace_id: 'ws-2', user_id: 'user-2', name: 'Spotify' },
];

beforeEach(() => {
  jest.clearAllMocks();
  (notifModel.alreadyNotifiedToday as jest.Mock).mockResolvedValue(false);
  (notifModel.create as jest.Mock).mockResolvedValue({});
});

describe('runAutopayScan', () => {
  it('charges every due subscription and tallies the results', async () => {
    query.mockResolvedValueOnce({ rows: dueRows });          // due-subscriptions query
    charge.mockResolvedValue({ code: 'paid' });

    const summary = await runAutopayScan();

    expect(charge).toHaveBeenCalledTimes(2);
    expect(charge).toHaveBeenCalledWith('ws-1', 'sub-1', { source: 'autopay' });
    expect(summary).toEqual({ due: 2, charged: 2, insufficient: 0, skipped: 0 });
  });

  it('returns an empty summary when nothing is due', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const summary = await runAutopayScan();

    expect(charge).not.toHaveBeenCalled();
    expect(summary).toEqual({ due: 0, charged: 0, insufficient: 0, skipped: 0 });
  });

  it('notifies once on insufficient funds and counts it', async () => {
    query
      .mockResolvedValueOnce({ rows: [dueRows[0]] })                       // due query
      .mockResolvedValueOnce({ rows: [{ auto_topup_enabled: false }] });    // settings lookup
    charge.mockResolvedValue({ code: 'insufficient', needed: '$15.99', have: '$2.00' });

    const summary = await runAutopayScan();

    expect(summary.insufficient).toBe(1);
    expect(notifModel.create).toHaveBeenCalledTimes(1);
    const arg = (notifModel.create as jest.Mock).mock.calls[0][0];
    expect(arg.type).toBe('budget_alert');
    expect(arg.message).toMatch(/Top up your wallet/);
  });

  it('tells the user we will retry when auto top-up is enabled', async () => {
    query
      .mockResolvedValueOnce({ rows: [dueRows[0]] })
      .mockResolvedValueOnce({ rows: [{ auto_topup_enabled: true }] });
    charge.mockResolvedValue({ code: 'insufficient', needed: '$15.99', have: '$0.00' });

    await runAutopayScan();

    const arg = (notifModel.create as jest.Mock).mock.calls[0][0];
    expect(arg.message).toMatch(/retry automatically/);
  });

  it('does not re-notify if the user was already notified today', async () => {
    query.mockResolvedValueOnce({ rows: [dueRows[0]] });
    (notifModel.alreadyNotifiedToday as jest.Mock).mockResolvedValue(true);
    charge.mockResolvedValue({ code: 'insufficient', needed: '$1', have: '$0' });

    const summary = await runAutopayScan();

    expect(summary.insufficient).toBe(1);
    expect(notifModel.create).not.toHaveBeenCalled();
  });

  it('counts not_due / exceeds_limit as skipped without notifying', async () => {
    query.mockResolvedValueOnce({ rows: dueRows });
    charge
      .mockResolvedValueOnce({ code: 'not_due' })
      .mockResolvedValueOnce({ code: 'exceeds_limit', limit: 10 });

    const summary = await runAutopayScan();

    expect(summary).toEqual({ due: 2, charged: 0, insufficient: 0, skipped: 2 });
    expect(notifModel.create).not.toHaveBeenCalled();
  });

  it('keeps going if one charge throws, counting it as skipped', async () => {
    query.mockResolvedValueOnce({ rows: dueRows });
    charge
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ code: 'paid' });

    const summary = await runAutopayScan();

    expect(summary).toEqual({ due: 2, charged: 1, insufficient: 0, skipped: 1 });
  });
});
