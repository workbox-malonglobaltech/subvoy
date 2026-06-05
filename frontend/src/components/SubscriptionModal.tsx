import { useState, useEffect, FormEvent } from 'react';
import { Subscription, CreateSubscriptionInput, BillingCycle } from '../../../src/shared/types';
import { api } from '../lib/api';
import { useFxRates } from '../hooks/useFxRates';
import { SUPPORTED_CURRENCIES, formatSubscriptionAmount } from '../utils/currency';

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
}

export function SubscriptionModal({ open, onClose, onSave, initial }: Props) {
  const { rates: fxRates } = useFxRates();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [nextBillingDate, setNextBillingDate] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCatInput, setNewCatInput] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [showNewCatInput, setShowNewCatInput] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setAmount(String(initial.amount));
      setCurrency(initial.currency);
      setBillingCycle(initial.billingCycle);
      setNextBillingDate(initial.nextBillingDate);
      setCategory(initial.category ?? '');
      setNotes(initial.notes ?? '');
    } else {
      setName(''); setAmount(''); setCurrency('USD');
      setBillingCycle('monthly'); setNextBillingDate(''); setCategory(''); setNotes('');
    }
    setError('');
    setShowNewCatInput(false);
    setNewCatInput('');
  }, [initial, open]);

  useEffect(() => {
    if (!open) return;
    api.get<{ builtin: string[]; custom: CustomCategory[] }>('/categories')
      .then(d => setCustomCategories(d.custom))
      .catch(() => {});
  }, [open]);

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

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { setError('Amount must be a positive number'); return; }
    setSaving(true);
    try {
      await onSave({
        name, amount: parsed, currency, billingCycle, nextBillingDate,
        category: category || undefined, notes: notes || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            {initial ? 'Edit Subscription' : 'Add Subscription'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="sub-name" className="block text-sm font-medium text-gray-700 mb-1">
                Service name
              </label>
              <input
                id="sub-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Netflix, Spotify..."
                maxLength={255}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

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
                    <p className="mt-1 text-xs text-gray-400">{secondary} at today's rate</p>
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
                Notes <span className="text-gray-400 font-normal">(optional)</span>
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
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : initial ? 'Save changes' : 'Add subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
