import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import * as categoryModel from '../models/user-category';

const router = Router();
router.use(authenticate);

// GET /categories — built-in + user custom categories
const BUILTIN = [
  'Entertainment', 'Software & SaaS', 'Utilities', 'Health & Fitness',
  'Food & Drink', 'Education', 'Finance', 'Shopping', 'Music', 'Gaming', 'Other',
];

router.get('/', async (req: Request, res: Response) => {
  try {
    const custom = await categoryModel.list(req.user!.id);
    res.status(200).json({
      success: true,
      data: { builtin: BUILTIN, custom },
      error: null,
    });
  } catch (err) {
    console.error('List categories error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch categories' });
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(100).transform(s => s.trim()),
});

// POST /categories — create custom category
router.post('/', validate(createSchema), async (req: Request, res: Response) => {
  try {
    const { name } = req.body as z.infer<typeof createSchema>;

    // Prevent duplicating a built-in name (case-insensitive)
    if (BUILTIN.some(b => b.toLowerCase() === name.toLowerCase())) {
      res.status(409).json({ success: false, data: null, error: 'That category already exists' });
      return;
    }

    const category = await categoryModel.create(req.user!.id, name);
    res.status(201).json({ success: true, data: category, error: null });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to create category' });
  }
});

// DELETE /categories/:id — remove custom category
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await categoryModel.remove(req.user!.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ success: false, data: null, error: 'Category not found' });
      return;
    }
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to delete category' });
  }
});

export default router;
