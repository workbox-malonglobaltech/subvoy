/**
 * Integration tests for /compliance — CRUD plus the Business-only capability gate.
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

// Active workspace is mutable per test; requireCapability mirrors the real rule.
const mockWs: any = { id: 'ws-biz', type: 'business', role: 'owner' };
jest.mock('../../middleware/workspaceContext', () => ({
  workspaceContext: (req: any, _res: any, next: any) => { req.workspace = mockWs; next(); },
  requireCapability: (kind: string) => (req: any, res: any, next: any) => {
    if (req.workspace.type !== 'business' && kind !== 'payment') {
      res.status(403).json({ success: false, data: null, error: `This workspace cannot use ${kind} features` });
      return;
    }
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../models/compliance.model', () => ({
  findAllByWorkspace: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
}));

import app from '../../index';
import * as complianceModel from '../../models/compliance.model';

const item = {
  id: 'c-1', workspaceId: 'ws-biz', title: 'CAC Annual Return', description: null,
  authority: 'CAC', referenceNumber: null, jurisdiction: 'NG', cadence: 'yearly',
  dueDate: '2026-12-31', reminderOffsets: [30, 7, 1], status: 'open', penaltyNote: null,
  isActive: true, overdue: false, createdAt: '', updatedAt: '',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockWs.type = 'business';
});

describe('compliance CRUD (business workspace)', () => {
  it('GET /compliance lists items', async () => {
    (complianceModel.findAllByWorkspace as jest.Mock).mockResolvedValue([item]);
    const res = await request(app).get('/compliance');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(complianceModel.findAllByWorkspace).toHaveBeenCalledWith('ws-biz', false);
  });

  it('POST /compliance creates an item', async () => {
    (complianceModel.create as jest.Mock).mockResolvedValue(item);
    const res = await request(app).post('/compliance').send({
      title: 'CAC Annual Return', authority: 'CAC', cadence: 'yearly', dueDate: '2026-12-31',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('CAC Annual Return');
    expect(complianceModel.create).toHaveBeenCalledWith('ws-biz', 'user-123', expect.objectContaining({ title: 'CAC Annual Return' }));
  });

  it('POST /compliance rejects an invalid cadence with 400', async () => {
    const res = await request(app).post('/compliance').send({ title: 'X', cadence: 'daily', dueDate: '2026-12-31' });
    expect(res.status).toBe(400);
  });

  it('PUT /compliance/:id updates status', async () => {
    (complianceModel.update as jest.Mock).mockResolvedValue({ ...item, status: 'completed' });
    const res = await request(app).put('/compliance/c-1').send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('completed');
  });

  it('DELETE /compliance/:id soft-deletes', async () => {
    (complianceModel.softDelete as jest.Mock).mockResolvedValue(true);
    const res = await request(app).delete('/compliance/c-1');
    expect(res.status).toBe(200);
  });
});

describe('capability gate', () => {
  it('blocks compliance in a personal workspace with 403', async () => {
    mockWs.type = 'personal';
    const res = await request(app).get('/compliance');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/cannot use compliance/i);
    expect(complianceModel.findAllByWorkspace).not.toHaveBeenCalled();
  });
});
