import { renderHook, waitFor } from '@testing-library/react-native';
import { useMaintenanceRequests } from '../useMaintenanceRequests';
import { createQueryWrapper } from './testUtils';
import type { MaintenanceRequestWithRelations } from '../../../api/types/maintenance.types';

const mockUserId = 'user-1';
const mockRole = 'owner';

const mockUseAuth = jest.fn(() => ({ user: { id: mockUserId }, profile: { role: mockRole } }));

jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

const mockSubscription = { id: 'sub-1', unsubscribe: jest.fn() };

jest.mock('../../api', () => ({
  getMaintenanceRequests: jest.fn(),
  subscribeToMaintenanceRequests: jest.fn(() => mockSubscription),
  unsubscribeFromMaintenanceRequests: jest.fn(),
  filterByStatus: jest.fn(),
  filterByPriority: jest.fn(),
}));

const mockedApi = jest.requireMock('../../api') as Record<string, jest.Mock>;

const sampleRequests: MaintenanceRequestWithRelations[] = [
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
  {
    id: 'req-2',
    title: 'Broken geyser',
    property_id: 'prop-1',
    owner_id: mockUserId,
    tenant_id: 'tenant-1',
    status: 'in_progress',
    priority: 'urgent',
    description: 'No hot water',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-03T00:00:00Z',
  } as MaintenanceRequestWithRelations,
];

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getMaintenanceRequests.mockResolvedValue(sampleRequests);
});

describe('useMaintenanceRequests', () => {
  it('exposes filtered request list after initial fetch', async () => {
    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.requests).toHaveLength(2);
    expect(result.current.requests[0].title).toBe('Leaky faucet');
    expect(result.current.error).toBeNull();
  });

  it('surfaces a human-readable error when the network is down', async () => {
    mockedApi.getMaintenanceRequests.mockRejectedValue(new Error('Network request failed'));

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network request failed');
  });

  it('uses a fallback message when the thrown error has no .message property', async () => {
    mockedApi.getMaintenanceRequests.mockRejectedValue(42);

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch maintenance requests');
  });

  it('assigns admin profiles to owner role for query purposes', async () => {
    jest.mocked(require('@/src/contexts/AuthContext').useAuth).mockReturnValueOnce({
      user: { id: 'admin-1' },
      profile: { role: 'admin' },
    });

    renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(mockedApi.getMaintenanceRequests).toHaveBeenCalled());
    expect(mockedApi.getMaintenanceRequests).toHaveBeenCalledWith('admin-1', 'owner');
  });

  it('returns empty array when user is not authenticated', async () => {
    jest.mocked(require('@/src/contexts/AuthContext').useAuth).mockReturnValueOnce({
      user: null,
      profile: null,
    });

    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    expect(result.current.requests).toEqual([]);
    expect(mockedApi.getMaintenanceRequests).not.toHaveBeenCalled();
  });

  it('triggers a refetch when onRefresh is called', async () => {
    const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedApi.getMaintenanceRequests.mockClear();
    result.current.onRefresh();

    await waitFor(() => expect(mockedApi.getMaintenanceRequests).toHaveBeenCalledTimes(1));
  });

  it('subscribes to real-time updates and unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(mockedApi.subscribeToMaintenanceRequests).toHaveBeenCalled());
    expect(mockedApi.subscribeToMaintenanceRequests).toHaveBeenCalledWith(mockUserId, expect.any(Function));

    unmount();
    expect(mockedApi.unsubscribeFromMaintenanceRequests).toHaveBeenCalledWith(mockSubscription);
  });
});
