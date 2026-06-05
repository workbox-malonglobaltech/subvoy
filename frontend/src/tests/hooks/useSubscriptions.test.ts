/**
 * Unit tests for the useSubscriptions hook.
 *
 * The hook manages a list of Subscription objects and exposes:
 *  - fetchAll  — called on mount; re-fetches the full list
 *  - add       — POST /subscriptions, appends the returned sub to state
 *  - update    — PUT /subscriptions/:id, replaces the matching sub in state
 *  - remove    — DELETE /subscriptions/:id, removes the sub from state
 *  - hardRemove— DELETE /subscriptions/:id?hard=true, same local effect
 *  - archive   — PUT /subscriptions/:id { isActive: false }
 *  - restore   — PUT /subscriptions/:id { isActive: true }
 *  - bulkDelete— POST /subscriptions/bulk-delete, removes all listed ids
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useSubscriptions } from '../../hooks/useSubscriptions';
import type { Subscription, CreateSubscriptionInput } from '../../../../src/shared/types';

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

const mockGet    = api.get    as jest.Mock;
const mockPost   = api.post   as jest.Mock;
const mockPut    = api.put    as jest.Mock;
const mockDelete = api.delete as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-001',
    name: 'Netflix',
    amount: 15,
    currency: 'USD',
    billingCycle: 'monthly',
    nextBillingDate: '2026-05-01',
    category: 'Entertainment',
    logoUrl: null,
    notes: null,
    isActive: true,
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
}

const sub1 = makeSub({ id: 'sub-001', name: 'Netflix' });
const sub2 = makeSub({ id: 'sub-002', name: 'Spotify', amount: 10 });

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Initial load
// ---------------------------------------------------------------------------

describe('useSubscriptions — initial load', () => {
  it('starts in loading state', async () => {
    let resolve!: (v: Subscription[]) => void;
    mockGet.mockReturnValue(new Promise<Subscription[]>(r => { resolve = r; }));

    const { result } = renderHook(() => useSubscriptions());

    expect(result.current.loading).toBe(true);

    await act(async () => { resolve([]); });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('populates subscriptions after a successful fetch', async () => {
    mockGet.mockResolvedValue([sub1, sub2]);

    const { result } = renderHook(() => useSubscriptions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscriptions).toEqual([sub1, sub2]);
    expect(result.current.error).toBeNull();
  });

  it('sets error when the API throws', async () => {
    mockGet.mockRejectedValue(new Error('Failed to load subscriptions'));

    const { result } = renderHook(() => useSubscriptions());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to load subscriptions');
  });

  it('fetches with includeInactive=true when flag is set', async () => {
    mockGet.mockResolvedValue([]);

    renderHook(() => useSubscriptions(true));

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('includeInactive=true'),
    );
  });

  it('fetches without includeInactive param by default', async () => {
    mockGet.mockResolvedValue([]);

    renderHook(() => useSubscriptions());

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet).not.toHaveBeenCalledWith(
      expect.stringContaining('includeInactive'),
    );
  });
});

// ---------------------------------------------------------------------------
// add
// ---------------------------------------------------------------------------

describe('useSubscriptions — add()', () => {
  it('appends the new subscription to local state', async () => {
    mockGet.mockResolvedValue([sub1]);
    const newSub = makeSub({ id: 'sub-003', name: 'Disney+' });
    mockPost.mockResolvedValue(newSub);

    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const input: CreateSubscriptionInput = {
      name: 'Disney+',
      amount: 8,
      billingCycle: 'monthly',
      nextBillingDate: '2026-05-01',
    };

    await act(async () => {
      await result.current.add(input);
    });

    expect(result.current.subscriptions).toHaveLength(2);
    expect(result.current.subscriptions[1].name).toBe('Disney+');
    expect(mockPost).toHaveBeenCalledWith('/subscriptions', input);
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('useSubscriptions — update()', () => {
  it('replaces the matching subscription in local state', async () => {
    mockGet.mockResolvedValue([sub1, sub2]);
    const updated = { ...sub1, amount: 20 };
    mockPut.mockResolvedValue(updated);

    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.update('sub-001', { amount: 20 });
    });

    const found = result.current.subscriptions.find(s => s.id === 'sub-001');
    expect(found?.amount).toBe(20);
    expect(result.current.subscriptions).toHaveLength(2);
    expect(mockPut).toHaveBeenCalledWith('/subscriptions/sub-001', { amount: 20 });
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe('useSubscriptions — remove()', () => {
  it('removes the subscription from local state', async () => {
    mockGet.mockResolvedValue([sub1, sub2]);
    mockDelete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.remove('sub-001');
    });

    expect(result.current.subscriptions.some(s => s.id === 'sub-001')).toBe(false);
    expect(result.current.subscriptions).toHaveLength(1);
    expect(mockDelete).toHaveBeenCalledWith('/subscriptions/sub-001');
  });
});

// ---------------------------------------------------------------------------
// hardRemove
// ---------------------------------------------------------------------------

describe('useSubscriptions — hardRemove()', () => {
  it('permanently removes the subscription and calls the hard delete endpoint', async () => {
    mockGet.mockResolvedValue([sub1, sub2]);
    mockDelete.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.hardRemove('sub-002');
    });

    expect(result.current.subscriptions.some(s => s.id === 'sub-002')).toBe(false);
    expect(mockDelete).toHaveBeenCalledWith('/subscriptions/sub-002?hard=true');
  });
});

// ---------------------------------------------------------------------------
// archive / restore
// ---------------------------------------------------------------------------

describe('useSubscriptions — archive()', () => {
  it('sets isActive to false in local state', async () => {
    mockGet.mockResolvedValue([sub1]);
    const archived = { ...sub1, isActive: false };
    mockPut.mockResolvedValue(archived);

    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.archive('sub-001');
    });

    expect(result.current.subscriptions[0].isActive).toBe(false);
    expect(mockPut).toHaveBeenCalledWith('/subscriptions/sub-001', { isActive: false });
  });
});

describe('useSubscriptions — restore()', () => {
  it('sets isActive to true in local state', async () => {
    const inactiveSub = makeSub({ id: 'sub-001', isActive: false });
    mockGet.mockResolvedValue([inactiveSub]);
    const restored = { ...inactiveSub, isActive: true };
    mockPut.mockResolvedValue(restored);

    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.restore('sub-001');
    });

    expect(result.current.subscriptions[0].isActive).toBe(true);
    expect(mockPut).toHaveBeenCalledWith('/subscriptions/sub-001', { isActive: true });
  });
});

// ---------------------------------------------------------------------------
// bulkDelete
// ---------------------------------------------------------------------------

describe('useSubscriptions — bulkDelete()', () => {
  it('removes all listed ids from local state', async () => {
    const sub3 = makeSub({ id: 'sub-003', name: 'Apple TV' });
    mockGet.mockResolvedValue([sub1, sub2, sub3]);
    mockPost.mockResolvedValue(undefined);

    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.bulkDelete(['sub-001', 'sub-003']);
    });

    expect(result.current.subscriptions).toHaveLength(1);
    expect(result.current.subscriptions[0].id).toBe('sub-002');
    expect(mockPost).toHaveBeenCalledWith(
      '/subscriptions/bulk-delete',
      { ids: ['sub-001', 'sub-003'] },
    );
  });
});

// ---------------------------------------------------------------------------
// refetch
// ---------------------------------------------------------------------------

describe('useSubscriptions — refetch()', () => {
  it('re-calls the API and updates the subscription list', async () => {
    mockGet.mockResolvedValueOnce([sub1]);
    const { result } = renderHook(() => useSubscriptions());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscriptions).toHaveLength(1);

    mockGet.mockResolvedValueOnce([sub1, sub2]);
    await act(async () => { result.current.refetch(); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subscriptions).toHaveLength(2);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
