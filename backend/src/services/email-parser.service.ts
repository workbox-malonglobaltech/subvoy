import type { RawEmail } from './gmail.service';

// Must match the Transaction type in csv-parser.service.ts
export interface Transaction {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;
  currency: string;
}

// Amount patterns (ordered by specificity)
const AMOUNT_PATTERNS = [
  /Total(?:\s+Charged)?:\s*\$?([\d,]+\.?\d*)/i,
  /Amount(?:\s+Due)?:\s*\$?([\d,]+\.?\d*)/i,
  /Charged:\s*\$?([\d,]+\.?\d*)/i,
  /\$\s*([\d,]+\.\d{2})\b/,                   // $15.99
  /(?:USD|GBP|EUR|NGN|CAD|AUD)\s*([\d,]+\.?\d*)/i,
  /([\d,]+\.\d{2})\s*(?:USD|GBP|EUR)/i,
];

const CURRENCY_PATTERN = /\b(USD|GBP|EUR|NGN|CAD|AUD)\b/i;

function extractAmount(text: string): { amount: number; currency: string } | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(num) && num > 0 && num < 10000) {
        const currencyMatch = text.match(CURRENCY_PATTERN);
        return { amount: num, currency: currencyMatch ? currencyMatch[1].toUpperCase() : 'USD' };
      }
    }
  }
  return null;
}

function extractSenderName(from: string): string {
  // "Netflix <no-reply@netflix.com>" → "Netflix"
  // "no-reply@netflix.com"           → "Netflix"
  const displayNameMatch = from.match(/^([^<]+?)\s*</);
  if (displayNameMatch) {
    const name = displayNameMatch[1].trim().replace(/["']/g, '');
    // Filter out generic sender names
    if (!/no.?reply|noreply|support|billing|notifications?|info|mail|team/i.test(name)) {
      return name;
    }
  }

  // Fall back to domain extraction
  const emailMatch = from.match(/@([^.>]+)/);
  if (emailMatch) {
    // Capitalise first letter: "netflix" → "Netflix"
    return emailMatch[1].charAt(0).toUpperCase() + emailMatch[1].slice(1);
  }

  return from;
}

function parseDate(raw: string): string | null {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

export function parseReceiptEmails(emails: RawEmail[]): Transaction[] {
  const transactions: Transaction[] = [];

  for (const email of emails) {
    const searchText = `${email.subject} ${email.body} ${email.snippet}`;

    const extracted = extractAmount(searchText);
    if (!extracted) continue; // Skip emails with no parseable amount

    const date = parseDate(email.date);
    if (!date) continue;

    const description = extractSenderName(email.from);

    transactions.push({ date, description, amount: extracted.amount, currency: extracted.currency });
  }

  return transactions;
}
