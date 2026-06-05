/**
 * Unit tests for fx.service.ts
 *
 * fetchAndStoreRates and getCachedRates are integration-level (need DB + HTTP),
 * so we test them via mocked pool and fetch.
 * convertAmount is pure logic — no mocks needed.
 */

import { convertAmount } from '../../services/fx.service';
import type { FxRates } from '../../../../src/shared/types';

// ---- convertAmount (pure function) ------------------------------------------

const sampleRates: FxRates = {
  fetchedAt: '2026-04-16T00:00:00.000Z',
  rates: {
    USD_NGN: 1601.5,
    USD_GBP: 0.792,
    USD_EUR: 0.924,
    USD_CAD: 1.382,
    USD_USD: 1,
  },
};

describe('convertAmount', () => {
  it('returns the same amount when currencies match', () => {
    expect(convertAmount(100, 'USD', 'USD', sampleRates)).toBe(100);
    expect(convertAmount(5000, 'NGN', 'NGN', sampleRates)).toBe(5000);
  });

  it('converts USD to NGN correctly', () => {
    const result = convertAmount(15.99, 'USD', 'NGN', sampleRates);
    expect(result).toBeCloseTo(15.99 * 1601.5, 1);
  });

  it('converts USD to GBP correctly', () => {
    const result = convertAmount(100, 'USD', 'GBP', sampleRates);
    expect(result).toBeCloseTo(79.2, 1);
  });

  it('converts NGN to USD correctly (reverse via base)', () => {
    const result = convertAmount(1601.5, 'NGN', 'USD', sampleRates);
    expect(result).toBeCloseTo(1, 4);
  });

  it('converts NGN to GBP correctly (cross-rate via USD)', () => {
    // 1601.5 NGN → 1 USD → 0.792 GBP
    const result = convertAmount(1601.5, 'NGN', 'GBP', sampleRates);
    expect(result).toBeCloseTo(0.792, 2);
  });

  it('converts EUR to NGN correctly (cross-rate via USD)', () => {
    // 1 EUR → (1 / 0.924) USD → * 1601.5 NGN
    const result = convertAmount(1, 'EUR', 'NGN', sampleRates);
    expect(result).toBeCloseTo(1601.5 / 0.924, 0);
  });

  it('returns null when source rate is missing', () => {
    const rates: FxRates = { fetchedAt: '2026-04-16T00:00:00.000Z', rates: { USD_NGN: 1601.5 } };
    expect(convertAmount(100, 'GBP', 'NGN', rates)).toBeNull();
  });

  it('returns null when target rate is missing', () => {
    const rates: FxRates = { fetchedAt: '2026-04-16T00:00:00.000Z', rates: { USD_GBP: 0.792 } };
    expect(convertAmount(100, 'USD', 'NGN', rates)).toBeNull();
  });

  it('handles zero amount', () => {
    expect(convertAmount(0, 'USD', 'NGN', sampleRates)).toBe(0);
  });

  it('handles large NGN amounts without precision loss', () => {
    // ₦1,000,000 → USD
    const result = convertAmount(1_000_000, 'NGN', 'USD', sampleRates);
    expect(result).toBeCloseTo(1_000_000 / 1601.5, 2);
  });
});

// ---- fetchAndStoreRates (mocked DB + fetch) ----------------------------------

const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

// Must import AFTER the mock
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { fetchAndStoreRates, getCachedRates } = require('../../services/fx.service');

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockQuery.mockReset();
  mockFetch.mockReset();
});

describe('fetchAndStoreRates', () => {
  it('fetches rates and upserts all target currencies + USD identity', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rates: { NGN: 1601.5, GBP: 0.792, EUR: 0.924, CAD: 1.382 },
      }),
    });
    mockQuery.mockResolvedValue({ rows: [] }); // upserts always succeed

    await fetchAndStoreRates();

    // 4 target currencies + 1 USD identity = 5 upserts
    expect(mockQuery).toHaveBeenCalledTimes(5);

    const calls = mockQuery.mock.calls.map((c: unknown[][]) => c[1]);
    const targets = calls.map((params: unknown[]) => params[1]);
    expect(targets).toEqual(expect.arrayContaining(['NGN', 'GBP', 'EUR', 'CAD', 'USD']));
  });

  it('throws if Frankfurter returns a non-OK status', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Service Unavailable' });
    await expect(fetchAndStoreRates()).rejects.toThrow('503');
  });

  it('throws if fetch itself fails (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    await expect(fetchAndStoreRates()).rejects.toThrow('network error');
  });
});

describe('getCachedRates', () => {
  it('returns rates keyed as USD_XXX from DB rows', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { base_currency: 'USD', target_currency: 'NGN', rate: '1601.5', fetched_at: new Date('2026-04-16') },
        { base_currency: 'USD', target_currency: 'GBP', rate: '0.792',  fetched_at: new Date('2026-04-16') },
      ],
    });

    const result = await getCachedRates();
    expect(result.rates.USD_NGN).toBe(1601.5);
    expect(result.rates.USD_GBP).toBe(0.792);
    expect(result.fetchedAt).toBe(new Date('2026-04-16').toISOString());
  });

  it('returns empty rates with epoch fetchedAt when no rates in DB', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const result = await getCachedRates();
    expect(result.fetchedAt).toBe(new Date(0).toISOString());
    expect(result.rates).toEqual({});
  });
});
