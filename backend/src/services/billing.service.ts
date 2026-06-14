/**
 * Billing orchestration. Provider-agnostic; gated on vendor keys (returns
 * 'not_configured' when no provider is set up, like the email service).
 *
 * v1: pay-per-period — a successful charge activates the plan until
 * current_period_end. Native auto-renew subscriptions are a follow-up.
 */
import crypto from 'crypto';
import * as planModel from '../models/plan.model';
import * as workspaceModel from '../models/workspace.model';
import * as billingModel from '../models/workspace-billing.model';
import * as billingHistoryModel from '../models/billing-history.model';
import { selectProvider, getProvider } from './billing';

export type CheckoutResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'not_configured' | 'free_plan' | 'plan_not_found' };

export async function initiateCheckout(args: {
  workspaceId: string;
  planKey: string;
  country: string | null;
  userEmail: string;
  callbackUrl: string;
}): Promise<CheckoutResult> {
  const plan = await planModel.findByKey(args.planKey);
  if (!plan) return { ok: false, reason: 'plan_not_found' };
  if (plan.priceMinor <= 0) return { ok: false, reason: 'free_plan' };

  const provider = selectProvider(args.country);
  if (!provider) return { ok: false, reason: 'not_configured' };

  const reference = `sub_${crypto.randomBytes(12).toString('hex')}`;
  await billingModel.markPending(args.workspaceId, plan.key, provider.name, reference);

  const { url } = await provider.createCheckout({
    workspaceId: args.workspaceId,
    planKey: plan.key,
    amountMinor: plan.priceMinor,
    currency: plan.currency,
    email: args.userEmail,
    reference,
    callbackUrl: args.callbackUrl,
    productName: `Subvoy ${plan.displayName}`,
  });

  return { ok: true, url };
}

/** Verifies + applies a provider webhook. Returns whether a plan was activated. */
export async function handleWebhook(
  providerName: string,
  rawBody: string | Buffer,
  signature: string | undefined
): Promise<{ handled: boolean }> {
  const provider = getProvider(providerName);
  if (!provider) return { handled: false };

  const event = await provider.parseWebhook(rawBody, signature);
  if (!event || event.type !== 'success') return { handled: false };

  // Resolve target workspace + plan from metadata, falling back to the reference.
  let workspaceId = typeof event.metadata.workspaceId === 'string' ? event.metadata.workspaceId : null;
  let planKey = typeof event.metadata.planKey === 'string' ? event.metadata.planKey : null;
  if ((!workspaceId || !planKey) && event.reference) {
    const byRef = await billingModel.findByReference(event.reference);
    if (byRef) { workspaceId = byRef.workspaceId; planKey = byRef.plan; }
  }
  if (!workspaceId || !planKey) return { handled: false };

  const plan = await planModel.findByKey(planKey);
  const periodEnd = new Date();
  if (plan?.interval === 'year') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  await workspaceModel.setPlan(workspaceId, planKey);
  await billingModel.markActive(workspaceId, planKey, providerName, periodEnd);

  // Append to the payment history log (non-critical — never fail activation on it).
  try {
    await billingHistoryModel.record({
      workspaceId,
      plan: planKey,
      provider: providerName,
      reference: event.reference ?? null,
      amountMinor: plan?.priceMinor ?? 0,
      currency: plan?.currency ?? 'USD',
      periodEnd,
    });
  } catch (err) {
    console.error('[billing] Failed to record billing history:', err);
  }

  return { handled: true };
}
