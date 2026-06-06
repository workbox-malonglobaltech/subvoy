import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import * as workspaceModel from '../models/workspace.model';

const router = Router();

// Authenticated, but NOT workspace-scoped — this endpoint lists/creates the
// workspaces themselves, so it must not require an active-workspace context.
router.use(authenticate);

// GET /workspaces — every workspace the user belongs to, with their role.
router.get('/', async (req: Request, res: Response) => {
  try {
    const workspaces = await workspaceModel.listForUser(req.user!.id);
    res.status(200).json({ success: true, data: workspaces, error: null });
  } catch (err) {
    console.error('List workspaces error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch workspaces' });
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  /** ISO 3166-1 alpha-2 country, optional */
  country: z.string().length(2).optional(),
});

// POST /workspaces — create a Business workspace (caller becomes owner).
router.post('/', validate(createSchema), async (req: Request, res: Response) => {
  try {
    const { name, country } = req.body as z.infer<typeof createSchema>;
    const workspace = await workspaceModel.createBusinessWorkspace(req.user!.id, name, country);
    res.status(201).json({ success: true, data: workspace, error: null });
  } catch (err) {
    console.error('Create workspace error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to create workspace' });
  }
});

export default router;
