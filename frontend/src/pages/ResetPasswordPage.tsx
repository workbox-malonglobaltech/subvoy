import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Reset failed');
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-sm text-red-600 mb-4">Invalid or missing reset link.</p>
          <Link to="/forgot-password" className="text-indigo-600 text-sm font-medium hover:text-indigo-800">
            Request a new one →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">Subvoy</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Password updated!</h2>
              <p className="text-sm text-gray-500">
                Redirecting you to sign in…
              </p>
              <Link to="/login" className="inline-block text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                Sign in now →
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Set a new password</h2>
              <p className="text-sm text-gray-500 mb-6">
                Min 10 characters, one uppercase letter, one number.
              </p>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="rp-password" className="block text-sm font-medium text-gray-700 mb-1">
                    New password
                  </label>
                  <input
                    id="rp-password"
                    type="password"
                    required
                    autoFocus
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="rp-confirm" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm new password
                  </label>
                  <input
                    id="rp-confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••••"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
