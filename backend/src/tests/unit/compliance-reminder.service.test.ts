/**
 * Unit tests for the compliance reminder scan — fires per-item, deduped per day,
 * with overdue vs upcoming copy.
 */

jest.mock('../../db', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../models/notification', () => ({
  create: jest.fn(),
  alreadyComplianceNotifiedToday: jest.fn(),
}));

import { runComplianceReminderScan } from '../../services/compliance-reminder.service';
import { pool } from '../../db';
import * as notifModel from '../../models/notification';

const query = (pool as unknown as { query: jest.Mock }).query;

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    item_id: 'c-1', title: 'Annual Return', authority: 'CAC',
    due_date: new Date('2026-12-31'), days_until: 7, user_id: 'user-1', ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (notifModel.alreadyComplianceNotifiedToday as jest.Mock).mockResolvedValue(false);
  (notifModel.create as jest.Mock).mockResolvedValue({});
});

describe('runComplianceReminderScan', () => {
  it('sends an upcoming reminder for a due-soon item', async () => {
    query.mockResolvedValueOnce({ rows: [row({ days_until: 7 })] });

    const sent = await runComplianceReminderScan();

    expect(sent).toBe(1);
    const arg = (notifModel.create as jest.Mock).mock.calls[0][0];
    expect(arg).toMatchObject({ userId: 'user-1', complianceItemId: 'c-1', type: 'compliance_reminder' });
    expect(arg.title).toMatch(/due in 7 days/i);
    expect(arg.message).toMatch(/CAC/);
  });

  it('uses "due today" copy at offset 0', async () => {
    query.mockResolvedValueOnce({ rows: [row({ days_until: 0 })] });
    await runComplianceReminderScan();
    expect((notifModel.create as jest.Mock).mock.calls[0][0].title).toMatch(/due today/i);
  });

  it('uses overdue copy when past due', async () => {
    query.mockResolvedValueOnce({ rows: [row({ days_until: -3 })] });
    await runComplianceReminderScan();
    const arg = (notifModel.create as jest.Mock).mock.calls[0][0];
    expect(arg.title).toMatch(/3 days overdue/i);
    expect(arg.message).toMatch(/not yet completed/i);
  });

  it('skips items already notified today (dedup)', async () => {
    query.mockResolvedValueOnce({ rows: [row()] });
    (notifModel.alreadyComplianceNotifiedToday as jest.Mock).mockResolvedValue(true);

    const sent = await runComplianceReminderScan();

    expect(sent).toBe(0);
    expect(notifModel.create).not.toHaveBeenCalled();
  });

  it('returns 0 when nothing is due', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await runComplianceReminderScan()).toBe(0);
  });
});
