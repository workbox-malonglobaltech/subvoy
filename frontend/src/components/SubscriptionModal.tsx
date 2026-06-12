import { useState, useEffect, useRef, FormEvent } from 'react';
import { Subscription, CreateSubscriptionInput, BillingCycle } from '../../../src/shared/types';
import { api } from '../lib/api';
import { WALLET_ENABLED } from '../lib/features';
import { useFxRates } from '../hooks/useFxRates';
import { SUPPORTED_CURRENCIES, formatSubscriptionAmount } from '../utils/currency';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const BUILTIN_CATEGORIES = [
  'Entertainment', 'Software & SaaS', 'Utilities', 'Health & Fitness',
  'Food & Drink', 'Education', 'Finance', 'Shopping', 'Music', 'Gaming', 'Other',
];

interface CustomCategory { id: string; name: string; }

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateSubscriptionInput) => Promise<void>;
  initial?: Subscription | null;
  /** Default currency for a NEW subscription (the workspace's primary currency). */
  defaultCurrency?: string;
}

export function SubscriptionModal({ open, onClose, onSave, initial, defaultCurrency }: Props) {
  const { rates: fxRates } = useFxRates();
  const [name, setName] = useState('');
  const [service, setService] = useState('');
  const [website, setWebsite] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [autopay, setAutopay] = useState(false);
  const [autopayMax, setAutopayMax] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Surface validation errors even when the user submitted from the bottom of a
  // long form — scroll the error banner into view.
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' });
  }, [error]);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [showNewCatInput, setShowNewCatInput] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setService(initial.service ?? '');
      setWebsite(initial.website ?? '');
      setAmount(String(initial.amount));
      setCurrency(initial.currency);
      setBillingCycle(initial.billingCycle);
      setNextBillingDate(initial.nextBillingDate);
      setCategory(initial.category ?? '');
      setNotes(initial.notes ?? '');
      setAutopay(initial.autopay);
      setAutopayMax(initial.autopayMaxAmount != null ? String(initial.autopayMaxAmount) : '');
    } else {
      setName(''); setService(''); setWebsite(''); setAmount(''); setCurrency(defaultCurrency ?? 'USD');
      setBillingCycle('monthly'); setNextBillingDate(''); setCategory(''); setNotes('');
      setAutopay(false); setAutopayMax('');
    }
    setError('');
    setShowNewCatInput(false);
    setNewCatInput('');
  }, [initial, open, defaultCurrency]);

  useEffect(() => {
    if (!open) return;
    api.get<{ builtin: string[]; custom: CustomCategory[] }>('/categories')
      .then(d => setCustomCategories(d.custom))
      .catch(() => {});
    // For new subscriptions, seed the autopay toggle from the user's default.
    if (!initial && WALLET_ENABLED) {
      api.get<{ autopayDefault: boolean }>('/wallet/settings')
        .then(s => setAutopay(s.autopayDefault))
        .catch(() => {});
    }
  }, [open, initial]);

  async function handleAddCategory() {
    const name = newCatInput.trim();
    if (!name) return;
    setAddingCat(true);
    try {
      const cat = await api.post<CustomCategory>('/categories', { name });
      setCustomCategories(prev => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
      setCategory(name);
      setNewCatInput('');
      setShowNewCatInput(false);
    } catch { /* ignore */ } finally {
      setAddingCat(false);
    }
  }

  // Radix Dialog controls visibility via the `open` prop (handles focus return).

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { setError('Amount must be a positive number'); return; }
    let autopayMaxAmount: number | null = null;
    if (autopay && autopayMax.trim() !== '') {
      const cap = parseFloat(autopayMax);
      if (isNaN(cap) || cap <= 0) { setError('Autopay cap must be a positive number'); return; }
      autopayMaxAmount = cap;
    }
    setSaving(true);
    try {
      await onSave({
        name, amount: parsed, currency, billingCycle, nextBillingDate,
        category: category || undefined, notes: notes || undefined,
        service: service.trim() || undefined, website: website.trim() || undefined,
        autopay, autopayMaxAmount,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit Subscription' : 'Add Subscription'}>
        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="mb-4 rounded-lg bg-error-50 border border-error-600/20 px-4 py-2 text-sm text-error-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="sm:col-span-2 text-eyebrow uppercase text-fg-subtle">Details</p>
            <div className="sm:col-span-2">
              <label htmlFor="sub-name" className="block text-sm font-medium text-gray-700 mb-1">
                Service name <span className="text-fg-subtle font-normal">(business, e.g. Namecheap)</span>
              </label>
              <input
                id="sub-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Namecheap, Netflix, Spotify…"
                maxLength={255}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="sub-service" className="block text-sm font-medium text-gray-700 mb-1">
                Service <span className="text-fg-subtle font-normal">(optional)</span>
              </label>
              <input
                id="sub-service"
                value={service}
                onChange={e => setService(e.target.value)}
                placeholder="Hosting, Streaming…"
                maxLength={120}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="sub-website" className="block text-sm font-medium text-gray-700 mb-1">
                Reference <span className="text-fg-subtle font-normal">(optional)</span>
              </label>
              <input
                id="sub-website"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="Website, tag or note — e.g. namecheap.com, House in Ogba"
                maxLength={255}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <p className="sm:col-span-2 text-eyebrow uppercase text-fg-subtle mt-2">Billing</p>
            <div>
              <label htmlFor="sub-amount" className="block text-sm font-medium text-gray-700 mb-1">
                Amount
              </label>
              <div className="flex gap-2">
                <select
                  id="sub-currency"
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  aria-label="Currency"
                  className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.value} value={c.value}>{c.value}</option>
                  ))}
                </select>
                <input
                  id="sub-amount"
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {/* Live NGN equivalent preview */}
              {(() => {
                const parsed = parseFloat(amount);
                if (!isNaN(parsed) && parsed > 0 && currency !== 'NGN' && fxRates) {
                  const { secondary } = formatSubscriptionAmount(parsed, currency, fxRates);
                  if (secondary) return (
                    <p className="mt-1 text-xs text-fg-subtle">{secondary} at today's rate</p>
                  );
                }
                return null;
              })()}
            </div>

            <div>
              <label htmlFor="sub-billing-cycle" className="block text-sm font-medium text-gray-700 mb-1">
                Billing cycle
              </label>
              <select
                id="sub-billing-cycle"
                value={billingCycle}
                onChange={e => setBillingCycle(e.target.value as BillingCycle)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div>
              <label htmlFor="sub-next-date" className="block text-sm font-medium text-gray-700 mb-1">
                Next billing date
              </label>
              <input
                id="sub-next-date"
                required
                type="date"
                value={nextBillingDate}
                onChange={e => setNextBillingDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="sub-category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="sub-category"
                value={category}
                onChange={e => {
                  if (e.target.value === '__new__') {
                    setCategory('');
                    setNewCatInput('');
                    setShowNewCatInput(true);
                  } else {
                    setCategory(e.target.value);
                    setShowNewCatInput(false);
                  }
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select category</option>
                <optgroup label="Built-in">
                  {BUILTIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>
                {customCategories.length > 0 && (
                  <optgroup label="Custom">
                    {customCategories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </optgroup>
                )}
                <option value="__new__">+ Add new category…</option>
              </select>
              {/* Inline new-category input — shown only after user selects "+ Add new category…" */}
              {showNewCatInput && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="New category name"
                    value={newCatInput}
                    onChange={e => setNewCatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategory(); } }}
                    maxLength={100}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    disabled={addingCat || !newCatInput.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {addingCat ? '…' : 'Add'}
                  </button>
                </div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="sub-notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-fg-subtle font-normal">(optional)</span>
              </label>
              <textarea
                id="sub-notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                maxLength={1000}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {/* Autopay (gated with the wallet feature) */}
            {WALLET_ENABLED && (
            <div className="sm:col-span-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <label htmlFor="sub-autopay" className="flex items-start gap-3 cursor-pointer">
                <input
                  id="sub-autopay"
                  type="checkbox"
                  checked={autopay}
                  onChange={e => setAutopay(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">
                  <span className="font-medium text-gray-900">Pay automatically</span>
                  <span className="block text-gray-500">
                    Charge this from your wallet on each billing date.
                  </span>
                </span>
              </label>

              {autopay && (
                <div className="mt-3 pl-7">
                  <label htmlFor="sub-autopay-max" className="block text-xs font-medium text-gray-600 mb-1">
                    Don’t auto-pay if the amount exceeds <span className="text-fg-subtle">(optional cap)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{currency}</span>
                    <input
                      id="sub-autopay-max"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={autopayMax}
                      onChange={e => setAutopayMax(e.target.value)}
                      placeholder="No limit"
                      className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">
              {saving ? 'Saving...' : initial ? 'Save changes' : 'Add subscription'}
            </Button>
          </div>
        </form>
    </Modal>
  );
}
