import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMaintenanceRequests } from '../useMaintenanceRequests';
import type { MaintenanceRequestWithRelations } from '../../types/maintenance.types';

// ── Mocks ──────────────────────────────────────────────────────────

const mockUserId = 'user-1';
const mockRole = 'owner';

jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: mockUserId },
    profile: { role: mockRole },
  }),
}));

const mockRequests: MaintenanceRequestWithRelations[] = [
  {
    id: 'req-1',
    title: 'Leaky faucet',
    property_id: 'prop-1',
    owner_id: mockUserId,
    tenant_id: 'tenant-1',
    status: 'open',
    priority: 'medium',
    description: 'Kitchen faucet dripping',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  } as MaintenanceRequestWithRelations,
];

jest.mock('../../api', () => ({
  getMaintenanceRequests: jest.fn(),
  subscribeToMaintenanceRequests: jest.fn(() => ({ id: 'sub-1', unsubscribe: jest.fn() })),
  unsubscribeFromMaintenanceRequests: jest.fn(),
  filterByStatus: jest.fn(),
  filterByPriority: jest.fn(),
}));

const mockedApi = jest.requireMock('../../api') as Record<string, jest.Mock>;

// ── Helpers ────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function mockApiResolve(data: unknown) {
  mockedApi.getMaintenanceRequests.mockResolvedValue(data);
}

function mockApiReject(error: Error) {
  mockedApi.getMaintenanceRequests.mockRejectedValue(error);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockApiResolve(mockRequests);
});

// ── Tests ──────────────────────────────────────────────────────────

describe('useMaintenanceRequests', () => {
  it('returns loading=true while query is in flight', async () => {
    let resolvePromise!: (v: unknown) => void;
    mockedApi.getMaintenanceRequests.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    expect(result.current.loading).toBe(true);
    expect(result.current.requests).toEqual([]);

    await act(async () => {
      resolvePromise(mockRequests);
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('returns requests on successful fetch', async () => {
    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.requests).toEqual(mockRequests);
    expect(result.current.error).toBeNull();
  });

  it('returns error on fetch failure', async () => {
    mockApiReject(new Error('Network error'));

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.requests).toEqual([]);
  });

  it('falls back to generic error message when error has no message', async () => {
    mockApiReject({} as Error);

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch maintenance requests');
  });

  it('refetches when onRefresh is called', async () => {
    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let refetchResolve!: (v: unknown) => void;
    mockedApi.getMaintenanceRequests.mockReturnValue(new Promise((resolve) => { refetchResolve = resolve; }));

    await act(async () => {
      result.current.onRefresh();
    });

    expect(mockedApi.getMaintenanceRequests).toHaveBeenCalledTimes(2);

    await act(async () => {
      refetchResolve(mockRequests);
    });
  });

  it('calls API with correct userId and role', async () => {
    renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedApi.getMaintenanceRequests).toHaveBeenCalledWith(mockUserId, mockRole);
    });
  });

  it('subscribes to real-time updates', async () => {
    renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedApi.getMaintenanceRequests).toHaveBeenCalled();
    });

    expect(mockedApi.subscribeToMaintenanceRequests).toHaveBeenCalledWith(
      mockUserId,
      expect.any(Function)
    );
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useMaintenanceRequests(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockedApi.getMaintenanceRequests).toHaveBeenCalled();
    });

    unmount();

    expect(mockedApi.unsubscribeFromMaintenanceRequests).toHaveBeenCalled();
  });
});
