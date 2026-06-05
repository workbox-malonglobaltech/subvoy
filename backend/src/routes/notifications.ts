import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import * as notifModel from '../models/notification';
import * as prefModel from '../models/notification-preference';
import { runReminderScan } from '../services/reminder.service';

const router = Router();
router.use(authenticate);

// GET /notifications — list all + unread count
router.get('/', async (req: Request, res: Response) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      notifModel.findAllByUser(req.user!.id),
      notifModel.countUnread(req.user!.id),
    ]);
    res.status(200).json({ success: true, data: { notifications, unreadCount }, error: null });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch notifications' });
  }
});

// PUT /notifications/read-all
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    await notifModel.markAllRead(req.user!.id);
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update notifications' });
  }
});

// PUT /notifications/:id/read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    await notifModel.markRead(req.params.id, req.user!.id);
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update notification' });
  }
});

// GET /notifications/preferences
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const prefs = await prefModel.getOrCreate(req.user!.id);
    res.status(200).json({ success: true, data: prefs, error: null });
  } catch (err) {
    console.error('Get prefs error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch preferences' });
  }
});

const prefsSchema = z.object({
  emailEnabled:       z.boolean().optional(),
  daysBefore:         z.number().int().min(1).max(14).optional(),
  budgetAlertEnabled: z.boolean().optional(),
  budgetLimit:        z.number().positive().nullable().optional(),
});

// PUT /notifications/preferences
router.put('/preferences', validate(prefsSchema), async (req: Request, res: Response) => {
  try {
    const prefs = await prefModel.update(req.user!.id, req.body);
    res.status(200).json({ success: true, data: prefs, error: null });
  } catch (err) {
    console.error('Update prefs error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update preferences' });
  }
});

// POST /notifications/scan — DEV ONLY. Disabled in production to prevent
// any authenticated user from triggering a platform-wide email blast.
if (process.env.NODE_ENV !== 'production') {
  router.post('/scan', async (_req: Request, res: Response) => {
    try {
      await runReminderScan();
      res.status(200).json({ success: true, data: { message: 'Scan complete' }, error: null });
    } catch (err) {
      console.error('Scan error:', err);
      res.status(500).json({ success: false, data: null, error: 'Scan failed' });
    }
  });
}

export default router;
