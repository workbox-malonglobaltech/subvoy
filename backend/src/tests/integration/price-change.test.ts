/**
 * Integration tests for the price-change detection logic inside runReminderScan.
 *
 * We call runReminderScan() directly (not via HTTP) and assert on the pool.query
 * calls it makes, verifying that:
 *   - A price_change notification is created when amount ≠ last_known_amount
 *   - last_known_amount is updated after the alert
 *   - No duplicate alert fires if alreadyPriceAlertedToday returns true
 *   - No alert fires when amounts match
 */

const mockQuery = jest.fn();

jest.mock('../../db', () => ({
  pool: { query: (...args: unknown[]) => mockQuery(...args) },
}));

jest.mock('../../services/email.service', () => ({
  sendReminderEmail: jest.fn().mockResolvedValue(undefined),
  sendBudgetAlertEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runReminderScan } = require('../../services/reminder.service');

beforeEach(() => mockQuery.mockReset());

/** Convenience: build the standard 5 query responses for a scan with no due subs and no budget rows */
function mockEmptyReminders() {
  mockQuery
    .mockResolvedValueOnce({ rows: [] })  // due subscriptions query
    .mockResolvedValueOnce({ rows: [] }); // budget rows query
}

describe('Price change detection in runReminderScan', () => {
  it('creates a price_change notification when amount differs from last_known_amount', async () => {
    mockEmptyReminders();

    // Price change rows query
    mockQuery.mockResolvedValueOnce({
      rows: [{
        sub_id:            'sub-001',
        sub_name:          'Netflix',
        currency:          'USD',
        current_amount:    '15.99',
        last_known_amount: '13.99',
        user_id:           'user-001',
      }],
    });

    // alreadyPriceAlertedToday → false
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    // notifModel.create INSERT
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'notif-001', user_id: 'user-001', subscription_id: 'sub-001', type: 'price_change', title: 'Netflix price increased', message: 'Netflix changed from $13.99 to $15.99/mo.', is_read: false, created_at: new Date() }] });
    // updateLastKnownAmount
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await runReminderScan();

    // Find the INSERT notification call
    const insertCall = (mockQuery.mock.calls as [string, unknown[]][]).find(
      ([sql]) => sql.includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeDefined();

    const params = insertCall![1] as unknown[];
    expect(params).toContain('price_change');
    expect(params).toContain('user-001');
    expect(params).toContain('sub-001');

    // Verify updateLastKnownAmount was called with new amount
    const updateCall = (mockQuery.mock.calls as [string, unknown[]][]).find(
      ([sql]) => sql.includes('UPDATE subscriptions SET last_known_amount')
    );
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).toContain(15.99);
  });

  it('does NOT create a notification when already alerted today', async () => {
    mockEmptyReminders();

    mockQuery.mockResolvedValueOnce({
      rows: [{
        sub_id: 'sub-002', sub_name: 'Spotify', currency: 'USD',
        current_amount: '11.99', last_known_amount: '9.99', user_id: 'user-001',
      }],
    });

    // alreadyPriceAlertedToday → true (already sent today)
    mockQuery.mockResolvedValueOnce({ rows: [{ count: '1' }] });

    await runReminderScan();

    const insertCall = (mockQuery.mock.calls as [string, unknown[]][]).find(
      ([sql]) => sql.includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeUndefined();
  });

  it('does NOT alert when no price changes exist', async () => {
    mockEmptyReminders();

    // Price change query returns empty
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await runReminderScan();

    const insertCall = (mockQuery.mock.calls as [string, unknown[]][]).find(
      ([sql]) => sql.includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeUndefined();
  });

  it('handles price decrease correctly', async () => {
    mockEmptyReminders();

    mockQuery.mockResolvedValueOnce({
      rows: [{
        sub_id: 'sub-003', sub_name: 'Adobe', currency: 'USD',
        current_amount: '49.99', last_known_amount: '54.99', user_id: 'user-002',
      }],
    });

    mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // not alerted
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'n2', user_id: 'user-002', subscription_id: 'sub-003', type: 'price_change', title: 'Adobe price decreased', message: '', is_read: false, created_at: new Date() }] });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // update

    await runReminderScan();

    const insertCall = (mockQuery.mock.calls as [string, unknown[]][]).find(
      ([sql]) => sql.includes('INSERT INTO notifications')
    );
    expect(insertCall).toBeDefined();
    // Title should say "decreased"
    const params = insertCall![1] as unknown[];
    const titleParam = params.find(p => typeof p === 'string' && (p as string).includes('decreased'));
    expect(titleParam).toBeDefined();
  });

  it('handles multiple price changes in one scan', async () => {
    mockEmptyReminders();

    mockQuery.mockResolvedValueOnce({
      rows: [
        { sub_id: 'sub-004', sub_name: 'Netflix', currency: 'USD', current_amount: '15.99', last_known_amount: '13.99', user_id: 'user-001' },
        { sub_id: 'sub-005', sub_name: 'Spotify', currency: 'USD', current_amount: '11.99', last_known_amount: '9.99',  user_id: 'user-001' },
      ],
    });

    // For each sub: alreadyAlerted? → false, INSERT, UPDATE
    for (let i = 0; i < 2; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: `n${i}`, user_id: 'user-001', subscription_id: `sub-00${i+4}`, type: 'price_change', title: '', message: '', is_read: false, created_at: new Date() }] });
      mockQuery.mockResolvedValueOnce({ rows: [] });
    }

    await runReminderScan();

    const insertCalls = (mockQuery.mock.calls as [string, unknown[]][]).filter(
      ([sql]) => sql.includes('INSERT INTO notifications')
    );
    expect(insertCalls).toHaveLength(2);
  });
});
