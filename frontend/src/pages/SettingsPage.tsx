import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { TeamManagement } from '../components/TeamManagement';
import { ChangePasswordSection } from '../components/ChangePasswordSection';
import { PlanBillingSection } from '../components/PlanBillingSection';
import { Button } from '../components/ui/Button';
import { useSummary } from '../hooks/useSummary';
import { SUPPORTED_CURRENCIES } from '../utils/currency';

interface Prefs {
  emailEnabled: boolean;
  daysBefore: number;
  budgetAlertEnabled: boolean;
  budgetLimit: number | null;
  /** Per-currency monthly budgets, e.g. { NGN: 50000, USD: 200 }. */
  budgetLimits: Record<string, number>;
}

const symbolFor = (c: string) => SUPPORTED_CURRENCIES.find(x => x.value === c)?.symbol ?? c;

interface CustomCategory { id: string; name: string; }

export function SettingsPage() {
  const { user, logout, updateProfile } = useAuth();
  const { active } = useWorkspace();
  const toast = useToast();
  const navigate = useNavigate();

  // ── Notification prefs ─────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState<Prefs>({ emailEnabled: true, daysBefore: 3, budgetAlertEnabled: false, budgetLimit: null, budgetLimits: {} });
  // Currencies the user actually uses (from their subscriptions) → one budget each.
  const { summary } = useSummary([]);
  const budgetCurrencies = (summary?.byCurrency ?? []).map(c => c.currency);
  const currencyList = budgetCurrencies.length ? budgetCurrencies : ['USD'];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Custom categories ──────────────────────────────────────────────────────
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);

  // ── Name edit ──────────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);

  // ── Danger zone ────────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // ── Dev tools ──────────────────────────────────────────────────────────────
  const [scanStatus, setScanStatus] = useState('');

  useEffect(() => {
    api.get<Prefs>('/notifications/preferences')
      .then(setPrefs)
      .catch(() => {})
      .finally(() => setLoading(false));
    api.get<{ builtin: string[]; custom: CustomCategory[] }>('/categories')
      .then(d => setCustomCategories(d.custom))
      .catch(() => {});
  }, []);

  // sync name field if user object updates
  useEffect(() => {
    if (!editingName) setNameValue(user?.name ?? '');
  }, [user, editingName]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    try {
      await updateProfile(nameValue.trim() || null);
      setEditingName(false);
      toast.success('Name updated');
    } catch {
      toast.error('Failed to update name');
    } finally {
      setNameSaving(false);
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;
    setAddingCategory(true);
    try {
      const cat = await api.post<CustomCategory>('/categories', { name });
      setCustomCategories(prev => [...prev, cat]);
      setNewCategory('');
      toast.success(`"${name}" added`);
    } catch {
      toast.error('Failed to add category');
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    setDeletingCatId(id);
    try {
      await api.delete(`/categories/${id}`);
      setCustomCategories(prev => prev.filter(c => c.id !== id));
      toast.success('Category deleted');
    } catch {
      toast.error('Failed to delete category');
    } finally {
      setDeletingCatId(null);
    }
  }

  async function handleSavePrefs() {
    setSaving(true);
    try {
      await api.put('/notifications/preferences', prefs);
      toast.success('Preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError('');

    // For safety, require the user to type "delete" regardless of auth method
    if (deleteConfirmText.toLowerCase() !== 'delete') {
      setDeleteError('Type "delete" to confirm');
      return;
    }

    setDeleting(true);
    try {
      const body: Record<string, string> = {};
      if (user?.hasPassword) body.password = deletePassword;
      await api.delete('/auth/account');
      // Logout client-side — server already cleared the cookie
      await logout();
      navigate('/login');
      toast.success('Account deleted');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  }

  async function handleScan() {
    setScanStatus('Running...');
    try {
      await api.post('/notifications/scan', {});
      setScanStatus('Scan complete — check your notifications.');
      toast.success('Reminder scan complete');
    } catch {
      setScanStatus('Scan failed. Check server logs.');
      toast.error('Reminder scan failed');
    }
    setTimeout(() => setScanStatus(''), 5000);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-page-enter">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* ── Account ──────────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" aria-labelledby="account-heading">
          <h2 id="account-heading" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Account</h2>

          <dl className="space-y-4">
            {/* Name row */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <dt className="text-xs text-gray-500 mb-0.5">Name</dt>
                {editingName ? (
                  <form onSubmit={handleSaveName} className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      value={nameValue}
                      onChange={e => setNameValue(e.target.value)}
                      placeholder="Your name"
                      maxLength={255}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                    />
                    <Button type="submit" size="sm" loading={nameSaving}>
                      {nameSaving ? 'Saving…' : 'Save'}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setEditingName(false); setNameValue(user?.name ?? ''); }}
                      className="text-sm text-fg-muted hover:text-fg"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <dd className="text-sm font-medium text-gray-900">{user?.name ?? <span className="text-fg-subtle italic">Not set</span>}</dd>
                )}
              </div>
              {!editingName && (
                <button
                  onClick={() => setEditingName(true)}
                  className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {/* Email row */}
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{user?.email}</dd>
            </div>

            {/* Member since */}
            <div className="flex justify-between text-sm">
              <dt className="text-gray-500">Member since</dt>
              <dd className="font-medium text-gray-900">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  : '—'}
              </dd>
            </div>

          </dl>
        </section>

        {/* ── Plan & billing ────────────────────────────────────────────────── */}
        <PlanBillingSection />

        {/* ── Team (Business workspaces only) ───────────────────────────────── */}
        {active?.type === 'business' && <TeamManagement />}

        {/* ── Change Password ───────────────────────────────────────────────── */}
        <ChangePasswordSection />

        {/* ── Notification Preferences ──────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" aria-labelledby="notifications-heading">
          <h2 id="notifications-heading" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Notifications</h2>

          {loading ? (
            <div className="flex justify-center py-6" role="status" aria-label="Loading preferences">
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Email toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">Email reminders</p>
                  <p className="text-xs text-gray-500 mt-0.5">Receive an email before each payment is due</p>
                </div>
                <button
                  onClick={() => setPrefs(p => ({ ...p, emailEnabled: !p.emailEnabled }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${prefs.emailEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                  role="switch"
                  aria-checked={prefs.emailEnabled}
                  aria-label="Email reminders"
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.emailEnabled ? 'translate-x-5' : ''}`} aria-hidden="true" />
                </button>
              </div>

              {/* Days before */}
              <div>
                <label htmlFor="days-before" className="text-sm font-medium text-gray-900">
                  Remind me <span className="text-indigo-600 font-bold">{prefs.daysBefore}</span> day{prefs.daysBefore !== 1 ? 's' : ''} before
                </label>
                <input
                  id="days-before"
                  type="range"
                  min={1}
                  max={14}
                  value={prefs.daysBefore}
                  onChange={e => setPrefs(p => ({ ...p, daysBefore: parseInt(e.target.value, 10) }))}
                  className="w-full mt-2 accent-indigo-600"
                />
                <div className="flex justify-between text-xs text-fg-subtle mt-1" aria-hidden="true">
                  <span>1 day</span><span>7 days</span><span>14 days</span>
                </div>
              </div>

              {/* Budget alert */}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Monthly budget alert</p>
                    <p className="text-xs text-gray-500 mt-0.5">Get notified when your spend exceeds a limit</p>
                  </div>
                  <button
                    onClick={() => setPrefs(p => ({ ...p, budgetAlertEnabled: !p.budgetAlertEnabled }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${prefs.budgetAlertEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                    role="switch"
                    aria-checked={prefs.budgetAlertEnabled}
                    aria-label="Budget alert"
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${prefs.budgetAlertEnabled ? 'translate-x-5' : ''}`} aria-hidden="true" />
                  </button>
                </div>

                {prefs.budgetAlertEnabled && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-500">
                      Set a monthly limit per currency. We alert you once a month if your spend in that
                      currency exceeds it — each currency is tracked on its own (no conversion).
                    </p>
                    {currencyList.map(cur => (
                      <div key={cur}>
                        <label htmlFor={`budget-${cur}`} className="block text-sm font-medium text-gray-700 mb-1">
                          Budget ({cur}/month)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle text-sm">{symbolFor(cur)}</span>
                          <input
                            id={`budget-${cur}`}
                            type="number"
                            min={1}
                            step={1}
                            value={prefs.budgetLimits?.[cur] ?? ''}
                            onChange={e => {
                              const v = e.target.value;
                              setPrefs(p => {
                                const next = { ...(p.budgetLimits ?? {}) };
                                if (v === '' || !(parseFloat(v) > 0)) delete next[cur];
                                else next[cur] = parseFloat(v);
                                return { ...p, budgetLimits: next };
                              });
                            }}
                            placeholder="e.g. 100"
                            className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSavePrefs} loading={saving} className="w-full">
                {saving ? 'Saving…' : 'Save preferences'}
              </Button>

              {/* Test reminder */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-900 mb-0.5">Test your reminders</p>
                <p className="text-xs text-gray-500 mb-3">
                  Sends a reminder scan now — you'll receive an email for any subscriptions due within your configured window.
                </p>
                <button
                  onClick={handleScan}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Send test reminder to {user?.email}
                </button>
                {scanStatus && (
                  <p className="mt-2 text-sm text-gray-600" role="status" aria-live="polite">{scanStatus}</p>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Custom Categories ─────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Custom Categories</h2>

          {/* Add new category */}
          <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
            <input
              type="text"
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              placeholder="e.g. Travel, Kids, Pets…"
              maxLength={50}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="New category name"
            />
            <button
              type="submit"
              disabled={addingCategory || !newCategory.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {addingCategory ? 'Adding…' : 'Add'}
            </button>
          </form>

          {customCategories.length === 0 ? (
            <p className="text-sm text-fg-subtle">No custom categories yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100" role="list">
              {customCategories.map(cat => (
                <li key={cat.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <span className="text-sm text-gray-900">{cat.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat.id)}
                    disabled={deletingCatId === cat.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                    aria-label={`Delete ${cat.name}`}
                  >
                    {deletingCatId === cat.id ? 'Deleting…' : 'Delete'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Developer Tools (DEV only) ────────────────────────────────────── */}
        {import.meta.env.DEV && (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm" aria-labelledby="devtools-heading">
            <h2 id="devtools-heading" className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Developer Tools</h2>
            <p className="text-xs text-gray-500 mb-4">Manually trigger the reminder scan (normally runs daily at 8 AM)</p>
            <button
              onClick={handleScan}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Run reminder scan now
            </button>
            {scanStatus && (
              <p className="mt-3 text-sm text-gray-600" role="status" aria-live="polite">{scanStatus}</p>
            )}
          </section>
        )}

        {/* ── Danger Zone ───────────────────────────────────────────────────── */}
        <section className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm" aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-1">Danger Zone</h2>
          <p className="text-sm text-gray-500 mb-4">
            Permanently delete your account and all your data — subscriptions, wallet history, and notifications. This cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete my account
            </button>
          ) : (
            <form onSubmit={handleDeleteAccount} className="space-y-4 border border-red-200 rounded-xl p-4 bg-red-50">
              <p className="text-sm font-medium text-red-800">Are you absolutely sure?</p>

              {/* Password confirmation for password accounts */}
              {user?.hasPassword && (
                <div>
                  <label htmlFor="delete-password" className="block text-sm font-medium text-gray-700 mb-1">
                    Enter your password to confirm
                  </label>
                  <input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
              )}

              {/* Type "delete" to confirm */}
              <div>
                <label htmlFor="delete-confirm-text" className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-mono font-bold">delete</span> to confirm
                </label>
                <input
                  id="delete-confirm-text"
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="delete"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>

              {deleteError && (
                <p className="text-sm text-red-700" role="alert">{deleteError}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(''); }}
                  className="flex-1 rounded-lg border border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || deleteConfirmText.toLowerCase() !== 'delete'}
                  className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete account'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
