import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate';
import { requireAdmin } from '../../middleware/requireAdmin';
import { validate } from '../../middleware/validate';
import { logAudit } from '../../services/audit-logger.service';
import * as countries from '../../services/country-settings.service';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', async (_req: Request, res: Response) => {
  try {
    res.status(200).json({ success: true, data: await countries.listCountrySettings(), error: null });
  } catch (err) {
    console.error('List country settings error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to fetch country settings' });
  }
});

const setSchema = z.object({
  country: z.string().length(2),
  enabled: z.boolean(),
  currency: z.string().min(3).max(3),
  paymentProvider: z.enum(['stripe', 'paystack']),
});

router.put('/', validate(setSchema), async (req: Request, res: Response) => {
  try {
    const { country, enabled, currency, paymentProvider } = req.body as z.infer<typeof setSchema>;
    await countries.setCountrySetting(country, { enabled, currency, paymentProvider });
    await logAudit({
      adminId: req.user!.id,
      action: 'country_settings.update',
      targetType: 'country',
      targetId: country.toUpperCase(),
      details: { enabled, currency, paymentProvider },
      ipAddress: req.ip,
    });
    res.status(200).json({ success: true, data: null, error: null });
  } catch (err) {
    console.error('Set country setting error:', err);
    res.status(500).json({ success: false, data: null, error: 'Failed to update country setting' });
  }
});

export default router;
