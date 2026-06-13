/**
 * Unit tests for the email-connection model's multi-account behaviour:
 *  - tokens are fetched/deleted per CONNECTION id (so several inboxes of the same
 *    provider don't clobber each other), and
 *  - upsert conflicts on (user_id, provider, email) so a 2nd Gmail is a new row.
 */
jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../db';
import {
  getConnectionById,
  deleteConnectionById,
  updateAccessToken,
  upsertConnection,
} from '../../models/email-connection';

const mockQuery = pool.query as jest.Mock;

const row = {
  id: 'conn-1',
  user_id: 'user-1',
  provider: 'gmail' as const,
  access_token: '00:00:00', // not decrypted in these assertions
  refresh_token: null,
  token_expiry: null,
  email: 'a@example.com',
  connected_at: new Date('2026-06-01T00:00:00Z'),
};

beforeEach(() => jest.clearAllMocks());

describe('email-connection model — multi-account', () => {
  it('upsertConnection conflicts on (user_id, provider, email)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [row] });

    await upsertConnection('user-1', 'gmail', { accessToken: 'tok', email: 'a@example.com' });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id, provider, email)'),
      expect.arrayContaining(['user-1', 'gmail']),
    );
  });

  it('getConnectionById scopes by user_id AND id', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await getConnectionById('user-1', 'conn-1');

    expect(result).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('WHERE user_id = $1 AND id = $2'),
      ['user-1', 'conn-1'],
    );
  });

  it('deleteConnectionById removes one specific account by id', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    const ok = await deleteConnectionById('user-1', 'conn-1');

    expect(ok).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM email_connections WHERE user_id = $1 AND id = $2'),
      ['user-1', 'conn-1'],
    );
  });

  it('updateAccessToken targets one connection by id (not the whole provider)', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });

    await updateAccessToken('user-1', 'conn-1', 'new-token');

    const [, params] = mockQuery.mock.calls[0];
    expect(params[3]).toBe('conn-1'); // WHERE id = $4
  });
});
