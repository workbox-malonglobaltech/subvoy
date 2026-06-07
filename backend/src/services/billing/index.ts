import type { PaymentProvider } from './types';
import { paystackProvider } from './paystack.provider';
import { stripeProvider } from './stripe.provider';

export * from './types';
export { paystackProvider, stripeProvider };

// Countries routed to Paystack (Africa); everything else routes to Stripe.
const PAYSTACK_COUNTRIES = new Set(['NG', 'GH', 'KE', 'ZA', 'CI', 'EG', 'RW', 'UG', 'TZ']);

const PROVIDERS: Record<string, PaymentProvider> = {
  paystack: paystackProvider,
  stripe: stripeProvider,
};

/** Look up a provider by its name. */
export function getProvider(name: string): PaymentProvider | null {
  return PROVIDERS[name] ?? null;
}

/**
 * Picks the provider for a workspace country: the region match if configured,
 * otherwise any configured provider, otherwise null (billing not configured).
 */
export function selectProvider(country: string | null): PaymentProvider | null {
  const preferred = country && PAYSTACK_COUNTRIES.has(country.toUpperCase())
    ? paystackProvider
    : stripeProvider;
  if (preferred.isConfigured()) return preferred;

  const fallback = preferred === paystackProvider ? stripeProvider : paystackProvider;
  if (fallback.isConfigured()) return fallback;

  return null;
}
