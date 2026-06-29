import { renderHook, waitFor } from '@testing-library/react-native';
import { useMaintenanceRequests } from '../useMaintenanceRequests';
import { createQueryWrapper } from './testUtils';

const mockUseAuth = jest.fn(() => ({ user: { id: 'user-1' }, profile: { role: 'owner' } }));

jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: mockUseAuth }));

jest.mock('../../api', () => ({
  getMaintenanceRequests: jest.fn(),
  subscribeToMaintenanceRequests: jest.fn(() => ({ id: 's1', unsubscribe: jest.fn() })),
  unsubscribeFromMaintenanceRequests: jest.fn(),
  filterByStatus: jest.fn(),
  filterByPriority: jest.fn(),
}));

const api = jest.requireMock('../../api') as Record<string, jest.Mock>;

beforeEach(() => { jest.clearAllMocks(); });


it('resolves with requests when the fetch succeeds', async () => {
  api.getMaintenanceRequests.mockResolvedValue([{ id: 'r1', title: 'Leak' }]);

  const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.requests).toHaveLength(1);
  expect(result.current.error).toBeNull();
});

it('exposes a human-readable error when the fetch fails', async () => {
  api.getMaintenanceRequests.mockRejectedValue(new Error('Connection lost'));

  const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(result.current.error).toBe('Connection lost'));
});

it('remaps admin role to owner for query key generation', async () => {
  mockUseAuth.mockReturnValueOnce({ user: { id: 'admin-1' }, profile: { role: 'admin' } });

  renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(api.getMaintenanceRequests).toHaveBeenCalledWith('admin-1', 'owner'));
});

it('sets up real-time subscription on mount and unsubscribes on unmount', () => {
  const { unmount } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });

  expect(api.subscribeToMaintenanceRequests).toHaveBeenCalledTimes(1);
  expect(api.subscribeToMaintenanceRequests).toHaveBeenCalledWith('user-1', expect.any(Function));

  unmount();

  expect(api.unsubscribeFromMaintenanceRequests).toHaveBeenCalledTimes(1);
});

it('exposes filterByStatus and filterByPriority callbacks', () => {
  const { result } = renderHook(() => useMaintenanceRequests(), { wrapper: createQueryWrapper() });

  expect(typeof result.current.filterByStatus).toBe('function');
  expect(typeof result.current.filterByPriority).toBe('function');
  expect(typeof result.current.refetch).toBe('function');
  expect(typeof result.current.onRefresh).toBe('function');
});
