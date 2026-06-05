import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Request failed');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">Subvoy</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                If <strong>{email}</strong> is registered, we've sent a password reset link.
                It expires in 1 hour.
              </p>
              <Link to="/login" className="inline-block mt-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                ← Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Forgot your password?</h2>
              <p className="text-sm text-gray-500 mb-6">
                Enter your email and we'll send you a reset link.
              </p>

              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="fp-email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email address
                  </label>
                  <input
                    id="fp-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-500">
                Remember your password?{' '}
                <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-800">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
