import { useState, useEffect, FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LogoMark } from '../components/LogoMark';
import { api } from '../lib/api';
import { COUNTRIES } from '../utils/countries';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState<'personal' | 'business'>('personal');
  const [businessName, setBusinessName] = useState('');
  const [country, setCountry] = useState('');

  // Pre-fill country from the visitor's IP (best-effort; fully editable).
  useEffect(() => {
    api.get<{ country: string | null }>('/geo/country')
      .then(d => { if (d.country) setCountry(d.country); })
      .catch(() => { /* leave blank — user picks */ });
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(email, password, name || undefined, {
        country: country || undefined,
        accountType,
        businessName: accountType === 'business' ? businessName : undefined,
      });
      // Flag this as a fresh registration so the onboarding modal shows
      localStorage.setItem('subvoy_new_user', '1');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8 gap-3">
          <LogoMark size="lg" linked={false} />
          <p className="text-gray-500">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <GoogleSignInButton label="Sign up with Google" />

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs text-fg-subtle">
              <span className="bg-white px-2">or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1.5">Account type</span>
              <div className="grid grid-cols-2 gap-2">
                {(['personal', 'business'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAccountType(t)}
                    aria-pressed={accountType === t}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      accountType === t ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-fg-subtle">
                {accountType === 'business'
                  ? 'A business workspace (subscriptions + compliance + team) — plus your personal space.'
                  : 'Track your personal subscriptions and bills.'}
              </p>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-fg-subtle font-normal">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Jane Smith"
              />
            </div>

            {accountType === 'business' && (
              <div>
                <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-1">Business name</label>
                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Acme Ltd"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Min. 10 characters"
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 hover:text-gray-700">
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                id="country"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
              >
                <option value="">Select your country…</option>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-fg-subtle">Sets your local currency — auto-detected, change if needed.</p>
            </div>

            <Button type="submit" loading={loading} size="lg" className="w-full">
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
