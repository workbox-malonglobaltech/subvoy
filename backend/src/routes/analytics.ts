import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { workspaceContext } from '../middleware/workspaceContext';
import { pool } from '../db';
import * as subModel from '../models/subscription';

const router = Router();
router.use(authenticate);
router.use(workspaceContext); // analytics is scoped to the active workspace

// GET /analytics/monthly — 12-month spend breakdown
// Always returns 12 data points using generate_series, filling gaps with 0
router.get('/monthly', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;

    const { rows } = await pool.query<{ month: string; total: string }>(
      `SELECT
         TO_CHAR(m.month, 'YYYY-MM') AS month,
         COALESCE(SUM(
           CASE s.billing_cycle
             WHEN 'monthly' THEN s.amount
             WHEN 'weekly'  THEN s.amount * 4.33
             WHEN 'yearly'  THEN s.amount / 12
           END
         ), 0)::numeric(10,2) AS total
       FROM generate_series(
         DATE_TRUNC('month', NOW()) - INTERVAL '11 months',
         DATE_TRUNC('month', NOW()),
         INTERVAL '1 month'
       ) AS m(month)
       LEFT JOIN obligations s
         ON s.workspace_id = $1
         AND s.is_active = TRUE
         AND DATE_TRUNC('month', s.created_at) <= m.month
       GROUP BY m.month
       ORDER BY m.month ASC`,
      [workspaceId]
    );

    const months = rows.map(r => ({ month: r.month, total: parseFloat(r.total) }));
    res.status(200).json({ success: true, data: { months }, error: null });
  } catch (err) {
    console.error('Analytics monthly error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch analytics' });
  }
});

// GET /analytics/export — download subscriptions as CSV
router.get('/export', async (req: Request, res: Response) => {
  try {
    const subs = await subModel.findAllByWorkspace(req.workspace!.id);

    const header = ['Name', 'Amount', 'Currency', 'Billing Cycle', 'Next Billing Date', 'Category', 'Notes', 'Active'];
    const rows = subs.map(s => [
      `"${(s.name ?? '').replace(/"/g, '""')}"`,
      s.amount,
      s.currency,
      s.billingCycle,
      s.nextBillingDate,
      `"${(s.category ?? '').replace(/"/g, '""')}"`,
      `"${(s.notes ?? '').replace(/"/g, '""')}"`,
      s.isActive ? 'Yes' : 'No',
    ]);

    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="subvoy-subscriptions.csv"');
    res.status(200).send(csv);
  } catch (err) {
    console.error('Analytics export error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to export subscriptions' });
  }
});

export default router;
