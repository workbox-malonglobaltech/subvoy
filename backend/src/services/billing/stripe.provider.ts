/**
 * Stripe-backed billing provider (rest of world). Uses the REST API directly
 * (form-encoded) so no SDK dependency is needed. Gated on STRIPE_SECRET_KEY;
 * webhook verification needs STRIPE_WEBHOOK_SECRET.
 *
 * v1 uses a one-time Checkout Session (mode=payment) that activates the plan for
 * one period — native subscription mode (recurring Prices) is a follow-up.
 */
import crypto from 'crypto';
import type { PaymentProvider, CheckoutArgs, BillingWebhookEvent } from './types';

const API = 'https://api.stripe.com/v1';

function secret(): string | undefined {
  const k = process.env.STRIPE_SECRET_KEY;
  return k && k !== 'your_stripe_secret_key_here' ? k : undefined;
}

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  isConfigured: () => Boolean(secret()),

  async createCheckout(args: CheckoutArgs) {
    const key = secret();
    if (!key) throw new Error('Stripe is not configured');

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', `${args.callbackUrl}?status=success&ref=${args.reference}`);
    form.set('cancel_url', `${args.callbackUrl}?status=cancelled`);
    form.set('client_reference_id', args.reference);
    form.set('customer_email', args.email);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', args.currency.toLowerCase());
    form.set('line_items[0][price_data][unit_amount]', String(args.amountMinor));
    form.set('line_items[0][price_data][product_data][name]', args.productName);
    form.set('metadata[workspaceId]', args.workspaceId);
    form.set('metadata[planKey]', args.planKey);
    form.set('metadata[reference]', args.reference);

    const res = await fetch(`${API}/checkout/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const json = await res.json() as { url?: string; error?: { message: string } };
    if (!res.ok || !json.url) throw new Error(`Stripe error: ${json.error?.message ?? res.status}`);
    return { url: json.url };
  },

  async parseWebhook(rawBody, signature) {
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!whSecret || !signature) return null;
    if (!verifyStripeSignature(rawBody.toString(), signature, whSecret)) return null;

    let event: { type?: string; data?: { object?: any } };
    try {
      event = JSON.parse(rawBody.toString());
    } catch {
      return null;
    }
    const obj = event.data?.object ?? {};
    const paid = event.type === 'checkout.session.completed' && obj.payment_status === 'paid';
    return {
      type: paid ? 'success' : 'other',
      reference: obj.client_reference_id ?? obj.metadata?.reference ?? '',
      metadata: obj.metadata ?? {},
    } as BillingWebhookEvent;
  },
};

/** Stripe-Signature: t=timestamp,v1=hexHmacSha256(`${t}.${rawBody}`) */
function verifyStripeSignature(rawBody: string, header: string, secretKey: string): boolean {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const expected = crypto.createHmac('sha256', secretKey).update(`${t}.${rawBody}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(v1, 'hex'));
  } catch {
    return false;
  }
}
