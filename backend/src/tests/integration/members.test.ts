/**
 * Integration tests for /workspaces/:id/members — team management.
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'me', role: 'user' }; next(); },
}));

jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'me', tokenVersion: 0 }),
}));

jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));

jest.mock('../../models/workspace.model', () => ({
  findById: jest.fn(),
  getMemberRole: jest.fn(),
  listMembers: jest.fn(),
  addMemberByEmail: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
}));

import app from '../../index';
import * as wm from '../../models/workspace.model';

const biz = { id: 'ws-1', type: 'business', name: 'Acme' };

beforeEach(() => {
  jest.clearAllMocks();
  (wm.findById as jest.Mock).mockResolvedValue(biz);
});

describe('GET /workspaces/:id/members', () => {
  it('returns members for a member', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('owner');
    (wm.listMembers as jest.Mock).mockResolvedValue([{ userId: 'me', email: 'me@x.com', name: null, role: 'owner', createdAt: '' }]);
    const res = await request(app).get('/workspaces/ws-1/members');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('403s a non-member', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue(null);
    const res = await request(app).get('/workspaces/ws-1/members');
    expect(res.status).toBe(403);
  });
});

describe('POST /workspaces/:id/members', () => {
  it('adds an existing user by email', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('owner');
    (wm.addMemberByEmail as jest.Mock).mockResolvedValue({ userId: 'u2', email: 'u2@x.com', name: 'Two', role: 'member', createdAt: '' });
    const res = await request(app).post('/workspaces/ws-1/members').send({ email: 'u2@x.com', role: 'member' });
    expect(res.status).toBe(201);
    expect(wm.addMemberByEmail).toHaveBeenCalledWith('ws-1', 'u2@x.com', 'member');
  });

  it('404s when no account has that email', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('admin');
    (wm.addMemberByEmail as jest.Mock).mockResolvedValue(null);
    const res = await request(app).post('/workspaces/ws-1/members').send({ email: 'ghost@x.com', role: 'member' });
    expect(res.status).toBe(404);
  });

  it('403s a non-admin', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('member');
    const res = await request(app).post('/workspaces/ws-1/members').send({ email: 'u2@x.com', role: 'member' });
    expect(res.status).toBe(403);
    expect(wm.addMemberByEmail).not.toHaveBeenCalled();
  });

  it('400s an invalid role', async () => {
    (wm.getMemberRole as jest.Mock).mockResolvedValue('owner');
    const res = await request(app).post('/workspaces/ws-1/members').send({ email: 'u2@x.com', role: 'owner' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /workspaces/:id/members/:userId', () => {
  it('protects the owner role', async () => {
    (wm.getMemberRole as jest.Mock)
      .mockResolvedValueOnce('owner')   // caller
      .mockResolvedValueOnce('owner');  // target
    const res = await request(app).put('/workspaces/ws-1/members/u-owner').send({ role: 'member' });
    expect(res.status).toBe(403);
    expect(wm.updateMemberRole).not.toHaveBeenCalled();
  });

  it('updates a member role', async () => {
    (wm.getMemberRole as jest.Mock)
      .mockResolvedValueOnce('owner')   // caller
      .mockResolvedValueOnce('member'); // target
    (wm.updateMemberRole as jest.Mock).mockResolvedValue({ userId: 'u2', email: 'u2@x.com', name: null, role: 'admin', createdAt: '' });
    const res = await request(app).put('/workspaces/ws-1/members/u2').send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });
});

describe('DELETE /workspaces/:id/members/:userId', () => {
  it('protects the owner', async () => {
    (wm.getMemberRole as jest.Mock)
      .mockResolvedValueOnce('owner')   // caller
      .mockResolvedValueOnce('owner');  // target
    const res = await request(app).delete('/workspaces/ws-1/members/u-owner');
    expect(res.status).toBe(403);
    expect(wm.removeMember).not.toHaveBeenCalled();
  });

  it('removes a member', async () => {
    (wm.getMemberRole as jest.Mock)
      .mockResolvedValueOnce('admin')   // caller
      .mockResolvedValueOnce('member'); // target
    (wm.removeMember as jest.Mock).mockResolvedValue(true);
    const res = await request(app).delete('/workspaces/ws-1/members/u2');
    expect(res.status).toBe(200);
  });
});
