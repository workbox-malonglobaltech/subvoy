/**
 * Integration tests for wallet endpoints:
 *   GET  /wallet
 *   GET  /wallet/transactions
 *   POST /wallet/topup
 *   GET  /wallet/settings
 *   PUT  /wallet/settings
 */

import request from 'supertest';

// ── Mocks (must come before any imports that pull in the modules) ─────────────

jest.mock('../../middleware/authenticate', () => ({
  authenticate: (req: any, res: any, next: any) => {
    if (!req.cookies?.token) {
      return res.status(401).json({ success: false, data: null, error: 'Authentication required' });
    }
    req.user = { id: 'user-wallet-001' };
    next();
  },
}));

jest.mock('../../jobs/reminder.job', () => ({ startReminderJob: jest.fn() }));
jest.mock('../../jobs/fx.job',       () => ({ startFxJob: jest.fn() }));
jest.mock('node-cron', () => ({ schedule: jest.fn() }));

const mockQuery = jest.fn();
jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

import app from '../../index';

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-wallet-001';

/** A wallet DB row (ngn_balance / usd_balance are BIGINT → string from pg) */
function walletRow(ngnKobo = 500000, usdCents = 3000) {
  return {
    id: 'wallet-001',
    user_id: USER_ID,
    ngn_balance: String(ngnKobo),
    usd_balance: String(usdCents),
    updated_at: new Date('2026-04-15T12:00:00Z'),
  };
}

function txRow(overrides = {}) {
  return {
    id: 'tx-001',
    user_id: USER_ID,
    type: 'deposit',
    currency: 'NGN',
    amount: '500000',
    direction: 'in',
    description: 'Funded from GTBank',
    balance_after: '500000',
    created_at: new Date('2026-04-15T12:00:00Z'),
    ...overrides,
  };
}

function settingsRow(overrides = {}) {
  return {
    id: 'settings-001',
    user_id: USER_ID,
    auto_topup_enabled: false,
    threshold_usd_cents: 3000,
    topup_ngn_kobo: '5000000',
    scheduled_day: null,
    ...overrides,
  };
}

beforeEach(() => mockQuery.mockReset());

// ── GET /wallet ───────────────────────────────────────────────────────────────

describe('GET /wallet', () => {
  it('returns the wallet with balances in whole units', async () => {
    // findOrCreate: INSERT ON CONFLICT + SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] });             // INSERT
    mockQuery.mockResolvedValueOnce({ rows: [walletRow()] }); // SELECT

    const res = await request(app)
      .get('/wallet')
      .set('Cookie', 'token=fake');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: 'wallet-001',
      userId: USER_ID,
      ngnBalance: 5000,   // 500000 kobo / 100
      usdBalance: 30,     // 3000 cents / 100
    });
    expect(typeof res.body.data.updatedAt).toBe('string');
  });

  it('creates the wallet on first access (zero balances)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [walletRow(0, 0)] });

    const res = await request(app).get('/wallet').set('Cookie', 'token=fake');

    expect(res.status).toBe(200);
    expect(res.body.data.ngnBalance).toBe(0);
    expect(res.body.data.usdBalance).toBe(0);
  });

  it('returns 401 without auth cookie', async () => {
    const res = await request(app).get('/wallet');
    expect(res.status).toBe(401);
  });

  it('returns 500 on DB error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/wallet').set('Cookie', 'token=fake');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/wallet/i);
  });
});

// ── GET /wallet/transactions ──────────────────────────────────────────────────

