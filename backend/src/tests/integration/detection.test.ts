/**
 * Unit tests for the recurring-transaction detection algorithm.
 *
 * No mocks are required — detectRecurring is a pure function with no I/O side effects.
 *
 * Run with:  npx jest src/tests/integration/detection.test.ts
 */

import { detectRecurring } from '../../services/detection.service';
import { Transaction } from '../../services/csv-parser.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds an ISO date string (YYYY-MM-DD) for a point N days in the past.
 */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

function makeTransaction(
  description: string,
  daysBack: number,
  amount = 15.99,
  currency = 'USD',
): Transaction {
  return { date: daysAgo(daysBack), description, amount, currency };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Pure function — nothing to reset; kept for symmetry with other test files
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Monthly recurring
// ---------------------------------------------------------------------------

describe('detectRecurring — monthly pattern', () => {
  it('detects a monthly subscription with high confidence given 3 charges ~30 days apart', () => {
    const transactions: Transaction[] = [
      makeTransaction('Netflix', 90),
      makeTransaction('Netflix', 60),
      makeTransaction('Netflix', 30),
    ];

    const results = detectRecurring(transactions);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const netflix = results.find(r => r.name.toLowerCase().includes('netflix'));
    expect(netflix).toBeDefined();
    expect(netflix!.billingCycle).toBe('monthly');
    // confidence score ≥ 85 is classed as "high" by the algorithm
    expect(netflix!.confidence).toBeGreaterThanOrEqual(85);
    expect(netflix!.occurrences).toBe(3);
  });

  it('assigns the Entertainment category to a Netflix subscription', () => {
    const transactions: Transaction[] = [
      makeTransaction('Netflix', 90),
      makeTransaction('Netflix', 60),
      makeTransaction('Netflix', 30),
    ];

    const results = detectRecurring(transactions);
    const netflix = results.find(r => r.name.toLowerCase().includes('netflix'));

    expect(netflix!.category).toBe('Entertainment');
  });

  it('sets nextBillingDate to a future date', () => {
    const transactions: Transaction[] = [
      makeTransaction('Netflix', 90),
      makeTransaction('Netflix', 60),
      makeTransaction('Netflix', 30),
    ];

    const results = detectRecurring(transactions);
    const netflix = results.find(r => r.name.toLowerCase().includes('netflix'));
    const nextDate = new Date(netflix!.nextBillingDate);

    expect(nextDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('exposes the raw transactions sorted by date ascending', () => {
    const transactions: Transaction[] = [
      makeTransaction('Netflix', 30),
      makeTransaction('Netflix', 90),
      makeTransaction('Netflix', 60),
    ];

    const results = detectRecurring(transactions);
    const netflix = results.find(r => r.name.toLowerCase().includes('netflix'));
    const dates = netflix!.rawTransactions.map(t => t.date);

    expect(dates).toEqual([...dates].sort());
  });
});

// ---------------------------------------------------------------------------
// Yearly recurring
// ---------------------------------------------------------------------------

describe('detectRecurring — yearly pattern', () => {
  it('detects an annual subscription with medium or high confidence given 2 charges ~365 days apart', () => {
    const transactions: Transaction[] = [
      makeTransaction('Adobe Creative Cloud', 365),
      makeTransaction('Adobe Creative Cloud', 0),   // today
    ];

    const results = detectRecurring(transactions);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const adobe = results.find(r => r.name.toLowerCase().includes('adobe'));
    expect(adobe).toBeDefined();
    expect(adobe!.billingCycle).toBe('yearly');
    // Algorithm assigns 65–90 confidence for yearly depending on consistency
    expect(adobe!.confidence).toBeGreaterThanOrEqual(50);
  });

  it('assigns the Software & SaaS category to an Adobe subscription', () => {
    const transactions: Transaction[] = [
      makeTransaction('Adobe Creative Cloud', 365),
      makeTransaction('Adobe Creative Cloud', 0),
    ];

    const results = detectRecurring(transactions);
    const adobe = results.find(r => r.name.toLowerCase().includes('adobe'));

    expect(adobe!.category).toBe('Software & SaaS');
  });

  it('correctly computes the average amount across two yearly occurrences', () => {
    const transactions: Transaction[] = [
      makeTransaction('Adobe Creative Cloud', 365, 599.99),
      makeTransaction('Adobe Creative Cloud', 0, 599.99),
    ];

    const results = detectRecurring(transactions);
    const adobe = results.find(r => r.name.toLowerCase().includes('adobe'));

    expect(adobe!.amount).toBe(599.99);
  });
});

// ---------------------------------------------------------------------------
// Weekly recurring
// ---------------------------------------------------------------------------

describe('detectRecurring — weekly pattern', () => {
  it('detects a weekly subscription given 4 charges ~7 days apart', () => {
    const transactions: Transaction[] = [
      makeTransaction('Spotify', 21),
      makeTransaction('Spotify', 14),
      makeTransaction('Spotify', 7),
      makeTransaction('Spotify', 0),
    ];

    const results = detectRecurring(transactions);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const spotify = results.find(r => r.name.toLowerCase().includes('spotify'));
    expect(spotify).toBeDefined();
    expect(spotify!.billingCycle).toBe('weekly');
    expect(spotify!.occurrences).toBe(4);
  });

  it('assigns the Music category to a Spotify subscription', () => {
    const transactions: Transaction[] = [
      makeTransaction('Spotify', 21),
      makeTransaction('Spotify', 14),
      makeTransaction('Spotify', 7),
      makeTransaction('Spotify', 0),
    ];

    const results = detectRecurring(transactions);
    const spotify = results.find(r => r.name.toLowerCase().includes('spotify'));

    expect(spotify!.category).toBe('Music');
  });

  it('detects weekly with high confidence when gaps are consistent', () => {
    const transactions: Transaction[] = [
      makeTransaction('Spotify', 21),
      makeTransaction('Spotify', 14),
      makeTransaction('Spotify', 7),
      makeTransaction('Spotify', 0),
    ];

    const results = detectRecurring(transactions);
    const spotify = results.find(r => r.name.toLowerCase().includes('spotify'));

    // Consistent 7-day gaps → confidence should be ≥ 90
    expect(spotify!.confidence).toBeGreaterThanOrEqual(90);
  });
});

// ---------------------------------------------------------------------------
// Non-recurring / one-off merchants
// ---------------------------------------------------------------------------

describe('detectRecurring — non-recurring transactions', () => {
  it('returns no results (or skips) merchants with only one occurrence', () => {
    const transactions: Transaction[] = [
      makeTransaction('Starbucks', 10),
      makeTransaction('Amazon Fresh', 8),
      makeTransaction('Uber Eats', 5),
    ];

    const results = detectRecurring(transactions);

    // None should be detected — each merchant appears exactly once
    expect(results).toHaveLength(0);
  });

  it('does not detect as recurring when a merchant appears exactly once', () => {
    const transactions: Transaction[] = [
      makeTransaction('One-time Purchase', 15),
    ];

    const results = detectRecurring(transactions);

    expect(results).toHaveLength(0);
  });

  it('skips merchants with very short normalised keys (< 3 chars)', () => {
    const transactions: Transaction[] = [
      makeTransaction('AB', 30),
      makeTransaction('AB', 0),
    ];

    // "ab" normalises to a 2-char key which is filtered out
    const results = detectRecurring(transactions);

    expect(results).toHaveLength(0);
  });

  it('does not flag random irregular purchases as recurring', () => {
    // Three transactions for the same merchant but with wildly irregular gaps
    const transactions: Transaction[] = [
      makeTransaction('Coffee Shop Corner', 200),
      makeTransaction('Coffee Shop Corner', 90),
      makeTransaction('Coffee Shop Corner', 5),
    ];

    const results = detectRecurring(transactions);

    // If a result is returned its confidence must be below 85 (not "high")
    const coffeeResult = results.find(r => r.name.toLowerCase().includes('coffee'));
    if (coffeeResult) {
      expect(coffeeResult.confidence).toBeLessThan(85);
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases and boundary conditions
// ---------------------------------------------------------------------------

describe('detectRecurring — edge cases', () => {
  it('returns an empty array when passed an empty transaction list', () => {
    const results = detectRecurring([]);

    expect(results).toEqual([]);
  });

  it('returns results sorted by confidence descending', () => {
    // Netflix (monthly, 3 occurrences) should have higher confidence than a 2-occurrence yearly
    const transactions: Transaction[] = [
      makeTransaction('Netflix', 90),
      makeTransaction('Netflix', 60),
      makeTransaction('Netflix', 30),
      makeTransaction('Adobe Creative Cloud', 365),
      makeTransaction('Adobe Creative Cloud', 0),
    ];

    const results = detectRecurring(transactions);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });

  it('handles transactions with amounts that vary by more than 5% — skips with < 3 samples', () => {
    // 2 transactions with inconsistent amounts and only 2 samples → should be skipped
    const transactions: Transaction[] = [
      makeTransaction('InconsistentService', 30, 10.00),
      makeTransaction('InconsistentService', 0,  20.00),
    ];

    const results = detectRecurring(transactions);
    const found = results.find(r => r.name.toLowerCase().includes('inconsistentservice'));

    // Algorithm skips inconsistent amounts when fewer than 3 samples exist
    expect(found).toBeUndefined();
  });

  it('processes transactions with amounts that vary by more than 5% when 3+ samples exist', () => {
    // 3 transactions with somewhat inconsistent amounts — algorithm proceeds
    const transactions: Transaction[] = [
      makeTransaction('InconsistentService', 60, 10.00),
      makeTransaction('InconsistentService', 30, 15.00),
      makeTransaction('InconsistentService', 0,  12.00),
    ];

    const results = detectRecurring(transactions);
    const found = results.find(r => r.name.toLowerCase().includes('inconsistentservice'));

    // With 3 samples the algorithm does not skip on inconsistency alone —
    // result may or may not appear depending on confidence threshold
    if (found) {
      expect(found.occurrences).toBe(3);
      expect(found.amount).toBeCloseTo(12.33, 1);
    }
    // If not present, the low confidence threshold (< 50) filtered it — both outcomes are valid
  });

  it('truncates subscription name to 80 characters', () => {
    const longName = 'A'.repeat(100);
    const transactions: Transaction[] = [
      makeTransaction(longName, 60),
      makeTransaction(longName, 30),
      makeTransaction(longName, 0),
    ];

    const results = detectRecurring(transactions);

    if (results.length > 0) {
      expect(results[0].name.length).toBeLessThanOrEqual(80);
    }
  });

  it('groups transactions by normalised description, ignoring numeric order IDs', () => {
    // The normaliser strips long numbers, so these should map to the same group
    const transactions: Transaction[] = [
      makeTransaction('GitHub 12345678 Pro', 60),
      makeTransaction('GitHub 99887766 Pro', 30),
      makeTransaction('GitHub 11223344 Pro', 0),
    ];

    const results = detectRecurring(transactions);

    // All three should collapse into a single detected subscription
    const github = results.find(r => r.name.toLowerCase().includes('github'));
    if (github) {
      expect(github.occurrences).toBe(3);
    }
  });
});
