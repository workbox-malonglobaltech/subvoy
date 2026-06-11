import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './ui/Button';

/** Settings → Change/Set Password. Self-contained: owns its state + Supabase logic. */
export function ChangePasswordSection() {
  const { user } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwShow, setPwShow] = useState(false);
  // Whether this account has an email/password login (vs Google-only) — from Supabase identities.
  const [hasEmailLogin, setHasEmailLogin] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const providers = (data.user?.identities ?? []).map(i => i.provider);
      setHasEmailLogin(providers.length === 0 || providers.includes('email'));
    }).catch(() => { /* keep default */ });
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSaving(true);
    try {
      if (hasEmailLogin && user?.email) {
        const { error: vErr } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
        if (vErr) throw new Error('Current password is incorrect');
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      toast.success(hasEmailLogin ? 'Password changed successfully' : 'Password set — you can now sign in with email too');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setPwSaving(false);
    }
  }

  return (
    <section className="bg-surface rounded-2xl border border-line p-6 shadow-card" aria-labelledby="password-heading">
      <h2 id="password-heading" className="text-sm font-semibold text-fg-muted uppercase tracking-wide mb-4">
        {hasEmailLogin ? 'Change Password' : 'Set a Password'}
      </h2>
      <form onSubmit={handleChangePassword} className="space-y-4">
        {!hasEmailLogin && (
          <p className="text-sm text-fg-muted">
            Your account uses Google sign-in. Set a password to also log in with your email.
          </p>
        )}
        {hasEmailLogin && (
          <div>
            <label htmlFor="current-password" className="block text-sm font-medium text-fg mb-1">Current password</label>
            <input
              id="current-password"
              type={pwShow ? 'text' : 'password'}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-line-strong px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-fg mb-1">New password</label>
          <div className="relative">
            <input
              id="new-password"
              type={pwShow ? 'text' : 'password'}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={10}
              className="w-full rounded-lg border border-line-strong px-3 py-2 pr-16 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button type="button" onClick={() => setPwShow(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-fg-subtle hover:text-fg">
              {pwShow ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-fg-subtle mt-1">Min 10 chars, one uppercase letter and one number</p>
        </div>
        {pwError && (
          <p className="text-sm text-error-700 bg-error-50 border border-error-600/20 rounded-lg px-3 py-2" role="alert">
            {pwError}
          </p>
        )}
        <Button type="submit" loading={pwSaving} disabled={(hasEmailLogin && !currentPassword) || !newPassword}>
          {pwSaving ? 'Saving…' : hasEmailLogin ? 'Change password' : 'Set password'}
        </Button>
      </form>
    </section>
  );
}
