import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { workspaceContext, requireCapability } from '../middleware/workspaceContext';
import * as complianceModel from '../models/compliance.model';
import * as workspaceModel from '../models/workspace.model';
import { isWithinLimit, getEffectiveLimit, UNLIMITED } from '../services/entitlements.service';
import { pool } from '../db';

const router = Router();

// Compliance is a Business-workspace capability — guard every route.
router.use(authenticate);
router.use(workspaceContext);
router.use(requireCapability('compliance'));

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const cadenceEnum = z.enum(['one_off', 'weekly', 'monthly', 'quarterly', 'yearly']);
const offsets = z.array(z.number().int().min(0).max(365)).max(10);

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  authority: z.string().max(255).optional(),
  referenceNumber: z.string().max(120).optional(),
  jurisdiction: z.string().length(2).optional(),
  cadence: cadenceEnum,
  dueDate: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  reminderOffsets: offsets.optional(),
  penaltyNote: z.string().max(1000).optional(),
  penaltyAmount: z.number().positive().nullable().optional(),
  penaltyCurrency: z.string().length(3).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
});

/** Returns true if assigneeUserId is unset/null or a member of the workspace. */
async function assigneeIsValid(workspaceId: string, assigneeUserId: string | null | undefined): Promise<boolean> {
  if (!assigneeUserId) return true;
  return (await workspaceModel.getMemberRole(workspaceId, assigneeUserId)) !== null;
}

const updateSchema = createSchema.partial().extend({
  status: z.enum(['open', 'submitted', 'completed']).optional(),
  isActive: z.boolean().optional(),
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const page = { limit: Number(req.query.limit) || undefined, offset: Number(req.query.offset) || undefined };
    const items = await complianceModel.findAllByWorkspace(req.workspace!.id, includeInactive, page);
    res.status(200).json({ success: true, data: items, error: null });
  } catch (err) {
    console.error('Get compliance items error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch compliance items' });
  }
});

router.post('/', validate(createSchema), async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspace!.id;

    // Plan cap on active compliance obligations (admin-tunable).
    const { rows: [{ count }] } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM compliance_items WHERE workspace_id = $1 AND is_active = TRUE`,
      [workspaceId]
    );
    if (!(await isWithinLimit(workspaceId, 'max_compliance_obligations', parseInt(count, 10)))) {
      const limit = await getEffectiveLimit(workspaceId, 'max_compliance_obligations');
      res.status(402).json({
        success: false, data: null,
        error: `You've reached your plan limit of ${limit === UNLIMITED ? 'unlimited' : limit} compliance items. Upgrade to add more.`,
      });
      return;
    }

    if (!(await assigneeIsValid(workspaceId, req.body.assigneeUserId))) {
      res.status(400).json({ success: false, data: null, error: 'Assignee must be a workspace member' });
      return;
    }
    const item = await complianceModel.create(workspaceId, req.user!.id, req.body);
    res.status(201).json({ success: true, data: item, error: null });
  } catch (err) {
    console.error('Create compliance item error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to create compliance item' });
  }
});

router.put('/:id', validate(updateSchema), async (req: Request, res: Response) => {
  try {
    if (!(await assigneeIsValid(req.workspace!.id, req.body.assigneeUserId))) {
      res.status(400).json({ success: false, data: null, error: 'Assignee must be a workspace member' });
      return;
    }
    const item = await complianceModel.update(req.params.id, req.workspace!.id, req.body);
    if (!item) {
      res.status(404).json({ success: false, data: null, error: 'Compliance item not found' });
      return;
    }
    res.status(200).json({ success: true, data: item, error: null });
  } catch (err) {
    console.error('Update compliance item error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update compliance item' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await complianceModel.softDelete(req.params.id, req.workspace!.id);
    if (!deleted) {
      res.status(404).json({ success: false, data: null, error: 'Compliance item not found' });
      return;
    }
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Delete compliance item error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to delete compliance item' });
  }
});

export default router;
