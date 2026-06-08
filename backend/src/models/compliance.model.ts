import { pool } from '../db';
import { clampLimit, safeOffset } from '../lib/pagination';
import type {
  ComplianceItem,
  CreateComplianceItemInput,
  UpdateComplianceItemInput,
} from '../../../src/shared/types';

interface ComplianceRow {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  description: string | null;
  authority: string | null;
  reference_number: string | null;
  jurisdiction: string | null;
  cadence: ComplianceItem['cadence'];
  due_date: Date;
  reminder_offsets: number[];
  status: ComplianceItem['status'];
  penalty_note: string | null;
  is_active: boolean;
  assignee_user_id: string | null;
  overdue: boolean;
  created_at: Date;
  updated_at: Date;
}

// "overdue" is derived in SQL, never stored.
const OVERDUE_EXPR = `(due_date < CURRENT_DATE AND status <> 'completed') AS overdue`;

function toItem(row: ComplianceRow): ComplianceItem {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    description: row.description,
    authority: row.authority,
    referenceNumber: row.reference_number,
    jurisdiction: row.jurisdiction,
    cadence: row.cadence,
    dueDate: row.due_date.toISOString().split('T')[0],
    reminderOffsets: row.reminder_offsets,
    status: row.status,
    penaltyNote: row.penalty_note,
    isActive: row.is_active,
    assigneeUserId: row.assignee_user_id,
    overdue: row.overdue,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllByWorkspace(
  workspaceId: string,
  includeInactive = false,
  opts: { limit?: number; offset?: number } = {}
): Promise<ComplianceItem[]> {
  const { rows } = await pool.query<ComplianceRow>(
    `SELECT *, ${OVERDUE_EXPR} FROM compliance_items
     WHERE workspace_id = $1 ${includeInactive ? '' : 'AND is_active = TRUE'}
     ORDER BY due_date ASC LIMIT $2 OFFSET $3`,
    [workspaceId, clampLimit(opts.limit), safeOffset(opts.offset)]
  );
  return rows.map(toItem);
}

export async function findById(id: string, workspaceId: string): Promise<ComplianceItem | null> {
  const { rows } = await pool.query<ComplianceRow>(
    `SELECT *, ${OVERDUE_EXPR} FROM compliance_items WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  return rows[0] ? toItem(rows[0]) : null;
}

export async function create(
  workspaceId: string,
  userId: string,
  data: CreateComplianceItemInput
): Promise<ComplianceItem> {
  const { rows } = await pool.query<ComplianceRow>(
    `INSERT INTO compliance_items
       (workspace_id, user_id, title, description, authority, reference_number, jurisdiction,
        cadence, due_date, reminder_offsets, penalty_note, assignee_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, '{30,7,1}'), $11, $12)
     RETURNING *, ${OVERDUE_EXPR}`,
    [
      workspaceId,
      userId,
      data.title,
      data.description ?? null,
      data.authority ?? null,
      data.referenceNumber ?? null,
      data.jurisdiction ?? null,
      data.cadence,
      data.dueDate,
      data.reminderOffsets ?? null,
      data.penaltyNote ?? null,
      data.assigneeUserId ?? null,
    ]
  );
  return toItem(rows[0]);
}

export async function update(
  id: string,
  workspaceId: string,
  data: UpdateComplianceItemInput
): Promise<ComplianceItem | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  const set = (col: string, val: unknown) => { fields.push(`${col} = $${idx++}`); values.push(val); };

  if (data.title !== undefined) set('title', data.title);
  if (data.description !== undefined) set('description', data.description);
  if (data.authority !== undefined) set('authority', data.authority);
  if (data.referenceNumber !== undefined) set('reference_number', data.referenceNumber);
  if (data.jurisdiction !== undefined) set('jurisdiction', data.jurisdiction);
  if (data.cadence !== undefined) set('cadence', data.cadence);
  if (data.dueDate !== undefined) set('due_date', data.dueDate);
  if (data.reminderOffsets !== undefined) set('reminder_offsets', data.reminderOffsets);
  if (data.status !== undefined) set('status', data.status);
  if (data.penaltyNote !== undefined) set('penalty_note', data.penaltyNote);
  if (data.isActive !== undefined) set('is_active', data.isActive);
  if (data.assigneeUserId !== undefined) set('assignee_user_id', data.assigneeUserId);

  if (fields.length === 0) return findById(id, workspaceId);

  fields.push(`updated_at = NOW()`);
  values.push(id, workspaceId);

  const { rows } = await pool.query<ComplianceRow>(
    `UPDATE compliance_items SET ${fields.join(', ')}
     WHERE id = $${idx++} AND workspace_id = $${idx++}
     RETURNING *, ${OVERDUE_EXPR}`,
    values
  );
  return rows[0] ? toItem(rows[0]) : null;
}

export async function softDelete(id: string, workspaceId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE compliance_items SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
    [id, workspaceId]
  );
  return (rowCount ?? 0) > 0;
}
