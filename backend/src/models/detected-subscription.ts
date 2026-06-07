import { pool } from '../db';
import { DetectedSubscription } from '../services/detection.service';

export interface DetectedSub {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  amount: number;
  currency: string;
  billingCycle: string;
  nextBillingDate: string | null;
  category: string | null;
  confidence: number;
  occurrences: number;
  status: 'pending' | 'confirmed' | 'dismissed';
  createdAt: string;
}

interface DetectedSubRow {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  amount: string;
  currency: string;
  billing_cycle: string;
  next_billing_date: Date | null;
  category: string | null;
  confidence: number;
  occurrences: number;
  status: string;
  created_at: Date;
}

function toDetectedSub(row: DetectedSubRow): DetectedSub {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    name: row.name,
    amount: parseFloat(row.amount),
    currency: row.currency,
    billingCycle: row.billing_cycle,
    nextBillingDate: row.next_billing_date ? row.next_billing_date.toISOString().split('T')[0] : null,
    category: row.category,
    confidence: row.confidence,
    occurrences: row.occurrences,
    status: row.status as DetectedSub['status'],
    createdAt: row.created_at.toISOString(),
  };
}

export async function createMany(
  workspaceId: string,
  userId: string,
  detected: DetectedSubscription[]
): Promise<DetectedSub[]> {
  // Clear previous pending detections for this workspace
  await pool.query(
    "DELETE FROM detected_subscriptions WHERE workspace_id = $1 AND status = 'pending'",
    [workspaceId]
  );

  const results: DetectedSub[] = [];
  for (const d of detected) {
    const { rows } = await pool.query<DetectedSubRow>(
      `INSERT INTO detected_subscriptions
        (workspace_id, user_id, name, amount, currency, billing_cycle, next_billing_date, category, confidence, occurrences, raw_transactions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        workspaceId, userId, d.name, d.amount, d.currency, d.billingCycle,
        d.nextBillingDate, d.category, d.confidence, d.occurrences,
        JSON.stringify(d.rawTransactions),
      ]
    );
    results.push(toDetectedSub(rows[0]));
  }
  return results;
}

export async function findPendingByWorkspace(workspaceId: string): Promise<DetectedSub[]> {
  const { rows } = await pool.query<DetectedSubRow>(
    "SELECT * FROM detected_subscriptions WHERE workspace_id = $1 AND status = 'pending' ORDER BY confidence DESC",
    [workspaceId]
  );
  return rows.map(toDetectedSub);
}

export async function confirm(id: string, workspaceId: string): Promise<DetectedSub | null> {
  const { rows } = await pool.query<DetectedSubRow>(
    "UPDATE detected_subscriptions SET status = 'confirmed' WHERE id = $1 AND workspace_id = $2 RETURNING *",
    [id, workspaceId]
  );
  return rows[0] ? toDetectedSub(rows[0]) : null;
}

export async function dismiss(id: string, workspaceId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "UPDATE detected_subscriptions SET status = 'dismissed' WHERE id = $1 AND workspace_id = $2",
    [id, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}
