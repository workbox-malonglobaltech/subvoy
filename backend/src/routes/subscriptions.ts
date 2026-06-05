import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import * as subModel from '../models/subscription';
import * as walletModel from '../models/wallet.model';
import * as notifModel from '../models/notification';
import { pool } from '../db';

const router = Router();

router.use(authenticate);

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
    const userId = req.user!.id;

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
      WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    // Query 2: category breakdown (simple GROUP BY — no window functions)
    const { rows: catRows } = await pool.query<{ category: string; total: string }>(
      `SELECT
        COALESCE(category, 'Uncategorized') AS category,
        ROUND(SUM(amount)::numeric, 2)::text AS total
      FROM subscriptions
      WHERE user_id = $1 AND is_active = TRUE
      GROUP BY COALESCE(category, 'Uncategorized')
      ORDER BY SUM(amount) DESC`,
      [userId]
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
    const subs = includeInactive
      ? await subModel.findAllByUserIncludingInactive(req.user!.id)
      : await subModel.findAllByUser(req.user!.id);
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
    const count = await subModel.bulkDelete(ids, req.user!.id);
    res.status(200).json({ success: true, data: { deleted: count }, error: null });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to delete subscriptions' });
  }
});

router.post('/', validate(createSchema), async (req: Request, res: Response) => {
  try {
    const sub = await subModel.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: sub, error: null });
  } catch (err) {
    console.error('Create subscription error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to create subscription' });
  }
});

router.put('/:id', validate(updateSchema), async (req: Request, res: Response) => {
  try {
    const sub = await subModel.update(req.params.id, req.user!.id, req.body);
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
      ? await subModel.hardDelete(req.params.id, req.user!.id)
      : await subModel.softDelete(req.params.id, req.user!.id);
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
 * Pay a subscription from the wallet balance.
 *
 * - USD subscriptions deduct from usd_balance (stored in cents).
 * - NGN subscriptions deduct from ngn_balance (stored in kobo).
 * - Returns 402 if the wallet balance is insufficient.
 * - On success: logs a 'payment' transaction, advances next_billing_date by
 *   one billing cycle, creates an in-app notification, returns { subscription, wallet }.
 */
router.post('/:id/pay', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const subId  = req.params.id;

  try {
    // 1. Load subscription (must belong to this user and be active)
    const sub = await subModel.findById(subId, userId);
    if (!sub) {
      res.status(404).json({ success: false, data: null, error: 'Subscription not found' });
      return;
    }
    if (!sub.isActive) {
      res.status(400).json({ success: false, data: null, error: 'Subscription is paused' });
      return;
    }

    // 2. Ensure wallet exists
    const wallet = await walletModel.findOrCreate(userId);

    // 3. Determine currency and calculate raw (integer) amount to deduct
    const isNgn        = sub.currency.toUpperCase() === 'NGN';
    const rawDeduct    = isNgn
      ? Math.round(sub.amount * 100)   // naira → kobo
      : Math.round(sub.amount * 100);  // dollars → cents
    const balance      = isNgn ? wallet.ngnBalance * 100 : wallet.usdBalance * 100;

    // 4. Insufficient balance check
    if (balance < rawDeduct) {
      const needed   = isNgn ? `₦${sub.amount.toLocaleString()}` : `$${sub.amount.toFixed(2)}`;
      const have     = isNgn
        ? `₦${wallet.ngnBalance.toLocaleString()}`
        : `$${wallet.usdBalance.toFixed(2)}`;
      res.status(402).json({
        success: false,
        data: null,
        error: `Insufficient balance. Need ${needed}, have ${have}.`,
      });
      return;
    }

    // 5. Deduct from wallet (negative amount = deduction)
    const updatedWallet = isNgn
      ? await walletModel.topUpNgn(userId, -rawDeduct, `Paid: ${sub.name}`, 'payment')
      : await walletModel.topUpUsd(userId, -rawDeduct, `Paid: ${sub.name}`, 'payment');

    // 6. Advance next_billing_date by one cycle
    const updatedSub = await subModel.advanceNextBillingDate(subId, userId);

    // 7. In-app notification
    await notifModel.create({
      userId,
      subscriptionId: subId,
      type: 'payment_reminder',
      title: `${sub.name} paid`,
      message: `${sub.currency.toUpperCase() === 'NGN' ? '₦' : '$'}${sub.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} deducted from your ${isNgn ? 'NGN' : 'USD'} wallet. Next billing: ${updatedSub?.nextBillingDate ?? 'N/A'}.`,
    });

    res.status(200).json({
      success: true,
      data: { subscription: updatedSub, wallet: updatedWallet },
      error: null,
    });
  } catch (err) {
    console.error(`POST /subscriptions/${subId}/pay error:`, err);
    res.status(500).json({ success: false, data: null, error: 'Payment failed' });
  }
});

export default router;
