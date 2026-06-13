import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface CountrySetting {
  country: string;
  enabled: boolean;
  currency: string;
  paymentProvider: 'stripe' | 'paystack';
}

export function useAdminCountrySettings() {
  const [countries, setCountries] = useState<CountrySetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setCountries(await api.get<CountrySetting[]>('/admin/country-settings'));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load country settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const save = async (c: CountrySetting) => {
    await api.put('/admin/country-settings', c);
    await fetchAll();
  };

  return { countries, loading, error, save, refetch: fetchAll };
}
