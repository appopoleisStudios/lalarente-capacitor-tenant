import { renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMaintenanceDetail } from '../useMaintenanceDetail';
import type { MaintenanceRequestWithRelations } from '../../types/maintenance.types';

// ── Mocks ──────────────────────────────────────────────────────────

const mockRequestId = 'req-1';

const mockRequest: MaintenanceRequestWithRelations = {
  id: mockRequestId,
  title: 'Leaky faucet',
  property_id: 'prop-1',
  owner_id: 'owner-1',
  tenant_id: 'tenant-1',
  status: 'open',
  priority: 'medium',
  description: 'Kitchen faucet dripping',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
} as MaintenanceRequestWithRelations;

jest.mock('../../api', () => ({
  getMaintenanceRequestById: jest.fn(),
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

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getMaintenanceRequestById.mockResolvedValue(mockRequest);
});

// ── Tests ──────────────────────────────────────────────────────────

describe('useMaintenanceDetail', () => {
  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useMaintenanceDetail(mockRequestId), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.request).toBeNull();
  });

  it('returns request data on success', async () => {
    const { result } = renderHook(() => useMaintenanceDetail(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.request).toEqual(mockRequest);
    expect(result.current.error).toBeNull();
  });

  it('returns null request when requestId is empty', () => {
    const { result } = renderHook(() => useMaintenanceDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.request).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('returns error on fetch failure', async () => {
    mockedApi.getMaintenanceRequestById.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useMaintenanceDetail(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Not found');
    expect(result.current.request).toBeNull();
  });

  it('calls API with correct requestId', async () => {
    renderHook(() => useMaintenanceDetail(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockedApi.getMaintenanceRequestById).toHaveBeenCalledWith(mockRequestId);
    });
  });
});
