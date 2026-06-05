/**
 * FX Rate Service
 *
 * Fetches daily exchange rates from Frankfurter (https://frankfurter.dev) —
 * a free, open-source API that sources data from the European Central Bank
 * and other interbank feeds, including NGN.
 *
 * Rates are upserted into the fx_rates table so the rest of the app always
 * reads from the DB (fast, offline-resilient) rather than hitting the API
 * on every request.
 *
 * Supported pairs (all expressed relative to USD):
 *   USD → NGN, USD → GBP, USD → EUR, USD → CAD
 */

import { pool } from '../db';
import type { FxRates } from '../../../src/shared/types';

// Re-export for convenience
export type { FxRates };

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest';

/** Currencies we track (all converted from USD base) */
const TARGET_CURRENCIES = ['NGN', 'GBP', 'EUR', 'CAD'];

export interface FxRateRow {
  base_currency: string;
  target_currency: string;
  rate: number;
  fetched_at: Date;
}

/**
 * Fetches latest rates from Frankfurter and upserts them into the DB.
 * Called once daily by the FX cron job.
 */
export async function fetchAndStoreRates(): Promise<void> {
  console.log('[FX] Fetching latest rates from Frankfurter...');

  const url = `${FRANKFURTER_URL}?base=USD&symbols=${TARGET_CURRENCIES.join(',')}`;

  let data: { rates: Record<string, number> };
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Frankfurter responded with ${res.status}: ${res.statusText}`);
    }
    data = await res.json() as { rates: Record<string, number> };
  } catch (err) {
    console.error('[FX] Failed to fetch rates:', err);
    throw err;
  }

  const now = new Date();

  for (const [target, rate] of Object.entries(data.rates)) {
    await pool.query(
      `INSERT INTO fx_rates (base_currency, target_currency, rate, fetched_at, updated_at)
       VALUES ($1, $2, $3, $4, $4)
       ON CONFLICT (base_currency, target_currency)
       DO UPDATE SET rate = EXCLUDED.rate,
                     fetched_at = EXCLUDED.fetched_at,
                     updated_at = EXCLUDED.updated_at`,
      ['USD', target, rate, now]
    );
    console.log(`[FX] USD → ${target}: ${rate}`);
  }

  // Also store the identity rate USD → USD = 1 for completeness
  await pool.query(
    `INSERT INTO fx_rates (base_currency, target_currency, rate, fetched_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (base_currency, target_currency)
     DO UPDATE SET rate = EXCLUDED.rate,
                   fetched_at = EXCLUDED.fetched_at,
                   updated_at = EXCLUDED.updated_at`,
    ['USD', 'USD', 1, now]
  );

  console.log(`[FX] Rates stored successfully at ${now.toISOString()}`);
}

/**
 * Returns all cached FX rates from the DB.
 * Falls back gracefully — if no rates exist yet, returns empty rates.
 */
export async function getCachedRates(): Promise<FxRates> {
  const { rows } = await pool.query<FxRateRow>(
    `SELECT base_currency, target_currency, rate, fetched_at
     FROM fx_rates
     ORDER BY base_currency, target_currency`
  );

  if (rows.length === 0) {
    return { fetchedAt: new Date(0).toISOString(), rates: {} };
  }

  const rateMap: Record<string, number> = {};
  for (const row of rows) {
    rateMap[`${row.base_currency}_${row.target_currency}`] = Number(row.rate);
  }

  return {
    fetchedAt: rows[0].fetched_at.toISOString(),
    rates: rateMap,
  };
}

/**
 * Converts an amount in fromCurrency to toCurrency using cached rates.
 * All conversions go through USD as the base.
 * Returns null if the rate is unavailable.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: FxRates
): number | null {
  const { rates } = fxRates;
  if (fromCurrency === toCurrency) return amount;

  // Convert fromCurrency → USD first
  let amountInUsd: number;
  if (fromCurrency === 'USD') {
    amountInUsd = amount;
  } else {
    const toUsdRate = rates[`USD_${fromCurrency}`];
    if (!toUsdRate) return null;
    amountInUsd = amount / toUsdRate;
  }

  // Convert USD → toCurrency
  if (toCurrency === 'USD') return amountInUsd;
  const fromUsdRate = rates[`USD_${toCurrency}`];
  if (!fromUsdRate) return null;

  return amountInUsd * fromUsdRate;
}
