import { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { NavBar } from '../components/NavBar';

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

export function ImportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [txCount, setTxCount] = useState<number | null>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const [allDone, setAllDone] = useState(false);

  async function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setUploadError('Please upload a CSV file.');
      return;
    }
    setUploading(true);
    setUploadError('');
    setItems([]);
    setAllDone(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Use VITE_API_URL so this works in non-proxy deployments too
      const BASE_URL = import.meta.env.VITE_API_URL ?? '';
      const res = await fetch(`${BASE_URL}/imports/csv`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Upload failed');

      setTxCount(json.data.transactionCount);
      if (json.data.detected.length === 0) {
        setUploadError('No recurring patterns detected. Try a statement with at least 2 months of history.');
        return;
      }
      setItems(json.data.detected.map((sub: DetectedSub) => ({ sub, status: 'pending' as ItemStatus, loading: false })));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

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
    checkAllDone();
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
    checkAllDone();
  }

  function checkAllDone() {
    setTimeout(() => {
      setItems(prev => {
        const done = prev.every(i => i.status !== 'pending');
        if (done && prev.length > 0) setAllDone(true);
        return prev;
      });
    }, 100);
  }

  const confirmed = items.filter(i => i.status === 'confirmed').length;
  const pending   = items.filter(i => i.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar actions={
        <Link
          to="/email-import"
          className="text-sm text-indigo-600 font-medium hover:text-indigo-800 transition-colors"
        >
          Connect Email →
        </Link>
      } />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-page-enter">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Import from Bank Statement</h1>
          <p className="mt-1 text-gray-500 text-sm">Upload a CSV export from your bank. We'll detect recurring payments automatically.</p>
        </div>

        {/* Upload zone */}
        {items.length === 0 && (
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-300 hover:bg-gray-50'
            }`}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Analysing transactions…</p>
              </div>
            ) : (
              <>
                <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-700">Drop your CSV here or <span className="text-indigo-600">browse</span></p>
                <p className="text-xs text-gray-400 mt-1">Supports exports from most banks · Max 5 MB</p>
              </>
            )}
          </div>
        )}

        {uploadError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{uploadError}</div>
        )}

        {/* How it works */}
        {items.length === 0 && !uploading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">How it works</h2>
            <div className="space-y-3">
              {[
                ['1', 'Export CSV from your bank', 'Go to your bank\'s transactions page and export as CSV.'],
                ['2', 'Upload here', 'We analyse your transactions locally — no data is shared externally.'],
                ['3', 'Review & confirm', 'We detect recurring payments. You confirm which ones to track.'],
              ].map(([num, title, desc]) => (
                <div key={num} className="flex gap-4">
                  <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{num}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{title}</p>
                    <p className="text-xs text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
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
                  From {txCount} transactions · {confirmed} confirmed
                </p>
              </div>
              <button onClick={() => { setItems([]); setTxCount(null); setAllDone(false); }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Upload another
              </button>
            </div>

            <div className="space-y-3">
              {items.map(({ sub, status, loading }) => (
                <div key={sub.id}
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                    status === 'confirmed' ? 'border-green-200 bg-green-50/40 opacity-75'
                    : status === 'dismissed' ? 'border-gray-200 opacity-40'
                    : 'border-gray-200'
                  }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 truncate">{sub.name}</h3>
                        <ConfidenceBadge score={sub.confidence} />
                        {sub.category && (
                          <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{sub.category}</span>
                        )}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        <span className="capitalize">{sub.billingCycle}</span>
                        <span>·</span>
                        <span>{sub.occurrences} occurrence{sub.occurrences !== 1 ? 's' : ''}</span>
                        {sub.nextBillingDate && (
                          <>
                            <span>·</span>
                            <span>Next: {new Date(sub.nextBillingDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">{formatCurrency(sub.amount, sub.currency)}</p>
                      <p className="text-xs text-gray-400">{CYCLE_LABEL[sub.billingCycle] ?? '/mo'}</p>
                    </div>
                  </div>

                  {status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => handleConfirm(sub.id)} disabled={loading}
                        className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                        {loading ? '…' : '✓ Add to tracker'}
                      </button>
                      <button onClick={() => handleDismiss(sub.id)} disabled={loading}
                        className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        Dismiss
                      </button>
                    </div>
                  )}

                  {status === 'confirmed' && (
                    <p className="mt-3 text-xs text-green-600 font-medium">✓ Added to your subscriptions</p>
                  )}
                  {status === 'dismissed' && (
                    <p className="mt-3 text-xs text-gray-400">Dismissed</p>
                  )}
                </div>
              ))}
            </div>

            {allDone && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 text-center">
                <p className="font-semibold text-indigo-800 mb-1">
                  {confirmed > 0 ? `${confirmed} subscription${confirmed !== 1 ? 's' : ''} added!` : 'All dismissed'}
                </p>
                <p className="text-sm text-indigo-600 mb-4">Your dashboard has been updated.</p>
                <button onClick={() => navigate('/')}
                  className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors">
                  Go to Dashboard
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
