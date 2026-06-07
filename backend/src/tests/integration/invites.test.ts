/**
 * Integration tests for workspace invitations:
 *   /workspaces/:id/invites (admin) + /invites/:token (public accept).
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'me', role: 'user' }; next(); },
}));
jest.mock('../../middleware/requireAdmin', () => ({
  requireAdmin: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'me', tokenVersion: 0 }),
}));
jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../services/email.service', () => ({ sendWorkspaceInviteEmail: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../models/workspace.model', () => ({
  findById: jest.fn(),
  getMemberRole: jest.fn(),
  addMemberByEmail: jest.fn(),
}));
jest.mock('../../models/workspace-invite.model', () => ({
  createInvite: jest.fn(),
  listPending: jest.fn(),
  revoke: jest.fn(),
  findByToken: jest.fn(),
  markAccepted: jest.fn(),
}));
jest.mock('../../models/user', () => ({ findById: jest.fn() }));

import app from '../../index';
import * as wm from '../../models/workspace.model';
import * as im from '../../models/workspace-invite.model';
import * as um from '../../models/user';
import { sendWorkspaceInviteEmail } from '../../services/email.service';

const biz = { id: 'ws-1', type: 'business', name: 'Acme' };

beforeEach(() => {
  jest.clearAllMocks();
  (wm.findById as jest.Mock).mockResolvedValue(biz);
});

describe('POST /workspaces/:id/invites', () => {
  it('creates an invite and sends an email (admin)', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('owner');
    (im.createInvite as jest.Mock).mockResolvedValue({ invite: { id: 'inv-1', email: 'new@x.com', role: 'member', status: 'pending' }, token: 'tok123' });

    const res = await request(app).post('/workspaces/ws-1/invites').send({ email: 'new@x.com', role: 'member' });

    expect(res.status).toBe(201);
    expect(im.createInvite).toHaveBeenCalledWith('ws-1', 'new@x.com', 'member', 'me');
    expect(sendWorkspaceInviteEmail).toHaveBeenCalledWith(expect.objectContaining({ toEmail: 'new@x.com', acceptUrl: expect.stringContaining('tok123') }));
  });

  it('403s a non-admin', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('member');
    const res = await request(app).post('/workspaces/ws-1/invites').send({ email: 'new@x.com', role: 'member' });
    expect(res.status).toBe(403);
    expect(im.createInvite).not.toHaveBeenCalled();
  });
});

describe('DELETE /workspaces/:id/invites/:inviteId', () => {
  it('revokes a pending invite (admin)', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('admin');
    (im.revoke as jest.Mock).mockResolvedValue(true);
    const res = await request(app).delete('/workspaces/ws-1/invites/inv-1');
    expect(res.status).toBe(200);
  });
});

describe('GET /invites/:token', () => {
  it('returns public invite info', async () => {
    (im.findByToken as jest.Mock).mockResolvedValue({
      id: 'inv-1', workspaceId: 'ws-1', email: 'new@x.com', role: 'member',
      status: 'pending', expired: false, workspaceName: 'Acme',
    });
    const res = await request(app).get('/invites/tok123');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ workspaceName: 'Acme', email: 'new@x.com', valid: true });
  });

  it('404s an unknown token', async () => {
    (im.findByToken as jest.Mock).mockResolvedValue(null);
    const res = await request(app).get('/invites/nope');
    expect(res.status).toBe(404);
  });
});

describe('POST /invites/:token/accept', () => {
  const pendingInvite = {
    id: 'inv-1', workspaceId: 'ws-1', email: 'new@x.com', role: 'member',
    status: 'pending', expired: false, workspaceName: 'Acme',
  };

  it('accepts when the logged-in email matches', async () => {
    (im.findByToken as jest.Mock).mockResolvedValue(pendingInvite);
    (um.findById as jest.Mock).mockResolvedValue({ id: 'me', email: 'new@x.com' });
    (wm.addMemberByEmail as jest.Mock).mockResolvedValue({});

    const res = await request(app).post('/invites/tok123/accept');

    expect(res.status).toBe(200);
    expect(res.body.data.workspaceId).toBe('ws-1');
    expect(wm.addMemberByEmail).toHaveBeenCalledWith('ws-1', 'new@x.com', 'member');
    expect(im.markAccepted).toHaveBeenCalledWith('inv-1');
  });

  it('403s when the email does not match', async () => {
    (im.findByToken as jest.Mock).mockResolvedValue(pendingInvite);
    (um.findById as jest.Mock).mockResolvedValue({ id: 'me', email: 'someone@else.com' });
    const res = await request(app).post('/invites/tok123/accept');
    expect(res.status).toBe(403);
    expect(wm.addMemberByEmail).not.toHaveBeenCalled();
  });

  it('410s an expired invite', async () => {
    (im.findByToken as jest.Mock).mockResolvedValue({ ...pendingInvite, expired: true });
    const res = await request(app).post('/invites/tok123/accept');
    expect(res.status).toBe(410);
  });
});
