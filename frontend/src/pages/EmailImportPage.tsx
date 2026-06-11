import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { NavBar } from '../components/NavBar';

interface Connection {
  id: string;
  provider: 'gmail' | 'outlook';
  email: string | null;
  connectedAt: string;
}

interface DetectedSub {
  id: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string | null;
  category: string | null;
  confidence: number;
  occurrences: number;
}

type ItemStatus = 'pending' | 'confirmed' | 'dismissed';

interface ItemState {
  sub: DetectedSub;
  status: ItemStatus;
  loading: boolean;
}

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-green-100 text-green-700'
    : score >= 65 ? 'bg-amber-100 text-amber-700'
    : 'bg-gray-100 text-gray-500';
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {score}% match
    </span>
  );
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const CYCLE_LABEL: Record<string, string> = { weekly: '/wk', monthly: '/mo', yearly: '/yr' };

// ─── IMAP Modal ───────────────────────────────────────────────────────────────

interface ImapModalProps {
  onClose: () => void;
  onScanComplete: (detected: DetectedSub[], emailCount: number, message?: string) => void;
}

function ImapModal({ onClose, onScanComplete }: ImapModalProps) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [scanning, setScanning] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setScanning(true);
    try {
      const data = await api.post<{ detected: DetectedSub[]; emailCount: number; message?: string }>(
        '/email-import/imap/scan',
        { email, password }
      );
      onScanComplete(data.detected, data.emailCount, data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to connect to email server');
    } finally {
      setScanning(false);
    }
  }

  // Detect if the domain is Gmail or Yahoo to show app-password hint
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const needsAppPassword = ['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com'].includes(domain);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Connect Email</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-gray-600 p-1 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-5">
          Enter your email credentials. We'll scan your inbox for subscription receipts and won't store your password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={needsAppPassword ? 'App password (16 characters)' : 'Your email password'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* App password hint for Gmail / Yahoo */}
          {needsAppPassword && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <p className="font-semibold mb-0.5">Gmail / Yahoo requires an App Password</p>
              <p>
                {domain.includes('gmail') ? (
                  <>Go to <strong>Google Account → Security → 2-Step Verification → App passwords</strong>, create one for "Mail", and paste the 16-character code here.</>
                ) : (
                  <>Go to <strong>Yahoo Account Security → Generate app password</strong> and use that code instead of your regular password.</>
                )}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={scanning}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {scanning ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Scanning inbox…
              </>
            ) : (
              'Scan my inbox'
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-fg-subtle">
          Your password is used only for this scan and is never stored.
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function EmailImportPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [emailCount, setEmailCount] = useState<number | null>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const [showImapModal, setShowImapModal] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get<{ connections: Connection[] }>('/email-import/status');
      setConnections(data.connections);
    } catch {
      /* ignore */
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Handle OAuth callback result
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error     = searchParams.get('error');
    if (connected) {
      toast.success(`${connected === 'gmail' ? 'Gmail' : 'Outlook'} connected successfully`);
      fetchStatus();
    } else if (error) {
      const messages: Record<string, string> = {
        google_denied:   'Google sign-in was cancelled',
        google_config:   'Google OAuth not configured',
        google_exchange: 'Failed to complete Google sign-in',
      };
      toast.error(messages[error] ?? `Connection failed: ${error}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gmailConnected  = connections.some(c => c.provider === 'gmail');
  const gmailConnection = connections.find(c => c.provider === 'gmail');

  async function handleDisconnect(provider: 'gmail' | 'outlook') {
    try {
      await api.delete(`/email-import/disconnect/${provider}`);
      setConnections(prev => prev.filter(c => c.provider !== provider));
      toast.success('Disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  }

  async function handleScan() {
    setScanning(true);
    setItems([]);
    setEmailCount(null);
    try {
      const data = await api.post<{ detected: DetectedSub[]; emailCount: number; message?: string }>(
        '/email-import/scan', {}
      );
      applyResults(data.detected, data.emailCount, data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  function applyResults(detected: DetectedSub[], count: number, message?: string) {
    setEmailCount(count);
    if (detected.length === 0) {
      toast.info(message ?? 'No recurring patterns detected');
    } else {
      setItems(detected.map(sub => ({ sub, status: 'pending', loading: false })));
      toast.success(`Found ${detected.length} subscription${detected.length !== 1 ? 's' : ''}`);
    }
  }

  function handleImapComplete(detected: DetectedSub[], count: number, message?: string) {
    setShowImapModal(false);
    applyResults(detected, count, message);
  }

  async function handleConfirm(id: string) {
    setItems(prev => prev.map(i => i.sub.id === id ? { ...i, loading: true } : i));
    try {
      await api.post(`/imports/detected/${id}/confirm`, {});
      setItems(prev => prev.map(i => i.sub.id === id ? { ...i, status: 'confirmed', loading: false } : i));
      toast.success('Subscription added to tracker');
    } catch {
      setItems(prev => prev.map(i => i.sub.id === id ? { ...i, loading: false } : i));
      toast.error('Failed to add subscription');
    }
  }

  async function handleDismiss(id: string) {
    setItems(prev => prev.map(i => i.sub.id === id ? { ...i, loading: true } : i));
    try {
      await api.post(`/imports/detected/${id}/dismiss`, {});
      setItems(prev => prev.map(i => i.sub.id === id ? { ...i, status: 'dismissed', loading: false } : i));
      toast.info('Subscription dismissed');
    } catch {
      setItems(prev => prev.map(i => i.sub.id === id ? { ...i, loading: false } : i));
      toast.error('Failed to dismiss');
    }
  }

  const hasConnections = connections.length > 0;
  const pending   = items.filter(i => i.status === 'pending').length;
  const confirmed = items.filter(i => i.status === 'confirmed').length;

  return (
    <>
      {showImapModal && (
        <ImapModal
          onClose={() => setShowImapModal(false)}
          onScanComplete={handleImapComplete}
        />
      )}

      <div className="min-h-screen bg-gray-50">
        <NavBar />

        <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-page-enter">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import from Email</h1>
            <p className="mt-1 text-gray-500 text-sm">
              Connect your inbox and we'll automatically detect subscription receipts from the last 6 months.
            </p>
          </div>

          {/* Provider cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Gmail — OAuth */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6">
                    <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.910 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
                      fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Gmail</p>
                  {gmailConnected && gmailConnection?.email && (
                    <p className="text-xs text-fg-subtle truncate max-w-[140px]">{gmailConnection.email}</p>
                  )}
                </div>
                {gmailConnected && (
                  <span className="ml-auto text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                    Connected
                  </span>
                )}
              </div>

              {gmailConnected ? (
                <button
                  onClick={() => handleDisconnect('gmail')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <a
                  href="/email-import/connect/google"
                  className="block w-full text-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  Connect Gmail
                </a>
              )}
            </div>

            {/* Other Email — IMAP */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Other Email</p>
                  <p className="text-xs text-fg-subtle">Yahoo, Outlook, custom domain…</p>
                </div>
              </div>

              <button
                onClick={() => setShowImapModal(true)}
                className="block w-full text-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
              >
                Connect Email
              </button>
            </div>
          </div>

          {/* Scan button — shown when Gmail is connected */}
          {!statusLoading && hasConnections && items.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-900 mb-1">Ready to scan</p>
              <p className="text-sm text-gray-500 mb-5">
                We'll search your inbox for subscription receipts and payment confirmations.
              </p>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="rounded-xl bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
              >
                {scanning ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Scanning your inbox…
                  </>
                ) : 'Scan emails'}
              </button>
              {emailCount !== null && !scanning && (
                <p className="text-xs text-fg-subtle mt-3">{emailCount} emails analysed</p>
              )}
            </div>
          )}

          {/* Results */}
          {items.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">
                    {pending > 0 ? `${pending} subscription${pending !== 1 ? 's' : ''} detected` : 'All done!'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    From {emailCount} emails · {confirmed} confirmed
                  </p>
                </div>
                <button
                  onClick={handleScan}
                  disabled={scanning}
                  className="text-sm text-indigo-600 font-medium hover:text-indigo-700 disabled:opacity-50"
                >
                  Scan again
                </button>
              </div>

              <div className="space-y-3">
                {items.map(({ sub, status, loading }) => (
                  <div
                    key={sub.id}
                    className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                      status === 'confirmed' ? 'border-green-200 bg-green-50/40 opacity-75'
                      : status === 'dismissed' ? 'border-gray-200 opacity-40'
                      : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 truncate">{sub.name}</h3>
                          <ConfidenceBadge score={sub.confidence} />
                          {sub.category && (
                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                              {sub.category}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                          <span className="capitalize">{sub.billingCycle}</span>
                          <span>·</span>
                          <span>{sub.occurrences} occurrence{sub.occurrences !== 1 ? 's' : ''}</span>
                          {sub.nextBillingDate && (
                            <>
                              <span>·</span>
                              <span>Next: {new Date(sub.nextBillingDate).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric'
                              })}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-gray-900">{formatCurrency(sub.amount, sub.currency)}</p>
                        <p className="text-xs text-fg-subtle">{CYCLE_LABEL[sub.billingCycle] ?? '/mo'}</p>
                      </div>
                    </div>

                    {status === 'pending' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleConfirm(sub.id)}
                          disabled={loading}
                          className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                          {loading ? '…' : '✓ Add to tracker'}
                        </button>
                        <button
                          onClick={() => handleDismiss(sub.id)}
                          disabled={loading}
                          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                    {status === 'confirmed' && (
                      <p className="mt-3 text-xs text-green-600 font-medium">✓ Added to your subscriptions</p>
                    )}
                    {status === 'dismissed' && (
                      <p className="mt-3 text-xs text-fg-subtle">Dismissed</p>
                    )}
                  </div>
                ))}
              </div>

              {confirmed > 0 && pending === 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center">
                  <p className="font-semibold text-indigo-800 mb-1">
                    {confirmed} subscription{confirmed !== 1 ? 's' : ''} added!
                  </p>
                  <p className="text-sm text-indigo-600 mb-4">Your dashboard has been updated.</p>
                  <Link
                    to="/"
                    className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors inline-block"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
