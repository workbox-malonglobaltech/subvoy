/**
 * Unit tests for the plan-expiry scan — reverts lapsed paid plans to free.
 */

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../db';
import { runPlanExpiryScan } from '../../services/plan-expiry.service';

const query = (pool as unknown as { query: jest.Mock }).query;

beforeEach(() => jest.clearAllMocks());

describe('runPlanExpiryScan', () => {
  it('reverts expired workspaces to free and reports the count', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ workspace_id: 'ws-1' }, { workspace_id: 'ws-2' }] }) // UPDATE workspace_billing ... RETURNING
      .mockResolvedValueOnce({ rowCount: 2 }); // UPDATE workspaces SET plan='free'

    const result = await runPlanExpiryScan();

    expect(result.expired).toBe(2);
    // First query flips billing rows to 'expired'.
    expect(query.mock.calls[0][0]).toMatch(/UPDATE workspace_billing[\s\S]*status = 'expired'/);
    // Second query downgrades those workspaces' plan to free.
    expect(query.mock.calls[1][0]).toMatch(/UPDATE workspaces SET plan = 'free'/);
    expect(query.mock.calls[1][1]).toEqual([['ws-1', 'ws-2']]);
  });

  it('does not touch workspaces when nothing has expired', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await runPlanExpiryScan();

    expect(result.expired).toBe(0);
    expect(query).toHaveBeenCalledTimes(1); // no second UPDATE
  });
});
