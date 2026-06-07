import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { workspaceContext, requireRole } from '../middleware/workspaceContext';
import * as billingService from '../services/billing.service';
import * as billingModel from '../models/workspace-billing.model';
import * as workspaceModel from '../models/workspace.model';
import * as userModel from '../models/user';

const router = Router();
router.use(authenticate, workspaceContext);

const checkoutSchema = z.object({ planKey: z.string().min(1).max(30) });

// POST /billing/checkout — start a hosted checkout for a plan (owner/admin).
router.post('/checkout', requireRole('owner', 'admin'), validate(checkoutSchema), async (req: Request, res: Response) => {
  try {
    const [ws, user] = await Promise.all([
      workspaceModel.findById(req.workspace!.id),
      userModel.findById(req.user!.id),
    ]);
    if (!user) {
      res.status(401).json({ success: false, data: null, error: 'Not authenticated' });
      return;
    }
    const base = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const result = await billingService.initiateCheckout({
      workspaceId: req.workspace!.id,
      planKey: (req.body as z.infer<typeof checkoutSchema>).planKey,
      country: ws?.country ?? null,
      userEmail: user.email,
      callbackUrl: `${base}/billing/callback`,
    });

    if (result.ok) {
      res.status(200).json({ success: true, data: { url: result.url }, error: null });
      return;
    }
    if (result.reason === 'not_configured') {
      res.status(503).json({ success: false, data: null, error: "Billing isn't available yet — please check back soon." });
      return;
    }
    if (result.reason === 'free_plan') {
      res.status(400).json({ success: false, data: null, error: 'That plan is free — no checkout needed.' });
      return;
    }
    res.status(404).json({ success: false, data: null, error: 'Plan not found' });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to start checkout' });
  }
});

// GET /billing/status — current billing state for the active workspace.
router.get('/status', async (req: Request, res: Response) => {
  try {
    const billing = await billingModel.get(req.workspace!.id);
    if (billing) {
      res.status(200).json({ success: true, data: billing, error: null });
      return;
    }
    const ws = await workspaceModel.findById(req.workspace!.id);
    res.status(200).json({
      success: true,
      data: { workspaceId: req.workspace!.id, plan: ws?.plan ?? 'free', provider: null, status: 'inactive', currentPeriodEnd: null },
      error: null,
    });
  } catch (err) {
    console.error('Billing status error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch billing status' });
  }
});

export default router;
