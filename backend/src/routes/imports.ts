import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/authenticate';
import { parseCSV } from '../services/csv-parser.service';
import { detectRecurring } from '../services/detection.service';
import * as detectedModel from '../models/detected-subscription';
import * as subModel from '../models/subscription';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      const err = Object.assign(new Error('Only CSV files are accepted'), { status: 400, expose: true });
      cb(err as any);
    }
  },
});

// POST /imports/csv — upload + detect
router.post('/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, data: null, error: 'No file uploaded' });
      return;
    }

    const transactions = parseCSV(req.file.buffer);
    if (transactions.length === 0) {
      res.status(400).json({ success: false, data: null, error: 'No valid transactions found in CSV' });
      return;
    }

    const detected = detectRecurring(transactions);
    if (detected.length === 0) {
      res.status(200).json({
        success: true,
        data: { detected: [], transactionCount: transactions.length, message: 'No recurring patterns detected' },
        error: null,
      });
      return;
    }

    const saved = await detectedModel.createMany(req.user!.id, detected);
    res.status(200).json({
      success: true,
      data: { detected: saved, transactionCount: transactions.length },
      error: null,
    });
  } catch (err) {
    // Log the full error server-side but never reflect raw parser/library
    // messages back to the client — they may contain internal column names or paths.
    console.error('CSV import error:', err);
    res.status(400).json({
      success: false,
      data: null,
      error: 'Failed to parse CSV. Ensure the file contains date, description, and amount columns.',
    });
  }
});

// GET /imports/detected — get pending detected subs
router.get('/detected', async (req: Request, res: Response) => {
  try {
    const items = await detectedModel.findPendingByUser(req.user!.id);
    res.status(200).json({ success: true, data: items, error: null });
  } catch (err) {
    console.error('Get detected error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch detected subscriptions' });
  }
});

// POST /imports/detected/:id/confirm — add to real subscriptions
router.post('/detected/:id/confirm', async (req: Request, res: Response) => {
  try {
    const detected = await detectedModel.confirm(req.params.id, req.user!.id);
    if (!detected) {
      res.status(404).json({ success: false, data: null, error: 'Not found' });
      return;
    }

    // Add to real subscriptions
    const sub = await subModel.create(req.user!.id, {
      name: detected.name,
      amount: detected.amount,
      currency: detected.currency,
      billingCycle: detected.billingCycle as 'weekly' | 'monthly' | 'yearly',
      nextBillingDate: detected.nextBillingDate ?? new Date().toISOString().split('T')[0],
      category: detected.category ?? undefined,
    });

    res.status(201).json({ success: true, data: sub, error: null });
  } catch (err) {
    console.error('Confirm detected error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to confirm subscription' });
  }
});

// POST /imports/detected/:id/dismiss
router.post('/detected/:id/dismiss', async (req: Request, res: Response) => {
  try {
    const ok = await detectedModel.dismiss(req.params.id, req.user!.id);
    if (!ok) {
      res.status(404).json({ success: false, data: null, error: 'Not found' });
      return;
    }
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Dismiss detected error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to dismiss' });
  }
});

export default router;
