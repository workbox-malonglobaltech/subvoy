/**
 * Integration tests for /workspaces (list + create business).
 */

import request from 'supertest';

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'user-123', role: 'user' }; next(); },
}));

jest.mock('../../services/auth.service', () => ({
  verifyToken: jest.fn().mockReturnValue({ userId: 'user-123', tokenVersion: 0 }),
}));

jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));

jest.mock('../../models/workspace.model', () => ({
  listForUser: jest.fn(),
  createBusinessWorkspace: jest.fn(),
}));

import app from '../../index';
import * as workspaceModel from '../../models/workspace.model';

beforeEach(() => jest.clearAllMocks());

describe('GET /workspaces', () => {
  it('returns the workspaces the user belongs to', async () => {
    (workspaceModel.listForUser as jest.Mock).mockResolvedValue([
      { id: 'ws-1', type: 'personal', name: 'Personal', role: 'owner' },
      { id: 'ws-2', type: 'business', name: 'Acme', role: 'owner' },
    ]);

    const res = await request(app).get('/workspaces');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].type).toBe('personal');
    expect(workspaceModel.listForUser).toHaveBeenCalledWith('user-123');
  });

  it('returns 500 when the model throws', async () => {
    (workspaceModel.listForUser as jest.Mock).mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/workspaces');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /workspaces', () => {
  it('creates a business workspace', async () => {
    (workspaceModel.createBusinessWorkspace as jest.Mock).mockResolvedValue({
      id: 'ws-2', type: 'business', name: 'Acme', country: 'NG', role: 'owner',
    });

    const res = await request(app).post('/workspaces').send({ name: 'Acme', country: 'NG' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ type: 'business', name: 'Acme' });
    expect(workspaceModel.createBusinessWorkspace).toHaveBeenCalledWith('user-123', 'Acme', 'NG');
  });

  it('rejects an empty name with 400', async () => {
    const res = await request(app).post('/workspaces').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
