import { pool } from '../db';
import type { Plan } from '../../../src/shared/types';

interface PlanRow {
  key: string;
  display_name: string;
  audience: 'personal' | 'business';
  price_minor: number;
  currency: string;
  interval: 'month' | 'year' | null;
  features: string[];
  sort_order: number;
}

function toPlan(row: PlanRow): Plan {
  return {
    key: row.key,
    displayName: row.display_name,
    audience: row.audience,
    priceMinor: row.price_minor,
    currency: row.currency,
    interval: row.interval,
    features: row.features,
    sortOrder: row.sort_order,
  };
}

/** Active plans, ordered by audience then sort_order. */
export async function listActive(): Promise<Plan[]> {
  const { rows } = await pool.query<PlanRow>(
    `SELECT key, display_name, audience, price_minor, currency, interval, features, sort_order
     FROM plans WHERE is_active = TRUE ORDER BY audience, sort_order`
  );
  return rows.map(toPlan);
}

export async function findByKey(key: string): Promise<Plan | null> {
  const { rows } = await pool.query<PlanRow>(
    `SELECT key, display_name, audience, price_minor, currency, interval, features, sort_order
     FROM plans WHERE key = $1`,
    [key]
  );
  return rows[0] ? toPlan(rows[0]) : null;
}
