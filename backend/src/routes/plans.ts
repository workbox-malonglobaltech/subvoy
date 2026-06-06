import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import * as planModel from '../models/plan.model';

const router = Router();

router.use(authenticate);

// GET /plans — the plan catalog for the pricing / upgrade UI.
router.get('/', async (req: Request, res: Response) => {
  try {
    const audience = req.query.audience;
    let plans = await planModel.listActive();
    if (audience === 'personal' || audience === 'business') {
      plans = plans.filter(p => p.audience === audience);
    }
    res.status(200).json({ success: true, data: plans, error: null });
  } catch (err) {
    console.error('List plans error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch plans' });
  }
});

export default router;