describe('GET /wallet/transactions', () => {
  it('returns an array of transactions in whole units', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [txRow()] });

    const res = await request(app)
      .get('/wallet/transactions')
      .set('Cookie', 'token=fake');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const tx = res.body.data[0];
    expect(tx.amount).toBe(5000);       // 500000 / 100
    expect(tx.balanceAfter).toBe(5000);
    expect(tx.direction).toBe('in');
    expect(tx.currency).toBe('NGN');
  });

  it('respects ?limit query param (max 100)', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get('/wallet/transactions?limit=50')
      .set('Cookie', 'token=fake');

    // Verify the query was called with limit=50
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/LIMIT/i);
    expect(params).toContain(50);
  });

  it('caps limit at 100', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await request(app)
      .get('/wallet/transactions?limit=999')
      .set('Cookie', 'token=fake');

    const [, params] = mockQuery.mock.calls[0] as [string, unknown[]];
    expect(params).toContain(100);
  });

  it('returns empty array when no transactions', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/wallet/transactions')
      .set('Cookie', 'token=fake');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ── POST /wallet/topup ────────────────────────────────────────────────────────

describe('POST /wallet/topup', () => {
  it('credits NGN balance when destination=ngn', async () => {
    // findOrCreate: INSERT + SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [walletRow(0, 0)] });

    // topUpNgn: UPDATE wallets RETURNING + INSERT wallet_transactions
    const afterRow = walletRow(500000, 0);
    mockQuery.mockResolvedValueOnce({ rows: [afterRow] }); // UPDATE wallets
    mockQuery.mockResolvedValueOnce({ rows: [] });          // INSERT tx

    const res = await request(app)
      .post('/wallet/topup')
      .set('Cookie', 'token=fake')
      .send({ amountNgn: 5000, destination: 'ngn', fundingSource: 'GTBank' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ngnBalance).toBe(5000);
  });

  it('converts NGN and credits USD balance when destination=usd', async () => {
    // findOrCreate
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [walletRow(0, 0)] });

    // topUpNgn (deposit step): UPDATE + INSERT tx
    mockQuery.mockResolvedValueOnce({ rows: [walletRow(500000, 0)] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // topUpNgn (debit step — conversion): UPDATE + INSERT tx
    mockQuery.mockResolvedValueOnce({ rows: [walletRow(0, 0)] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    // topUpUsd (credit USD): UPDATE + INSERT tx
    // ₦5000 / 1600 = $3.125 → 312 cents
    mockQuery.mockResolvedValueOnce({ rows: [walletRow(0, 312)] });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/wallet/topup')
      .set('Cookie', 'token=fake')
      .send({ amountNgn: 5000, destination: 'usd', fundingSource: 'GTBank' });

    expect(res.status).toBe(200);
    expect(res.body.data.usdBalance).toBe(3); // 312 cents / 100 = 3.12 → rounded to 3
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/wallet/topup')
      .set('Cookie', 'token=fake')
      .send({ destination: 'ngn' }); // missing amountNgn, fundingSource

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for negative amount', async () => {
    const res = await request(app)
      .post('/wallet/topup')
      .set('Cookie', 'token=fake')
      .send({ amountNgn: -1000, destination: 'ngn', fundingSource: 'GTBank' });

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid destination', async () => {
    const res = await request(app)
      .post('/wallet/topup')
      .set('Cookie', 'token=fake')
      .send({ amountNgn: 5000, destination: 'eur', fundingSource: 'GTBank' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/wallet/topup')
      .send({ amountNgn: 5000, destination: 'ngn', fundingSource: 'GTBank' });

    expect(res.status).toBe(401);
  });
});

// ── GET /wallet/settings ──────────────────────────────────────────────────────

describe('GET /wallet/settings', () => {
  it('returns default settings on first access', async () => {
    // getSettings: INSERT ON CONFLICT + SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [settingsRow()] });

    const res = await request(app)
      .get('/wallet/settings')
      .set('Cookie', 'token=fake');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      autoTopupEnabled: false,
      thresholdUsd: 30,   // 3000 cents / 100
      topupNgn: 50000,    // 5000000 kobo / 100
      scheduledDay: null,
    });
  });

  it('returns enabled auto top-up settings', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [settingsRow({
      auto_topup_enabled: true,
      threshold_usd_cents: 5000,
      topup_ngn_kobo: '10000000',
      scheduled_day: 15,
    })] });

    const res = await request(app)
      .get('/wallet/settings')
      .set('Cookie', 'token=fake');

    expect(res.body.data).toMatchObject({
      autoTopupEnabled: true,
      thresholdUsd: 50,
      topupNgn: 100000,
      scheduledDay: 15,
    });
  });
});

// ── PUT /wallet/settings ──────────────────────────────────────────────────────

describe('PUT /wallet/settings', () => {
  it('updates autoTopupEnabled', async () => {
    // updateSettings: UPDATE + getSettings (INSERT + SELECT)
    mockQuery.mockResolvedValueOnce({ rows: [] });   // UPDATE wallet_settings
    mockQuery.mockResolvedValueOnce({ rows: [] });   // INSERT ON CONFLICT (getSettings)
    mockQuery.mockResolvedValueOnce({ rows: [settingsRow({ auto_topup_enabled: true })] });

    const res = await request(app)
      .put('/wallet/settings')
      .set('Cookie', 'token=fake')
      .send({ autoTopupEnabled: true });

    expect(res.status).toBe(200);
    expect(res.body.data.autoTopupEnabled).toBe(true);
  });

  it('updates all settings fields', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [settingsRow({
      auto_topup_enabled: true,
      threshold_usd_cents: 2000,
      topup_ngn_kobo: '8000000',
      scheduled_day: 20,
    })] });

    const res = await request(app)
      .put('/wallet/settings')
      .set('Cookie', 'token=fake')
      .send({
        autoTopupEnabled: true,
        thresholdUsd: 20,
        topupNgn: 80000,
        scheduledDay: 20,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.scheduledDay).toBe(20);
  });

  it('accepts empty body without error (no-op update)', async () => {
    // No fields → no UPDATE, falls through to getSettings
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockQuery.mockResolvedValueOnce({ rows: [settingsRow()] });

    const res = await request(app)
      .put('/wallet/settings')
      .set('Cookie', 'token=fake')
      .send({});

    expect(res.status).toBe(200);
  });

  it('returns 400 for scheduledDay out of range', async () => {
    const res = await request(app)
      .put('/wallet/settings')
      .set('Cookie', 'token=fake')
      .send({ scheduledDay: 31 });

    expect(res.status).toBe(400);
  });

  it('returns 400 for negative thresholdUsd', async () => {
    const res = await request(app)
      .put('/wallet/settings')
      .set('Cookie', 'token=fake')
      .send({ thresholdUsd: -10 });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).put('/wallet/settings').send({ autoTopupEnabled: true });
    expect(res.status).toBe(401);
  });
});
