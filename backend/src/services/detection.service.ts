import { Transaction } from './csv-parser.service';

export interface DetectedSubscription {
  name: string;
  amount: number;
  currency: string;
  billingCycle: 'weekly' | 'monthly' | 'yearly';
  nextBillingDate: string;
  category: string | null;
  confidence: number;
  occurrences: number;
  rawTransactions: Transaction[];
}

// Known subscription merchants + their categories
const KNOWN_SERVICES: Record<string, string> = {
  netflix: 'Entertainment',    'youtube premium': 'Entertainment',
  spotify: 'Music',            'apple music': 'Music',
  'amazon prime': 'Shopping',  'amazon': 'Shopping',
  'chatgpt': 'Software & SaaS','openai': 'Software & SaaS',
  'github': 'Software & SaaS', 'notion': 'Software & SaaS',
  'figma': 'Software & SaaS',  'adobe': 'Software & SaaS',
  'microsoft': 'Software & SaaS', 'office 365': 'Software & SaaS',
  'google': 'Software & SaaS', 'dropbox': 'Software & SaaS',
  'zoom': 'Software & SaaS',   'slack': 'Software & SaaS',
  'icloud': 'Software & SaaS', 'apple': 'Software & SaaS',
  'hulu': 'Entertainment',     'disney': 'Entertainment',
  'hbo': 'Entertainment',      'paramount': 'Entertainment',
  'peloton': 'Health & Fitness','headspace': 'Health & Fitness',
  'calm': 'Health & Fitness',  'duolingo': 'Education',
  'coursera': 'Education',     'udemy': 'Education',
  'deezer': 'Music',           'tidal': 'Music',
  'canva': 'Software & SaaS',  'loom': 'Software & SaaS',
};

function detectCategory(description: string): string | null {
  const lower = description.toLowerCase();
  for (const [key, cat] of Object.entries(KNOWN_SERVICES)) {
    if (lower.includes(key)) return cat;
  }
  return null;
}

function normalizeDescription(desc: string): string {
  return desc.toLowerCase()
    .replace(/\s*\*\s*/g, ' ')
    .replace(/\d{4,}/g, '')        // remove long numbers (order IDs)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ').slice(0, 4).join(' '); // first 4 meaningful words
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function guessBillingCycle(transactions: Transaction[]): {
  cycle: 'weekly' | 'monthly' | 'yearly';
  confidence: number;
} {
  if (transactions.length < 2) return { cycle: 'monthly', confidence: 40 };

  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1].date, sorted[i].date));
  }

  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const maxDeviation = Math.max(...gaps.map(g => Math.abs(g - avgGap)));
  const isConsistent = maxDeviation <= 5;

  if (avgGap <= 10)                   return { cycle: 'weekly',  confidence: isConsistent ? 90 : 60 };
  if (avgGap >= 25 && avgGap <= 35)   return { cycle: 'monthly', confidence: isConsistent ? 95 : 70 };
  if (avgGap >= 340 && avgGap <= 390) return { cycle: 'yearly',  confidence: isConsistent ? 90 : 65 };

  // Fallback
  if (avgGap < 20)  return { cycle: 'weekly',  confidence: 50 };
  if (avgGap < 100) return { cycle: 'monthly', confidence: 55 };
  return { cycle: 'yearly', confidence: 50 };
}

function nextDate(lastDate: string, cycle: 'weekly' | 'monthly' | 'yearly'): string {
  const d = new Date(lastDate);
  if (cycle === 'weekly')  d.setDate(d.getDate() + 7);
  if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
  if (cycle === 'yearly')  d.setFullYear(d.getFullYear() + 1);
  // Ensure it's in the future
  const today = new Date();
  while (d <= today) {
    if (cycle === 'weekly')  d.setDate(d.getDate() + 7);
    if (cycle === 'monthly') d.setMonth(d.getMonth() + 1);
    if (cycle === 'yearly')  d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().split('T')[0];
}

function amountsConsistent(transactions: Transaction[]): boolean {
  const amounts = transactions.map(t => t.amount);
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  return amounts.every(a => Math.abs(a - avg) / avg < 0.05); // within 5%
}

export function detectRecurring(transactions: Transaction[]): DetectedSubscription[] {
  // Group by normalized description
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions) {
    const key = normalizeDescription(tx.description);
    if (!key || key.length < 3) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }

  const results: DetectedSubscription[] = [];

  for (const [, txs] of groups) {
    if (txs.length < 2) continue; // need at least 2 occurrences

    const { cycle, confidence: cycleConf } = guessBillingCycle(txs);
    const consistent = amountsConsistent(txs);
    if (!consistent && txs.length < 3) continue; // skip inconsistent with few samples

    // Calculate confidence score
    let confidence = cycleConf;
    if (txs.length >= 3) confidence = Math.min(100, confidence + 10);
    if (txs.length >= 6) confidence = Math.min(100, confidence + 5);
    if (consistent)      confidence = Math.min(100, confidence + 5);
    if (confidence < 50) continue; // too uncertain

    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    const lastTx = sorted[sorted.length - 1];
    const avgAmount = txs.reduce((s, t) => s + t.amount, 0) / txs.length;

    // Use the most descriptive/shortest original description as name
    const name = txs.reduce((best, t) =>
      t.description.length < best.length ? t.description : best,
      txs[0].description
    ).slice(0, 80);

    results.push({
      name,
      amount: Math.round(avgAmount * 100) / 100,
      currency: lastTx.currency,
      billingCycle: cycle,
      nextBillingDate: nextDate(lastTx.date, cycle),
      category: detectCategory(name),
      confidence,
      occurrences: txs.length,
      rawTransactions: sorted,
    });
  }

  // Sort by confidence desc
  return results.sort((a, b) => b.confidence - a.confidence);
}
