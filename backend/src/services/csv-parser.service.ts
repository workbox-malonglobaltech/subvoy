import { parse } from 'csv-parse/sync';

export interface Transaction {
  date: string;       // ISO date string
  description: string;
  amount: number;     // always positive
  currency: string;
}

// Known bank CSV column name variants
const DATE_COLS    = ['date', 'transaction date', 'trans date', 'posted date', 'value date'];
const DESC_COLS    = ['description', 'details', 'merchant', 'payee', 'narrative', 'memo', 'transaction description'];
const AMOUNT_COLS  = ['amount', 'debit', 'withdrawal', 'charge', 'transaction amount'];
const CURR_COLS    = ['currency', 'ccy'];

function findCol(headers: string[], candidates: string[]): string | null {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  return Math.abs(parseFloat(cleaned) || 0);
}

function parseDate(raw: string): string | null {
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  // Try DD/MM/YYYY
  const parts = raw.trim().split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    const attempt = new Date(`${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`);
    if (!isNaN(attempt.getTime())) return attempt.toISOString().split('T')[0];
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
  });

  if (!records.length) return [];

  const headers = Object.keys(records[0]);
  const dateCol   = findCol(headers, DATE_COLS);
  const descCol   = findCol(headers, DESC_COLS);
  const amtCol    = findCol(headers, AMOUNT_COLS);
  const currCol   = findCol(headers, CURR_COLS);

  if (!dateCol || !descCol || !amtCol) {
    throw new Error(`Could not identify required columns. Found: ${headers.join(', ')}`);
  }

  const transactions: Transaction[] = [];
  for (const row of records) {
    const date = parseDate(row[dateCol] ?? '');
    const amount = parseAmount(row[amtCol] ?? '0');
    if (!date || amount <= 0) continue;

    transactions.push({
      date,
      description: (row[descCol] ?? '').trim(),
      amount,
      currency: currCol ? (row[currCol] ?? 'USD').toUpperCase().slice(0, 3) : 'USD',
    });
  }

  return transactions;
}
