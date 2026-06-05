import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export interface PaymentRecord {
  id: string;
  /** e.g. "Paid: Netflix" */
  description: string;
  currency: string;
  /** Whole units (dollars or naira) */
  amount: number;
  /** Wallet balance after this payment */
  balanceAfter: number;
  paidAt: string;
}

export function usePaymentHistory(from?: string, to?: string) {
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '500' });
      if (from) params.set('from', from);
      if (to)   params.set('to',   to);
      const data = await api.get<PaymentRecord[]>(`/reports/payments?${params}`);
      setPayments(data);
    } catch (e) {
      setError('Failed to load payment history');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return { payments, loading, error, refetch: load };
}
