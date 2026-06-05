import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Wallet, WalletTransaction, WalletSettings, WalletTopUpInput } from '../../../src/shared/types';

interface WalletState {
  wallet: Wallet | null;
  transactions: WalletTransaction[];
  settings: WalletSettings | null;
  loading: boolean;
  error: string | null;
}

interface UseWalletReturn extends WalletState {
  topUp: (input: WalletTopUpInput) => Promise<void>;
  updateSettings: (data: Partial<WalletSettings>) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState<WalletState>({
    wallet: null,
    transactions: [],
    settings: null,
    loading: true,
    error: null,
  });

  const fetchAll = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const [wallet, transactions, settings] = await Promise.all([
        api.get<Wallet>('/wallet'),
        api.get<WalletTransaction[]>('/wallet/transactions'),
        api.get<WalletSettings>('/wallet/settings'),
      ]);
      setState({ wallet, transactions, settings, loading: false, error: null });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load wallet',
      }));
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const topUp = useCallback(async (input: WalletTopUpInput) => {
    const updatedWallet = await api.post<Wallet>('/wallet/topup', input);
    // Re-fetch transactions so the new entry appears
    const transactions = await api.get<WalletTransaction[]>('/wallet/transactions');
    setState(prev => ({ ...prev, wallet: updatedWallet, transactions }));
  }, []);

  const updateSettings = useCallback(async (data: Partial<WalletSettings>) => {
    const settings = await api.put<WalletSettings>('/wallet/settings', data);
    setState(prev => ({ ...prev, settings }));
  }, []);

  return { ...state, topUp, updateSettings, refresh: fetchAll };
}
