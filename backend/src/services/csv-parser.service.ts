import { parse } from 'csv-parse/sync';

export interface Transaction {
  date: string;       // ISO date string
  description: string;
  amount: number;     // always positive
  currency: string;
}

/**
 * Column-name keyword sets, matched against NORMALISED headers (lowercase,
 * alphanumeric only) — exact-match first, then substring. This makes detection
 * tolerant of the many ways banks label columns:
 *   "Transaction Date", "Posting Date", "Value Date" → date
 *   "Narration", "Details", "Particulars", "Payee"   → description
 *   "Debit", "Withdrawal", "Money Out", "Amount"      → amount (money out)
 */
const DATE_KEYS   = ['date', 'transactiondate', 'transdate', 'posteddate', 'postingdate', 'valuedate', 'bookingdate', 'posted'];
const DESC_KEYS   = ['description', 'transactiondescription', 'transactiondetails', 'transactioninformation', 'details', 'narration', 'narrative', 'particulars', 'memo', 'payee', 'merchant', 'reference', 'remarks', 'naration'];
const AMOUNT_KEYS = ['amount', 'transactionamount', 'debitamount', 'debit', 'withdrawal', 'withdrawals', 'moneyout', 'paidout', 'charge', 'value', 'dr'];
const CREDIT_KEYS = ['creditamount', 'credit', 'deposit', 'moneyin', 'paidin', 'cr'];
const CURR_KEYS   = ['currency', 'ccy', 'curr'];

function normalize(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Finds the first header matching any keyword (exact, then substring), skipping already-used headers. */
function findCol(headers: string[], keys: string[], used: Set<string>): string | null {
  const cand = headers.filter(h => !used.has(h)).map(h => ({ orig: h, n: normalize(h) }));
  for (const k of keys) { const e = cand.find(c => c.n === k); if (e) return e.orig; }
  for (const k of keys) { const e = cand.find(c => c.n.includes(k)); if (e) return e.orig; }
  return null;
}

/** Parses a money string: strips currency symbols/commas/spaces; magnitude only. */
function parseAmount(raw: string): number {
  if (!raw) return 0;
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : Math.abs(n);
}

/** Parses a date in many common formats (ISO, DD/MM/YYYY, MM/DD/YYYY, "05 Jun 2026"). */
function parseDate(raw: string): string | null {
  const t = (raw || '').trim();
  if (!t) return null;
  const native = new Date(t);
  if (!isNaN(native.getTime())) return native.toISOString().split('T')[0];
  const parts = t.split(/[/\-.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    for (const [dd, mm] of [[a, b], [b, a]]) { // try DD/MM then MM/DD
      const attempt = new Date(`${c}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`);
      if (!isNaN(attempt.getTime())) return attempt.toISOString().split('T')[0];
    }
  }
  return null;
}

export function parseCSV(buffer: Buffer): Transaction[] {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
    bom: true, // strip UTF-8 BOM some banks prepend
  });

  if (!records.length) return [];

  const headers = Object.keys(records[0]);
  const used = new Set<string>();
  // Order matters: claim date first so "Transaction Date" isn't taken as description.
  const dateCol = findCol(headers, DATE_KEYS, used);   if (dateCol) used.add(dateCol);
  const amtCol = findCol(headers, AMOUNT_KEYS, used);  if (amtCol) used.add(amtCol);
  const creditCol = findCol(headers, CREDIT_KEYS, used); if (creditCol) used.add(creditCol);
  const descCol = findCol(headers, DESC_KEYS, used);   if (descCol) used.add(descCol);
  const currCol = findCol(headers, CURR_KEYS, used);

  if (!dateCol || !descCol || !amtCol) {
    const missing = [!dateCol && 'date', !descCol && 'description', !amtCol && 'amount']
      .filter(Boolean).join(', ');
    throw new Error(`Couldn't find ${missing} column(s). Detected headers: ${headers.join(', ')}`);
  }

  const transactions: Transaction[] = [];
  for (const row of records) {
    const date = parseDate(row[dateCol] ?? '');
    const amount = parseAmount(row[amtCol] ?? '');
    // Skip rows with no money-out (e.g. credit/deposit rows in a debit-column statement).
    if (!date || amount <= 0) continue;

    transactions.push({
      date,
      description: (row[descCol] ?? '').trim(),
      amount,
      currency: currCol
        ? ((row[currCol] ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'USD')
        : 'USD',
    });
  }

  return transactions;
}
