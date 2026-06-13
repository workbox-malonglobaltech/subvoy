import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export interface Locale {
  country: string | null;
  /** The user's local display currency (USD for the US / unknown). */
  currency: string;
  /** Currencies to offer/display — [local, USD], or [USD] for the US. */
  currencies: string[];
}

/**
 * The signed-in user's locale (country + display currencies). Drives the
 * "local + USD, US = USD only" rule for inputs and display. Null until loaded.
 */
export function useLocale(): Locale | null {
  const { user } = useAuth();
  const [locale, setLocale] = useState<Locale | null>(null);

  useEffect(() => {
    if (!user) { setLocale(null); return; }
    api.get<Locale>('/auth/locale').then(setLocale).catch(() => setLocale(null));
  }, [user]);

  return locale;
}
