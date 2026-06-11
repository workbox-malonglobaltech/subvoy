import { Router, Request, Response } from 'express';
import * as planModel from '../models/plan.model';

const router = Router();

// GET /plans — the plan catalog for the pricing / upgrade UI. PUBLIC: the catalog
// is marketing data (no user info), so the landing page can show pricing to guests.
// (Checkout/upgrade still requires auth via the /billing routes.)
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
