import { pool } from '../db';

export interface CountrySetting {
  country: string;
  enabled: boolean;
  currency: string;
  paymentProvider: 'stripe' | 'paystack';
}

/** Code fallback when a country has no row — keeps the app working pre-config. */
const FALLBACK: Omit<CountrySetting, 'country'> = { enabled: true, currency: 'USD', paymentProvider: 'stripe' };

let cache: Map<string, CountrySetting> | null = null;

async function load(): Promise<Map<string, CountrySetting>> {
  if (cache) return cache;
  const { rows } = await pool.query<{ country: string; enabled: boolean; currency: string; payment_provider: 'stripe' | 'paystack' }>(
    'SELECT country, enabled, currency, payment_provider FROM country_settings'
  );
  cache = new Map(rows.map(r => [r.country, {
    country: r.country, enabled: r.enabled, currency: r.currency, paymentProvider: r.payment_provider,
  }]));
  return cache;
}

export function invalidateCountryCache(): void { cache = null; }

/** Effective settings for a country (row → code fallback). `null`/'' → fallback. */
export async function getCountrySetting(country: string | null | undefined): Promise<CountrySetting> {
  const code = (country ?? '').toUpperCase();
  if (!code) return { country: '', ...FALLBACK };
  const map = await load();
  return map.get(code) ?? { country: code, ...FALLBACK };
}

/** The local display currency for a country (e.g. NG → NGN, US → USD). */
export async function getCountryCurrency(country: string | null | undefined): Promise<string> {
  return (await getCountrySetting(country)).currency;
}

export async function listCountrySettings(): Promise<CountrySetting[]> {
  const map = await load();
  return Array.from(map.values()).sort((a, b) => a.country.localeCompare(b.country));
}

export async function setCountrySetting(
  country: string,
  data: { enabled: boolean; currency: string; paymentProvider: 'stripe' | 'paystack' }
): Promise<void> {
  await pool.query(
    `INSERT INTO country_settings (country, enabled, currency, payment_provider) VALUES ($1, $2, $3, $4)
     ON CONFLICT (country) DO UPDATE SET
       enabled = EXCLUDED.enabled, currency = EXCLUDED.currency,
       payment_provider = EXCLUDED.payment_provider, updated_at = NOW()`,
    [country.toUpperCase(), data.enabled, data.currency.toUpperCase(), data.paymentProvider]
  );
  invalidateCountryCache();
}
