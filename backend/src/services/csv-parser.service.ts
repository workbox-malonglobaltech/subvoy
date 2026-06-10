import { parse } from 'csv-parse/sync';

export interface Transaction {
  date: string;       // ISO date string
  description: string;
  amount: number;     // always positive
  currency: string;
}

/** Thrown when we can't identify the required columns — safe to show to the user. */
export class CsvParseError extends Error {
  constructor(message: string) { super(message); this.name = 'CsvParseError'; }
}

/**
 * Column-name keyword sets, matched against NORMALISED headers (lowercase,
 * alphanumeric only) — exact-match first, then substring. Used as the fast path;
 * when a header isn't recognised we fall back to CONTENT inference (below).
 */
const DATE_KEYS   = ['date', 'transactiondate', 'transdate', 'posteddate', 'postingdate', 'valuedate', 'bookingdate', 'posted'];
const DESC_KEYS   = ['description', 'transactiondescription', 'transactiondetails', 'transactioninformation', 'details', 'narration', 'narrative', 'particulars', 'memo', 'payee', 'merchant', 'reference', 'remarks', 'naration'];
const AMOUNT_KEYS = ['amount', 'transactionamount', 'debitamount', 'debit', 'withdrawal', 'withdrawals', 'moneyout', 'paidout', 'charge', 'value', 'dr'];
const CREDIT_KEYS = ['creditamount', 'credit', 'deposit', 'moneyin', 'paidin', 'cr'];
const CURR_KEYS   = ['currency', 'ccy', 'curr'];

function normalize(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Finds the first header matching any keyword (exact, then substring), skipping used headers. */
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
  if (!isNaN(native.getTime()) && /\d{4}/.test(t)) return native.toISOString().split('T')[0];
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

interface ColScore { dateScore: number; amountScore: number; avgLen: number; }

/**
 * Scores each column by its DATA so we can identify columns regardless of how the
 * bank named them: which column holds dates, which holds money, which is free text.
 * A value counts as a date OR (failing that) an amount — so a date column scores
 * high on dateScore and low on amountScore, and vice-versa.
 */
function scoreColumns(records: Record<string, string>[], headers: string[]): Record<string, ColScore> {
  const sample = records.slice(0, 50);
  const out: Record<string, ColScore> = {};
  for (const h of headers) {
    let dateHits = 0, amtHits = 0, lenSum = 0, n = 0;
    for (const row of sample) {
      const v = (row[h] ?? '').trim();
      if (!v) continue;
      n++; lenSum += v.length;
      if (parseDate(v)) { dateHits++; continue; }
      const cleaned = v.replace(/[^0-9.]/g, '');
      if (/\d/.test(v) && cleaned !== '' && !isNaN(parseFloat(cleaned))) amtHits++;
    }
    out[h] = { dateScore: n ? dateHits / n : 0, amountScore: n ? amtHits / n : 0, avgLen: n ? lenSum / n : 0 };
  }
  return out;
}

/** Picks the unused header maximising scoreFn, provided it clears `threshold`. */
function inferCol(headers: string[], used: Set<string>, scoreFn: (h: string) => number, threshold: number): string | null {
  let best: string | null = null;
  let bestVal = threshold;
  for (const h of headers) {
    if (used.has(h)) continue;
    const v = scoreFn(h);
    if (v > bestVal) { bestVal = v; best = h; }
  }
  return best;
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
  const scores = scoreColumns(records, headers);
  const used = new Set<string>();

  // 1) Fast path: match by header name (claim date first so "Transaction Date"
  //    isn't taken as the description).
  let dateCol = findCol(headers, DATE_KEYS, used);   if (dateCol) used.add(dateCol);
  let amtCol = findCol(headers, AMOUNT_KEYS, used);  if (amtCol) used.add(amtCol);
  const creditCol = findCol(headers, CREDIT_KEYS, used); if (creditCol) used.add(creditCol);
  let descCol = findCol(headers, DESC_KEYS, used);   if (descCol) used.add(descCol);
  const currCol = findCol(headers, CURR_KEYS, used);

  // 2) Content fallback for anything the header names didn't reveal.
  if (!dateCol) { dateCol = inferCol(headers, used, h => scores[h].dateScore, 0.5); if (dateCol) used.add(dateCol); }
  if (!amtCol)  { amtCol  = inferCol(headers, used, h => scores[h].amountScore, 0.5); if (amtCol) used.add(amtCol); }
  if (!descCol) { descCol = inferCol(headers, used, h => scores[h].avgLen, 3); if (descCol) used.add(descCol); }

  if (!dateCol || !descCol || !amtCol) {
    const missing = [!dateCol && 'date', !descCol && 'description', !amtCol && 'amount'].filter(Boolean).join(', ');
    throw new CsvParseError(
      `Couldn't identify the ${missing} column(s) in your statement. ` +
      `Columns found: ${headers.join(', ')}. ` +
      `Make sure the file has a date, a description/narration, and an amount (or debit) column.`
    );
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
