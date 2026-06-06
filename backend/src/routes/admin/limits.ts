import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validate } from '../../middleware/validate';
import { logAudit } from '../../services/audit-logger.service';
import * as entitlements from '../../services/entitlements.service';

const router = Router();

router.use(authenticate, requireAdmin);

const limitValue = z.number().int().min(-1).max(1_000_000); // -1 = unlimited

// GET /admin/limits — all per-plan defaults.
router.get('/', async (_req: Request, res: Response) => {
  try {
    const limits = await entitlements.listPlanLimits();
    res.status(200).json({ success: true, data: limits, error: null });
  } catch (err) {
    console.error('List plan limits error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch limits' });
  }
});

const setPlanSchema = z.object({
  plan: z.string().min(1).max(30),
  limitKey: z.string().min(1).max(60),
  limitValue,
});

// PUT /admin/limits — upsert a per-plan default (the conversion dial).
router.put('/', validate(setPlanSchema), async (req: Request, res: Response) => {
  try {
    const { plan, limitKey, limitValue: value } = req.body as z.infer<typeof setPlanSchema>;
    await entitlements.setPlanLimit(plan, limitKey, value);
    await logAudit({
      adminId: req.user!.id,
      action: 'plan_limit.update',
      targetType: 'plan',
      targetId: plan,
      details: { limitKey, limitValue: value },
      ipAddress: req.ip,
    });
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Set plan limit error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update limit' });
  }
});

const overrideSchema = z.object({
  workspaceId: z.string().uuid(),
  limitKey: z.string().min(1).max(60),
  limitValue,
});

// PUT /admin/limits/overrides — set a per-workspace override.
router.put('/overrides', validate(overrideSchema), async (req: Request, res: Response) => {
  try {
    const { workspaceId, limitKey, limitValue: value } = req.body as z.infer<typeof overrideSchema>;
    await entitlements.setWorkspaceOverride(workspaceId, limitKey, value);
    await logAudit({
      adminId: req.user!.id,
      action: 'workspace_limit.override',
      targetType: 'workspace',
      targetId: workspaceId,
      details: { limitKey, limitValue: value },
      ipAddress: req.ip,
    });
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Set workspace override error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to set override' });
  }
});

// DELETE /admin/limits/overrides/:workspaceId/:limitKey — clear an override.
router.delete('/overrides/:workspaceId/:limitKey', async (req: Request, res: Response) => {
  try {
    const cleared = await entitlements.clearWorkspaceOverride(req.params.workspaceId, req.params.limitKey);
    if (!cleared) {
      res.status(404).json({ success: false, data: null, error: 'Override not found' });
      return;
    }
    await logAudit({
      adminId: req.user!.id,
      action: 'workspace_limit.override_cleared',
      targetType: 'workspace',
      targetId: req.params.workspaceId,
      details: { limitKey: req.params.limitKey },
      ipAddress: req.ip,
    });
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Clear workspace override error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to clear override' });
  }
});

export default router;
