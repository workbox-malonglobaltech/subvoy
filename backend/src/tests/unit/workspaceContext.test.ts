/**
 * Unit tests for the workspace context middleware + guards.
 *
 * Covers tenant isolation and capability/role gating:
 *   - defaults to the caller's Personal workspace when no X-Workspace-Id header
 *   - 403 when the header names a workspace the caller is not a member of
 *   - requireCapability blocks kinds the workspace type can't hold
 *   - requireRole gates by the caller's membership role
 *
 * The workspace model is mocked so we exercise the middleware's own logic.
 */

jest.mock('../../models/workspace.model', () => ({
  getMemberRole: jest.fn(),
  findById: jest.fn(),
  ensurePersonalWorkspace: jest.fn(),
}));

import { workspaceContext, requireCapability, requireRole } from '../../middleware/workspaceContext';
import * as workspaceModel from '../../models/workspace.model';

const getMemberRole = workspaceModel.getMemberRole as jest.Mock;
const findById = workspaceModel.findById as jest.Mock;
const ensurePersonalWorkspace = workspaceModel.ensurePersonalWorkspace as jest.Mock;

interface MockReq {
  user?: { id: string };
  workspace?: { id: string; type: string; role: string };
  header: (name: string) => string | undefined;
}

function makeReq(opts: { userId?: string; header?: string } = {}): MockReq {
  return {
    user: { id: opts.userId ?? 'user-1' },
    header: (name: string) => (name === 'X-Workspace-Id' ? opts.header : undefined),
  };
}

function makeRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('workspaceContext', () => {
  it('defaults to the personal workspace when no X-Workspace-Id header is sent', async () => {
    ensurePersonalWorkspace.mockResolvedValue({ id: 'ws-personal', type: 'personal' });
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await workspaceContext(req as any, res as any, next);

    expect(ensurePersonalWorkspace).toHaveBeenCalledWith('user-1');
    expect(getMemberRole).not.toHaveBeenCalled();
    expect(req.workspace).toEqual({ id: 'ws-personal', type: 'personal', role: 'owner' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('resolves the requested workspace when the caller is a member', async () => {
    getMemberRole.mockResolvedValue('admin');
    findById.mockResolvedValue({ id: 'ws-biz', type: 'business' });
    const req = makeReq({ header: 'ws-biz' });
    const res = makeRes();
    const next = jest.fn();

    await workspaceContext(req as any, res as any, next);

    expect(getMemberRole).toHaveBeenCalledWith('ws-biz', 'user-1');
    expect(req.workspace).toEqual({ id: 'ws-biz', type: 'business', role: 'admin' });
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when X-Workspace-Id names a workspace the caller is not a member of', async () => {
    getMemberRole.mockResolvedValue(null);
    const req = makeReq({ header: 'ws-foreign' });
    const res = makeRes();
    const next = jest.fn();

    await workspaceContext(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/not a member/i) })
    );
    expect(findById).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(req.workspace).toBeUndefined();
  });

  it('returns 404 when the requested workspace no longer exists', async () => {
    getMemberRole.mockResolvedValue('owner');
    findById.mockResolvedValue(null);
    const req = makeReq({ header: 'ws-gone' });
    const res = makeRes();
    const next = jest.fn();

    await workspaceContext(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when the model throws', async () => {
    ensurePersonalWorkspace.mockRejectedValue(new Error('db down'));
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    await workspaceContext(req as any, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireCapability', () => {
  it('returns 403 for a kind the personal workspace cannot hold (compliance)', () => {
    const req: any = { workspace: { id: 'ws-1', type: 'personal', role: 'owner' } };
    const res = makeRes();
    const next = jest.fn();

    requireCapability('compliance')(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes for compliance in a business workspace', () => {
    const req: any = { workspace: { id: 'ws-1', type: 'business', role: 'owner' } };
    const res = makeRes();
    const next = jest.fn();

    requireCapability('compliance')(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('passes for payment in a personal workspace', () => {
    const req: any = { workspace: { id: 'ws-1', type: 'personal', role: 'owner' } };
    const res = makeRes();
    const next = jest.fn();

    requireCapability('payment')(req, res as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('returns 500 when workspace context is missing', () => {
    const req: any = {};
    const res = makeRes();
    const next = jest.fn();

    requireCapability('payment')(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('passes when the caller has one of the allowed roles', () => {
    const req: any = { workspace: { id: 'ws-1', type: 'business', role: 'admin' } };
    const res = makeRes();
    const next = jest.fn();

    requireRole('owner', 'admin')(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller role is not permitted', () => {
    const req: any = { workspace: { id: 'ws-1', type: 'business', role: 'member' } };
    const res = makeRes();
    const next = jest.fn();

    requireRole('owner', 'admin')(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when workspace context is missing', () => {
    const req: any = {};
    const res = makeRes();
    const next = jest.fn();

    requireRole('owner')(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
