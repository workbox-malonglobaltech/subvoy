/**
 * Unit tests for the billing service — provider selection, checkout result
 * branches, and webhook → plan activation. Providers + models are mocked.
 */

jest.mock('../../services/billing', () => ({
  selectProvider: jest.fn(),
  getProvider: jest.fn(),
}));
jest.mock('../../models/plan.model', () => ({ findByKey: jest.fn() }));
jest.mock('../../models/workspace.model', () => ({ setPlan: jest.fn() }));
jest.mock('../../models/workspace-billing.model', () => ({
  markPending: jest.fn(),
  markActive: jest.fn(),
  findByReference: jest.fn(),
}));

import { initiateCheckout, handleWebhook } from '../../services/billing.service';
import { selectProvider, getProvider } from '../../services/billing';
import * as planModel from '../../models/plan.model';
import * as workspaceModel from '../../models/workspace.model';
import * as billingModel from '../../models/workspace-billing.model';

const paidPlan = { key: 'plus', displayName: 'Plus', priceMinor: 250, currency: 'USD', interval: 'month' };

beforeEach(() => jest.clearAllMocks());

describe('initiateCheckout', () => {
  const args = { workspaceId: 'ws-1', planKey: 'plus', country: 'US', userEmail: 'a@b.com', callbackUrl: 'http://cb' };

  it('returns not_configured when no provider is set up', async () => {
    (planModel.findByKey as jest.Mock).mockResolvedValue(paidPlan);
    (selectProvider as jest.Mock).mockReturnValue(null);
    expect(await initiateCheckout(args)).toEqual({ ok: false, reason: 'not_configured' });
  });

  it('rejects checkout for a free plan', async () => {
    (planModel.findByKey as jest.Mock).mockResolvedValue({ ...paidPlan, priceMinor: 0 });
    expect(await initiateCheckout(args)).toEqual({ ok: false, reason: 'free_plan' });
  });

  it('rejects an unknown plan', async () => {
    (planModel.findByKey as jest.Mock).mockResolvedValue(null);
    expect(await initiateCheckout(args)).toEqual({ ok: false, reason: 'plan_not_found' });
  });

  it('creates a checkout and records it as pending', async () => {
    (planModel.findByKey as jest.Mock).mockResolvedValue(paidPlan);
    const createCheckout = jest.fn().mockResolvedValue({ url: 'https://pay/abc' });
    (selectProvider as jest.Mock).mockReturnValue({ name: 'paystack', createCheckout });

    const result = await initiateCheckout(args);

    expect(result).toEqual({ ok: true, url: 'https://pay/abc' });
    expect(billingModel.markPending).toHaveBeenCalledWith('ws-1', 'plus', 'paystack', expect.stringMatching(/^sub_/));
    expect(createCheckout).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 250, currency: 'USD', email: 'a@b.com' }));
  });
});

describe('handleWebhook', () => {
  it('activates the plan on a success event', async () => {
    const parseWebhook = jest.fn().mockResolvedValue({ type: 'success', reference: 'sub_x', metadata: { workspaceId: 'ws-1', planKey: 'plus' } });
    (getProvider as jest.Mock).mockReturnValue({ name: 'paystack', parseWebhook });
    (planModel.findByKey as jest.Mock).mockResolvedValue(paidPlan);

    const out = await handleWebhook('paystack', Buffer.from('{}'), 'sig');

    expect(out).toEqual({ handled: true });
    expect(workspaceModel.setPlan).toHaveBeenCalledWith('ws-1', 'plus');
    expect(billingModel.markActive).toHaveBeenCalledWith('ws-1', 'plus', 'paystack', expect.any(Date));
  });

  it('ignores a non-success / invalid webhook', async () => {
    (getProvider as jest.Mock).mockReturnValue({ name: 'paystack', parseWebhook: jest.fn().mockResolvedValue(null) });
    const out = await handleWebhook('paystack', Buffer.from('{}'), undefined);
    expect(out).toEqual({ handled: false });
    expect(workspaceModel.setPlan).not.toHaveBeenCalled();
  });

  it('falls back to the reference when metadata is missing', async () => {
    (getProvider as jest.Mock).mockReturnValue({ name: 'stripe', parseWebhook: jest.fn().mockResolvedValue({ type: 'success', reference: 'sub_y', metadata: {} }) });
    (billingModel.findByReference as jest.Mock).mockResolvedValue({ workspaceId: 'ws-2', plan: 'team' });
    (planModel.findByKey as jest.Mock).mockResolvedValue({ ...paidPlan, key: 'team', interval: 'year' });

    const out = await handleWebhook('stripe', Buffer.from('{}'), 'sig');

    expect(out).toEqual({ handled: true });
    expect(workspaceModel.setPlan).toHaveBeenCalledWith('ws-2', 'team');
  });

  it('returns not handled for an unknown provider', async () => {
    (getProvider as jest.Mock).mockReturnValue(null);
    expect(await handleWebhook('nope', Buffer.from('{}'), 's')).toEqual({ handled: false });
  });
});
