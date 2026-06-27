import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useMaintenanceRequests } from '../useMaintenanceRequests';
import { createQueryWrapper, deferredPromise } from './testUtils';
import type { MaintenanceRequestWithRelations } from '../../../api/types/maintenance.types';

const mockUserId = 'user-1';
const mockRole = 'owner';

jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: mockUserId }, profile: { role: mockRole } }),
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

const mockSubscription = { id: 'sub-1', unsubscribe: jest.fn() };

jest.mock('../../api', () => ({
  getMaintenanceRequests: jest.fn(),
  subscribeToMaintenanceRequests: jest.fn(() => mockSubscription),
  unsubscribeFromMaintenanceRequests: jest.fn(),
  filterByStatus: jest.fn(),
  filterByPriority: jest.fn(),
}));

const mockedApi = jest.requireMock('../../api') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getMaintenanceRequests.mockResolvedValue(mockRequests);
});

describe('useMaintenanceRequests', () => {
  it('shows loading then resolves with requests', async () => {
    const { promise, resolve } = deferredPromise();
    mockedApi.getMaintenanceRequests.mockReturnValue(promise);

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    expect(result.current.loading).toBe(true);

    await act(async () => { resolve(mockRequests); });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.requests).toEqual(mockRequests);
    expect(result.current.error).toBeNull();
  });

  it('returns error on fetch failure', async () => {
    mockedApi.getMaintenanceRequests.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
  });

  it('falls back to generic message when error has no message', async () => {
    mockedApi.getMaintenanceRequests.mockRejectedValue({} as Error);

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch maintenance requests');
  });

  it('refetches on onRefresh', async () => {
    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const { promise, resolve } = deferredPromise();
    mockedApi.getMaintenanceRequests.mockReturnValue(promise);

    await act(async () => { result.current.onRefresh(); });
    expect(mockedApi.getMaintenanceRequests).toHaveBeenCalledTimes(2);

    await act(async () => { resolve(mockRequests); });
  });

  it('calls API with correct userId and role', async () => {
    renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(mockedApi.getMaintenanceRequests).toHaveBeenCalledWith(mockUserId, mockRole));
  });

  it('subscribes to real-time updates and cleans up on unmount', async () => {
    const { unmount } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(mockedApi.getMaintenanceRequests).toHaveBeenCalled());

    expect(mockedApi.subscribeToMaintenanceRequests).toHaveBeenCalledWith(mockUserId, expect.any(Function));
    unmount();
    expect(mockedApi.unsubscribeFromMaintenanceRequests).toHaveBeenCalledWith(mockSubscription);
  });
});
