import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { User } from '../../../src/shared/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (name: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Fetches our domain user (auto-provisioned server-side from the Supabase identity). */
async function fetchDomainUser(): Promise<User | null> {
  try {
    return await api.get<User>('/auth/me');
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChange fires immediately with the initial session, and again on
    // sign-in / sign-out / token refresh. Defer the API call out of the callback
    // (supabase-js can deadlock if you call its methods synchronously inside it).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setTimeout(() => {
          fetchDomainUser().then(setUser).finally(() => setLoading(false));
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Capture the browser timezone once per session so reminders fire in local time.
  useEffect(() => {
    if (!user || sessionStorage.getItem('subvoy_tz_synced') === '1') return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    api.put('/auth/timezone', { timezone: tz })
      .then(() => sessionStorage.setItem('subvoy_tz_synced', '1'))
      .catch(() => { /* non-critical */ });
  }, [user]);

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    setUser(await fetchDomainUser());
  }

  async function register(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: name ? { name } : undefined },
    });
    if (error) throw new Error(error.message);
    // If email confirmation is enabled, no session is returned until they confirm.
    if (!data.session) {
      throw new Error('Check your email to confirm your account, then log in.');
    }
    setUser(await fetchDomainUser());
  }

  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw new Error(error.message);
    // Redirects to Google; the session is picked up on return via detectSessionInUrl.
  }

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function updateProfile(name: string | null) {
    setUser(await api.put<User>('/auth/profile', { name }));
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
