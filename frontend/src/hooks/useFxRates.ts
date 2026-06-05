import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import type { FxRates } from '../../../src/shared/types';

interface FxRatesState {
  rates: FxRates | null;
  loading: boolean;
  stale: boolean;
  /** % change in USD→NGN since the previous cached fetch. null if no prior data. */
  ngnRateChangePct: number | null;
}

const CACHE_KEY      = 'subvoy_fx_rates';
const PREV_RATE_KEY  = 'subvoy_fx_prev_ngn';
const CACHE_TTL_MS   = 60 * 60 * 1000; // 1 hour

interface CachedEntry extends FxRates {
  stale: boolean;
  cachedAt: number;
}

function loadFromLocalStorage(): CachedEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function loadPrevNgnRate(): number | null {
  try {
    const raw = localStorage.getItem(PREV_RATE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function computeChangePct(prev: number | null, current: number | null): number | null {
  if (prev === null || current === null || prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

export function useFxRates(): FxRatesState {
  const cached = loadFromLocalStorage();

  const [state, setState] = useState<FxRatesState>(() => {
    if (cached) {
      const prevRate = loadPrevNgnRate();
      const currentNgn = cached.rates['USD_NGN'] ?? null;
      return {
        rates: cached,
        loading: false,
        stale: cached.stale,
        ngnRateChangePct: computeChangePct(prevRate, currentNgn),
      };
    }
    return { rates: null, loading: true, stale: false, ngnRateChangePct: null };
  });

  useEffect(() => {
    if (state.rates && !state.loading) return; // served from cache

    api.get<FxRates & { stale: boolean }>('/fx/rates')
      .then(data => {
        const currentNgn = data.rates['USD_NGN'] ?? null;
        const prevRate   = loadPrevNgnRate();
        const changePct  = computeChangePct(prevRate, currentNgn);

        // Store previous rate before overwriting
        if (currentNgn !== null) {
          try { localStorage.setItem(PREV_RATE_KEY, String(currentNgn)); } catch { /* ignore */ }
        }

        const entry: CachedEntry = { ...data, cachedAt: Date.now() };
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* ignore */ }

        setState({ rates: data, loading: false, stale: data.stale, ngnRateChangePct: changePct });
      })
      .catch(() => {
        setState(prev => ({ ...prev, loading: false }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
