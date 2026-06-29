import { renderHook, waitFor } from '@testing-library/react-native';
import { useMaintenanceDetail } from '../useMaintenanceDetail';
import { createQueryWrapper } from './testUtils';
import type { MaintenanceRequestWithRelations } from '../../../api/types/maintenance.types';

const mockRequestId = 'req-1';

jest.mock('../../api', () => ({
  getMaintenanceRequestById: jest.fn(),
}));

const mockedApi = jest.requireMock('../../api') as Record<string, jest.Mock>;

/**
 * Stand-in for the full relation shape the API returns.
 * Only the fields used by the consumer are populated — the type is a
 * partial for test readability.
 */
function buildMockRequest(overrides: Partial<MaintenanceRequestWithRelations> = {}): MaintenanceRequestWithRelations {
  return {
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
    ...overrides,
  } as MaintenanceRequestWithRelations;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getMaintenanceRequestById.mockResolvedValue(buildMockRequest());
});

describe('useMaintenanceDetail', () => {
  it('resolves with the full request object when the ID is valid', async () => {
    const { result } = renderHook(() => useMaintenanceDetail(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.request?.id).toBe('req-1');
    expect(result.current.request?.title).toBe('Leaky faucet');
    expect(result.current.error).toBeNull();
  });

  it('returns null when no requestId is supplied', () => {
    const { result } = renderHook(() => useMaintenanceDetail(''), { wrapper: createQueryWrapper() });
    expect(result.current.request).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockedApi.getMaintenanceRequestById).not.toHaveBeenCalled();
  });

  it('passes the error message through when the fetch is rejected', async () => {
    mockedApi.getMaintenanceRequestById.mockRejectedValue(new Error('Request not found'));

    const { result } = renderHook(() => useMaintenanceDetail(mockRequestId), { wrapper: createQueryWrapper() });

    await waitFor(() => expect(result.current.error).toBe('Request not found'));
  });

  it('queries with the exact requestId passed to the hook', async () => {
    renderHook(() => useMaintenanceDetail('req-99'), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(mockedApi.getMaintenanceRequestById).toHaveBeenCalledWith('req-99'));
  });

  it('stays in loading state until the promise resolves', async () => {
    let deferredResolve!: (v: MaintenanceRequestWithRelations) => void;
    const deferred = new Promise<MaintenanceRequestWithRelations>((r) => { deferredResolve = r; });
    mockedApi.getMaintenanceRequestById.mockReturnValue(deferred);

    const { result } = renderHook(() => useMaintenanceDetail(mockRequestId), { wrapper: createQueryWrapper() });
    expect(result.current.loading).toBe(true);

    deferredResolve(buildMockRequest());
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});
