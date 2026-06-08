/**
 * REAL-DATABASE test for workspace tenant isolation. Verifies that workspace-
 * scoped queries never leak across workspaces — against actual Postgres.
 *
 * Requires a migrated DB at DATABASE_URL. Run: npm run test:db
 */
import crypto from 'crypto';
import { pool } from '../../db';
import * as workspaceModel from '../../models/workspace.model';
import * as subModel from '../../models/subscription';

afterAll(async () => { await pool.end(); });

describe('workspace isolation (real Postgres)', () => {
  it('findAllByWorkspace returns only the requesting workspace\'s rows', async () => {
    const email = `db-iso-${crypto.randomBytes(6).toString('hex')}@example.com`;
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'x') RETURNING id`, [email]
    );
    const userId = rows[0].id;

    const personal = await workspaceModel.ensurePersonalWorkspace(userId);
    const biz = await workspaceModel.createBusinessWorkspace(userId, 'Acme Ltd');

    await subModel.create(personal.id, userId, {
      name: 'Netflix', amount: 10, billingCycle: 'monthly', nextBillingDate: '2026-12-01',
    });
    await subModel.create(biz.id, userId, {
      name: 'AWS', amount: 99, billingCycle: 'monthly', nextBillingDate: '2026-12-01',
    });

    const personalSubs = await subModel.findAllByWorkspace(personal.id);
    const bizSubs = await subModel.findAllByWorkspace(biz.id);

    expect(personalSubs.map(s => s.name)).toEqual(['Netflix']);
    expect(bizSubs.map(s => s.name)).toEqual(['AWS']);
    // Cross-workspace lookup must miss.
    expect(await subModel.findById(personalSubs[0].id, biz.id)).toBeNull();
  });
});
