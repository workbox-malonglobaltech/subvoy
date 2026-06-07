/**
 * Provider billing webhooks. Mounted with express.raw BEFORE express.json so the
 * raw body is available for signature verification.
 *
 *   POST /billing/webhook/:provider   (provider = 'paystack' | 'stripe')
 */
import { Router, Request, Response } from 'express';
import * as billingService from '../services/billing.service';

const router = Router();

router.post('/:provider', async (req: Request, res: Response) => {
  try {
    const signature =
      (req.headers['x-paystack-signature'] as string | undefined) ??
      (req.headers['stripe-signature'] as string | undefined);

    // req.body is a Buffer here (express.raw).
    await billingService.handleWebhook(req.params.provider, req.body as Buffer, signature);

    // Always 200 so providers don't retry indefinitely; verification happens inside.
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Billing webhook error:', err);
    res.status(200).json({ received: true });
  }
});

export default router;
