/**
 * Currency formatting utilities for Subvoy.
 *
 * All amounts are stored in their native currency (USD, NGN, etc.).
 * These helpers format them for display and compute NGN equivalents
 * using live FX rates from the backend.
 */

import type { FxRates, SupportedCurrency } from '../../../src/shared/types';

export const SUPPORTED_CURRENCIES: { value: SupportedCurrency; label: string; symbol: string }[] = [
  { value: 'USD', label: 'USD — US Dollar',        symbol: '$'  },
  { value: 'NGN', label: 'NGN — Nigerian Naira',   symbol: '₦'  },
  { value: 'GBP', label: 'GBP — British Pound',    symbol: '£'  },
  { value: 'EUR', label: 'EUR — Euro',              symbol: '€'  },
  { value: 'CAD', label: 'CAD — Canadian Dollar',  symbol: 'CA$'},
];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', NGN: '₦', GBP: '£', EUR: '€', CAD: 'CA$',
};

/**
 * Formats an amount in its native currency.
 * e.g. formatNative(15.99, 'USD') → '$15.99'
 *      formatNative(29000, 'NGN') → '₦29,000'
 */
export function formatNative(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] ?? currency + ' ';
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: currency === 'NGN' ? 0 : 2,
    maximumFractionDigits: currency === 'NGN' ? 0 : 2,
  }).format(amount);
  return `${sym}${formatted}`;
}

/**
 * Converts an amount from one currency to another using FX rates.
 * All rates are USD-based (USD_NGN, USD_GBP, etc.).
 * Returns null if the required rate is unavailable.
 */
export function convertAmount(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fxRates: FxRates
): number | null {
  const { rates } = fxRates;
  if (fromCurrency === toCurrency) return amount;

  let amountInUsd: number;
  if (fromCurrency === 'USD') {
    amountInUsd = amount;
  } else {
    const rate = rates[`USD_${fromCurrency}`];
    if (!rate) return null;
    amountInUsd = amount / rate;
  }

  if (toCurrency === 'USD') return amountInUsd;
  const rate = rates[`USD_${toCurrency}`];
  if (!rate) return null;
  return amountInUsd * rate;
}

/**
 * Returns the primary display string for a subscription amount.
 * If the currency is already NGN, just shows the naira amount.
 * Otherwise shows native + NGN equivalent below.
 *
 * Returns: { primary: '$15.99', secondary: '≈ ₦25,624' | null }
 */
export function formatSubscriptionAmount(
  amount: number,
  currency: string,
  fxRates: FxRates | null
): { primary: string; secondary: string | null } {
  const primary = formatNative(amount, currency);

  // Already NGN — no secondary needed
  if (currency === 'NGN') return { primary, secondary: null };

  // No rates yet — show primary only
  if (!fxRates) return { primary, secondary: null };

  const naira = convertAmount(amount, currency, 'NGN', fxRates);
  if (naira === null) return { primary, secondary: null };

  return {
    primary,
    secondary: `≈ ${formatNative(naira, 'NGN')}`,
  };
}

/**
 * Converts any amount to its NGN monthly equivalent for summary totals.
 * Handles billing cycle normalisation (yearly → ÷12, weekly → ×52÷12).
 * Returns 0 if conversion is unavailable (missing rate).
 */
export function toMonthlyNgn(
  amount: number,
  currency: string,
  billingCycle: string,
  fxRates: FxRates | null
): number {
  // Normalize to monthly
  let monthly: number;
  if (billingCycle === 'yearly') monthly = amount / 12;
  else if (billingCycle === 'weekly') monthly = (amount * 52) / 12;
  else monthly = amount;

  if (currency === 'NGN') return monthly;
  if (!fxRates) return 0;

  return convertAmount(monthly, currency, 'NGN', fxRates) ?? 0;
}
