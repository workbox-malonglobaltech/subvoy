import { useState } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAdminCountrySettings, type CountrySetting } from '../../hooks/useAdminCountrySettings';
import { useToast } from '../../contexts/ToastContext';

function Row({ c, onSave }: { c: CountrySetting; onSave: (c: CountrySetting) => Promise<void> }) {
  const [currency, setCurrency] = useState(c.currency);
  const [provider, setProvider] = useState(c.paymentProvider);
  const [enabled, setEnabled] = useState(c.enabled);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const dirty = currency !== c.currency || provider !== c.paymentProvider || enabled !== c.enabled;

  async function save() {
    if (!/^[A-Za-z]{3}$/.test(currency)) { toast.error('Currency must be a 3-letter code'); return; }
    setSaving(true);
    try { await onSave({ country: c.country, currency: currency.toUpperCase(), paymentProvider: provider, enabled }); toast.success(`${c.country} saved`); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-10 font-semibold text-fg">{c.country}</span>
      <input value={currency} onChange={e => setCurrency(e.target.value)} maxLength={3}
        className="w-20 rounded-lg border border-line px-2 py-1 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <select value={provider} onChange={e => setProvider(e.target.value as CountrySetting['paymentProvider'])}
        className="rounded-lg border border-line px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
        <option value="stripe">Stripe</option>
        <option value="paystack">Paystack</option>
      </select>
      <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary/40" />
        Enabled
      </label>
      <button onClick={save} disabled={!dirty || saving}
        className="ml-auto rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-fg hover:bg-primary-700 disabled:opacity-40 transition-colors">
        {saving ? '…' : 'Save'}
      </button>
    </div>
  );
}

function AddCountry({ onSave, existing }: { onSave: (c: CountrySetting) => Promise<void>; existing: string[] }) {
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');
  const [provider, setProvider] = useState<CountrySetting['paymentProvider']>('stripe');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function add() {
    if (!/^[A-Za-z]{2}$/.test(country)) { toast.error('Country must be a 2-letter code'); return; }
    if (existing.includes(country.toUpperCase())) { toast.error('Country already configured'); return; }
    if (!/^[A-Za-z]{3}$/.test(currency)) { toast.error('Currency must be a 3-letter code'); return; }
    setSaving(true);
    try { await onSave({ country: country.toUpperCase(), currency: currency.toUpperCase(), paymentProvider: provider, enabled: true }); toast.success('Country added'); setCountry(''); setCurrency(''); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Failed to add'); }
    finally { setSaving(false); }
  }

  return (
    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
      <div><label className="block text-xs text-fg-subtle mb-1">Country (ISO-2)</label>
        <input value={country} onChange={e => setCountry(e.target.value)} maxLength={2} placeholder="e.g. FR"
          className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
      <div><label className="block text-xs text-fg-subtle mb-1">Currency</label>
        <input value={currency} onChange={e => setCurrency(e.target.value)} maxLength={3} placeholder="EUR"
          className="w-20 rounded-lg border border-line px-2 py-1.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>
      <div><label className="block text-xs text-fg-subtle mb-1">Provider</label>
        <select value={provider} onChange={e => setProvider(e.target.value as CountrySetting['paymentProvider'])}
          className="rounded-lg border border-line px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
          <option value="stripe">Stripe</option><option value="paystack">Paystack</option>
        </select></div>
      <button onClick={add} disabled={saving}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:bg-primary-700 disabled:opacity-40 transition-colors">
        {saving ? '…' : 'Add country'}
      </button>
    </div>
  );
}

export function AdminCountrySettingsPage() {
  const { countries, loading, error, save } = useAdminCountrySettings();

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <h1 className="text-xl font-bold text-fg mb-1">Country Settings</h1>
        <p className="text-sm text-fg-subtle mb-6">
          Per-country local currency + payment provider. Non-US countries display their local currency alongside USD; the US shows USD only.
        </p>

        {loading ? (
          <p className="text-sm text-fg-subtle">Loading…</p>
        ) : error ? (
          <p className="text-sm text-error-600">{error}</p>
        ) : (
          <section className="bg-surface rounded-2xl border border-line p-5 shadow-card">
            <div className="flex items-center gap-3 pb-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">
              <span className="w-10">Country</span><span className="w-20">Currency</span><span>Provider</span>
            </div>
            <div className="divide-y divide-line">
              {countries.map(c => <Row key={c.country} c={c} onSave={save} />)}
            </div>
            <AddCountry onSave={save} existing={countries.map(c => c.country)} />
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
