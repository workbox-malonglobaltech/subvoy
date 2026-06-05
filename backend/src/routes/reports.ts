/**
 * GET  /reports/payments — filtered payment history from wallet_transactions
 * POST /reports/email    — email a payment report to the authenticated user
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { pool } from '../db';
import * as userModel from '../models/user';
import { sendPaymentReportEmail } from '../services/email.service';

const router = Router();
router.use(authenticate);

// ── Validation ─────────────────────────────────────────────────────────────────

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z.object({
  from:  z.string().regex(datePattern, 'Date must be YYYY-MM-DD').optional(),
  to:    z.string().regex(datePattern, 'Date must be YYYY-MM-DD').optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

const emailSchema = z.object({
  from:     z.string().regex(datePattern).optional(),
  to:       z.string().regex(datePattern).optional(),
  payments: z.array(z.object({
    id:          z.string(),
    description: z.string().max(500),
    currency:    z.string().length(3),
    amount:      z.number().min(0),
    paidAt:      z.string(),
  })).max(500),
});

// ── DB row type ────────────────────────────────────────────────────────────────

interface PaymentRow {
  id: string;
  description: string;
  currency: string;
  amount: string;    // BIGINT → string from pg
  balance_after: string;
  created_at: Date;
}

// ── GET /reports/payments ─────────────────────────────────────────────────────

router.get('/payments', async (req: Request, res: Response) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, data: null, error: parsed.error.issues[0].message });
    }
    const { from, to, limit } = parsed.data;
    const userId = req.user!.id;

    const { rows } = await pool.query<PaymentRow>(
      `SELECT id, description, currency, amount, balance_after, created_at
       FROM wallet_transactions
       WHERE user_id        = $1
         AND type           = 'payment'
         AND direction      = 'out'
         AND ($2::date IS NULL OR created_at::date >= $2::date)
         AND ($3::date IS NULL OR created_at::date <= $3::date)
       ORDER BY created_at DESC
       LIMIT $4`,
      [userId, from ?? null, to ?? null, limit]
    );

    const payments = rows.map(r => ({
      id:           r.id,
      description:  r.description,
      currency:     r.currency,
      amount:       Math.round(Number(r.amount) / 100),
      balanceAfter: Math.round(Number(r.balance_after) / 100),
      paidAt:       r.created_at.toISOString(),
    }));

    return res.json({ success: true, data: payments, error: null });
  } catch (err) {
    console.error('GET /reports/payments error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to fetch payment history' });
  }
});

// ── POST /reports/email ───────────────────────────────────────────────────────

router.post('/email', validate(emailSchema), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { from, to, payments } = req.body as z.infer<typeof emailSchema>;

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(401).json({ success: false, data: null, error: 'User not found' });
    }

    const periodLabel =
      from && to  ? `${from} to ${to}` :
      from        ? `From ${from}`     :
      to          ? `Until ${to}`      :
                    'All time';

    await sendPaymentReportEmail({
      to:          user.email,
      name:        user.name ?? user.email,
      periodLabel,
      payments:    payments.map(p => ({
        name:      p.description.replace(/^Paid:\s*/i, ''),
        date:      new Date(p.paidAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        currency:  p.currency,
        amount:    p.amount,
      })),
    });

    return res.json({ success: true, data: { sent: true }, error: null });
  } catch (err) {
    console.error('POST /reports/email error:', err);
    return res.status(500).json({ success: false, data: null, error: 'Failed to send report email' });
  }
});

export default router;
