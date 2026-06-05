/**
 * Unit tests for the usePaymentHistory hook.
 *
 * The hook:
 *  - fetches GET /reports/payments?limit=500[&from=...][&to=...] on mount
 *  - starts in loading state, settles to { payments, error, loading: false }
 *  - sets error = 'Failed to load payment history' when the API throws
 *  - sets payments = [] on error
 *  - exposes a refetch() function that re-triggers the fetch
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { usePaymentHistory, PaymentRecord } from '../../hooks/usePaymentHistory';

// ---------------------------------------------------------------------------
// Mock api module
// ---------------------------------------------------------------------------

jest.mock('../../lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

import { api } from '../../lib/api';

const mockGet = api.get as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const fakePayments: PaymentRecord[] = [
  {
    id: 'tx-001',
    description: 'Paid: Netflix',
    currency: 'USD',
    amount: 15,
    balanceAfter: 50,
    paidAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'tx-002',
    description: 'Paid: Spotify',
    currency: 'USD',
    amount: 10,
    balanceAfter: 40,
    paidAt: '2026-04-05T10:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePaymentHistory', () => {
  it('starts in loading state before the first fetch completes', async () => {
    // Delay resolution so we can observe the loading = true state
    let resolve!: (v: PaymentRecord[]) => void;
    mockGet.mockReturnValue(new Promise<PaymentRecord[]>(r => { resolve = r; }));

    const { result } = renderHook(() => usePaymentHistory());

    expect(result.current.loading).toBe(true);
    expect(result.current.payments).toBeNull();
    expect(result.current.error).toBeNull();

    // Resolve to avoid "update not wrapped in act" warning
    await act(async () => { resolve([]); });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('populates payments after a successful fetch', async () => {
    mockGet.mockResolvedValue(fakePayments);

    const { result } = renderHook(() => usePaymentHistory());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.payments).toEqual(fakePayments);
  });

  it('sets error and empty payments when the API throws', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => usePaymentHistory());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to load payment history');
    expect(result.current.payments).toEqual([]);
  });

  it('always requests limit=500 in the URL', async () => {
    mockGet.mockResolvedValue([]);

    renderHook(() => usePaymentHistory());

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('limit=500'));
  });

  it('includes from in the request URL when provided', async () => {
    mockGet.mockResolvedValue([]);

    renderHook(() => usePaymentHistory('2026-01-01'));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('from=2026-01-01'),
    );
  });

  it('includes both from and to in the request URL when both are provided', async () => {
    mockGet.mockResolvedValue([]);

    renderHook(() => usePaymentHistory('2026-01-01', '2026-03-31'));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const url: string = mockGet.mock.calls[0][0];
    expect(url).toContain('from=2026-01-01');
    expect(url).toContain('to=2026-03-31');
  });

  it('omits from and to when not provided', async () => {
    mockGet.mockResolvedValue([]);

    renderHook(() => usePaymentHistory());

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const url: string = mockGet.mock.calls[0][0];
    expect(url).not.toContain('from=');
    expect(url).not.toContain('to=');
  });

  it('re-fetches when refetch() is called', async () => {
    mockGet.mockResolvedValue([]);
    const { result } = renderHook(() => usePaymentHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledTimes(1);

    mockGet.mockResolvedValue(fakePayments);
    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.current.payments).toEqual(fakePayments);
  });

  it('clears the previous error on a successful refetch', async () => {
    // First fetch: fail
    mockGet.mockRejectedValueOnce(new Error('fail'));
    const { result } = renderHook(() => usePaymentHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load payment history');

    // Second fetch: succeed
    mockGet.mockResolvedValue(fakePayments);
    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.payments).toEqual(fakePayments);
  });
});
