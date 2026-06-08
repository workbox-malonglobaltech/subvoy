/**
 * Unit tests for the workspace model — focuses on the idempotent personal-workspace
 * creation that runs on every signup, plus membership lookups.
 */

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

import { pool } from '../../db';
import {
  ensurePersonalWorkspace,
  createBusinessWorkspace,
  listForUser,
  getMemberRole,
} from '../../models/workspace.model';

const query = (pool as unknown as { query: jest.Mock }).query;

const wsRow = {
  id: 'ws-1',
  type: 'personal',
  name: 'Personal',
  owner_id: 'user-1',
  country: null,
  plan: 'free',
  created_at: new Date('2026-06-05T00:00:00Z'),
  updated_at: new Date('2026-06-05T00:00:00Z'),
};

beforeEach(() => jest.clearAllMocks());

describe('ensurePersonalWorkspace', () => {
  it('creates the workspace + owner membership when none exists', async () => {
    query
      .mockResolvedValueOnce({ rows: [wsRow] })   // INSERT workspace RETURNING *
      .mockResolvedValueOnce({ rows: [] });        // INSERT member

    const ws = await ensurePersonalWorkspace('user-1');

    expect(ws).toMatchObject({ id: 'ws-1', type: 'personal', name: 'Personal', plan: 'free' });
    const sqls = query.mock.calls.map(c => String(c[0]));
    expect(sqls[0]).toMatch(/INSERT INTO workspaces[\s\S]*ON CONFLICT/);
    expect(sqls[1]).toMatch(/INSERT INTO workspace_members/);
  });

  it('falls back to the existing workspace when the insert conflicts (idempotent)', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })          // INSERT hit ON CONFLICT DO NOTHING
      .mockResolvedValueOnce({ rows: [wsRow] })      // SELECT existing
      .mockResolvedValueOnce({ rows: [] });          // INSERT member (no-op)

    const ws = await ensurePersonalWorkspace('user-1');

    expect(ws.id).toBe('ws-1');
    expect(query.mock.calls[1][0]).toMatch(/SELECT \* FROM workspaces WHERE owner_id/);
  });
});

describe('createBusinessWorkspace', () => {
  it('creates a business workspace and owner membership', async () => {
    const bizRow = { ...wsRow, id: 'ws-2', type: 'business', name: 'Acme', country: 'NG' };
    query
      .mockResolvedValueOnce({ rows: [bizRow] })   // INSERT workspace
      .mockResolvedValueOnce({ rows: [] });         // INSERT member

    const ws = await createBusinessWorkspace('user-1', 'Acme', 'NG');

    expect(ws).toMatchObject({ id: 'ws-2', type: 'business', name: 'Acme', country: 'NG' });
    expect(query.mock.calls[0][0]).toMatch(/VALUES \('business'/);
  });
});

describe('listForUser', () => {
  it('maps rows including the member role', async () => {
    query.mockResolvedValueOnce({ rows: [{ ...wsRow, role: 'owner' }] });

    const list = await listForUser('user-1');

    expect(list).toHaveLength(1);
    expect(list[0].role).toBe('owner');
  });
});

describe('getMemberRole', () => {
  it('returns the role when a membership exists', async () => {
    query.mockResolvedValueOnce({ rows: [{ role: 'admin' }] });
    expect(await getMemberRole('ws-1', 'user-1')).toBe('admin');
  });

  it('returns null when not a member', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await getMemberRole('ws-1', 'user-x')).toBeNull();
  });
});
