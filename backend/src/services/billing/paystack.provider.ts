import {
  isPaystackEnabled,
  initializeTransaction,
  validateWebhookSignature,
} from '../paystack.service';
import type { PaymentProvider, CheckoutArgs, BillingWebhookEvent } from './types';

/** Paystack-backed billing provider (Africa). Reuses the wallet integration. */
export const paystackProvider: PaymentProvider = {
  name: 'paystack',

  isConfigured: () => isPaystackEnabled(),

  async createCheckout(args: CheckoutArgs) {
    const { authorizationUrl } = await initializeTransaction({
      email: args.email,
      amountKobo: args.amountMinor,   // Paystack takes minor units of the currency
      currency: args.currency,
      reference: args.reference,
      callbackUrl: args.callbackUrl,
      metadata: { workspaceId: args.workspaceId, planKey: args.planKey, kind: 'plan_checkout' },
    });
    return { url: authorizationUrl };
  },

  async parseWebhook(rawBody, signature) {
    if (!signature || !validateWebhookSignature(rawBody, signature)) return null;
    let payload: { event?: string; data?: { reference?: string; metadata?: Record<string, unknown> } };
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      return null;
    }
    const data = payload.data ?? {};
    return {
      type: payload.event === 'charge.success' ? 'success' : 'other',
      reference: data.reference ?? '',
      metadata: data.metadata ?? {},
    } as BillingWebhookEvent;
  },
};
