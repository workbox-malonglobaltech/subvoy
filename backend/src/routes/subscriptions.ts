import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { workspaceContext } from '../middleware/workspaceContext';
import * as subModel from '../models/subscription';
import { chargeSubscription } from '../services/payment.service';
import { getEffectiveLimit, isWithinLimit, UNLIMITED } from '../services/entitlements.service';
import { pool } from '../db';

const router = Router();

router.use(authenticate);
// Resolve + membership-check the active workspace; sets req.workspace.
router.use(workspaceContext);

const billingCycleEnum = z.enum(['weekly', 'monthly', 'yearly']);
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createSchema = z.object({
  name: z.string().min(1).max(255),
  amount: z.number().positive(),
  currency: z.string().length(3).optional(),
  billingCycle: billingCycleEnum,
  nextBillingDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  category: z.string().max(100).optional(),
  // HTTPS-only to prevent protocol confusion and future SSRF if backend ever fetches logos
  logoUrl: z.string().url().refine(u => u.startsWith('https://'), {
    message: 'Logo URL must use HTTPS',
  }).optional(),
  notes: z.string().max(1000).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET /subscriptions/summary — registered FIRST, before /:id, to prevent wildcard shadowing
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;

    // Query 1: overall spend + counts
    const { rows: [stats] } = await pool.query<{
      total_monthly: string;
      total_yearly: string;
      active_count: string;
      due_7_days: string;
      due_30_days: string;
    }>(
      `SELECT
        COALESCE(SUM(
          CASE billing_cycle
            WHEN 'monthly' THEN amount
            WHEN 'weekly'  THEN amount * 4.33
            WHEN 'yearly'  THEN amount / 12
          END
        ), 0) AS total_monthly,
        COALESCE(SUM(
          CASE billing_cycle
            WHEN 'monthly' THEN amount * 12
            WHEN 'weekly'  THEN amount * 52
            WHEN 'yearly'  THEN amount
          END
        ), 0) AS total_yearly,
        COUNT(*)::text AS active_count,
        COUNT(*) FILTER (WHERE next_billing_date <= CURRENT_DATE + INTERVAL '7 days')::text  AS due_7_days,
        COUNT(*) FILTER (WHERE next_billing_date <= CURRENT_DATE + INTERVAL '30 days')::text AS due_30_days
      FROM subscriptions
      WHERE workspace_id = $1 AND is_active = TRUE`,
      [workspaceId]
    );

    // Query 2: category breakdown (simple GROUP BY — no window functions)
    const { rows: catRows } = await pool.query<{ category: string; total: string }>(
      `SELECT
        COALESCE(category, 'Uncategorized') AS category,
        ROUND(SUM(amount)::numeric, 2)::text AS total
      FROM subscriptions
      WHERE workspace_id = $1 AND is_active = TRUE
      GROUP BY COALESCE(category, 'Uncategorized')
      ORDER BY SUM(amount) DESC`,
      [workspaceId]
    );

    res.status(200).json({
      success: true,
      data: {
        monthlySpend: parseFloat(stats.total_monthly),
        yearlySpend:  parseFloat(stats.total_yearly),
        activeCount:  parseInt(stats.active_count, 10),
        due7Days:     parseInt(stats.due_7_days, 10),
        due30Days:    parseInt(stats.due_30_days, 10),
        byCategory:   catRows.map(r => ({ category: r.category, total: parseFloat(r.total) })),
      },
      error: null,
    });
  } catch (err) {
    console.error('Summary error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch summary' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const page = { limit: Number(req.query.limit) || undefined, offset: Number(req.query.offset) || undefined };
    const subs = includeInactive
      ? await subModel.findAllByWorkspaceIncludingInactive(req.workspace!.id, page)
      : await subModel.findAllByWorkspace(req.workspace!.id, page);
    res.status(200).json({ success: true, data: subs, error: null });
  } catch (err) {
    console.error('Get subscriptions error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch subscriptions' });
  }
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

// POST /subscriptions/bulk-delete — archive multiple subscriptions
router.post('/bulk-delete', validate(bulkDeleteSchema), async (req: Request, res: Response) => {
  try {
    const { ids } = req.body as z.infer<typeof bulkDeleteSchema>;
    const count = await subModel.bulkDelete(ids, req.workspace!.id);
    res.status(200).json({ success: true, data: { deleted: count }, error: null });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to delete subscriptions' });
  }
});

router.post('/', validate(createSchema), async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;

    // Free-tier cap: limit active payment obligations per workspace (admin-tunable).
    const { rows: [{ count }] } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM subscriptions
       WHERE workspace_id = $1 AND kind = 'payment' AND is_active = TRUE`,
      [workspaceId]
    );
    const current = parseInt(count, 10);
    if (!(await isWithinLimit(workspaceId, 'max_payment_obligations', current))) {
      const limit = await getEffectiveLimit(workspaceId, 'max_payment_obligations');
      res.status(402).json({
        success: false,
        data: null,
        error: `You've reached your plan limit of ${limit === UNLIMITED ? 'unlimited' : limit} tracked items. Upgrade to add more.`,
      });
      return;
    }

    const sub = await subModel.create(workspaceId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: sub, error: null });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to create subscription' });
  }
});

