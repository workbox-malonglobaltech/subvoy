import { Router, Request, Response } from 'express';
import { getCachedRates } from '../services/fx.service';

const router = Router();

/**
 * GET /fx/rates
 * Returns the latest cached FX rates (no auth required — public data).
 * The response includes a fetchedAt timestamp so clients can show staleness.
 */
router.get('/rates', async (_req: Request, res: Response) => {
  try {
    const fxRates = await getCachedRates();

    // Warn if rates are stale (older than 26 hours — allows for job drift)
    const fetchedAt = new Date(fxRates.fetchedAt);
    const ageMs = Date.now() - fetchedAt.getTime();
    const stale = ageMs > 26 * 60 * 60 * 1000;

    res.status(200).json({
      success: true,
      data: {
        ...fxRates,
        stale,
      },
      error: null,
    });
  } catch (err) {
    console.error('GET /fx/rates error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch FX rates' });
  }
});

export default router;