router.put('/:id', validate(updateSchema), async (req: Request, res: Response) => {
  try {
    const sub = await subModel.update(req.params.id, req.workspace!.id, req.body);
    if (!sub) {
      res.status(404).json({ success: false, data: null, error: 'Subscription not found' });
      return;
    }
    res.status(200).json({ success: true, data: sub, error: null });
  } catch (err) {
    console.error('Update subscription error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update subscription' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const hard = req.query.hard === 'true';
    const deleted = hard
      ? await subModel.hardDelete(req.params.id, req.workspace!.id)
      : await subModel.softDelete(req.params.id, req.workspace!.id);
    if (!deleted) {
      res.status(404).json({ success: false, data: null, error: 'Subscription not found' });
      return;
    }
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Delete subscription error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to delete subscription' });
  }
});

// ── POST /subscriptions/:id/pay ───────────────────────────────────────────────
/**
 * Pay a subscription now from the wallet balance.
 *
 * Delegates to the shared payment service (transactional, locks the wallet +
 * subscription rows). USD deducts from usd_balance (cents); NGN from
 * ngn_balance (kobo). On success: logs a 'payment' transaction, advances
 * next_billing_date by one cycle, notifies, and returns { subscription, wallet }.
 * Returns 402 if the balance is insufficient.
 */
router.post('/:id/pay', async (req: Request, res: Response) => {
  const workspaceId = req.workspace!.id;
  const subId  = req.params.id;

  try {
    const result = await chargeSubscription(workspaceId, subId, { source: 'manual' });

    switch (result.code) {
      case 'paid':
        res.status(200).json({
          success: true,
          data: { subscription: result.subscription, wallet: result.wallet },
          error: null,
        });
        return;
      case 'not_found':
        res.status(404).json({ success: false, data: null, error: 'Subscription not found' });
        return;
      case 'paused':
        res.status(400).json({ success: false, data: null, error: 'Subscription is paused' });
        return;
      case 'insufficient':
        res.status(402).json({
          success: false,
          data: null,
          error: `Insufficient balance. Need ${result.needed}, have ${result.have}.`,
        });
        return;
      default:
        // 'not_due' / 'exceeds_limit' only arise for source: 'autopay'
        res.status(400).json({ success: false, data: null, error: 'Payment could not be completed' });
        return;
    }
  } catch (err) {
    console.error(`POST /subscriptions/${subId}/pay error:`, err);
    res.status(500).json({ success: false, data: null, error: 'Payment failed' });
  }
});

export default router;
