import { renderHook, waitFor } from '@testing-library/react-native';
import { useMaintenanceDetail } from '../useMaintenanceDetail';
import { createQueryWrapper } from './testUtils';

jest.mock('../../api', () => ({ getMaintenanceRequestById: jest.fn() }));
const api = jest.requireMock('../../api') as Record<string, jest.Mock>;

beforeEach(() => jest.clearAllMocks());

it('returns the request when a valid ID is provided', async () => {
  api.getMaintenanceRequestById.mockResolvedValue({ id: 'req-1', title: 'Broken window' });

  const { result } = renderHook(() => useMaintenanceDetail('req-1'), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.request?.title).toBe('Broken window');
  expect(result.current.error).toBeNull();
});

it('returns null when requestId is empty', () => {
  const { result } = renderHook(() => useMaintenanceDetail(''), { wrapper: createQueryWrapper() });
  expect(result.current.request).toBeNull();
  expect(result.current.loading).toBe(false);
});

it('passes through the server error message', async () => {
  api.getMaintenanceRequestById.mockRejectedValue(new Error('Not authorised'));

  const { result } = renderHook(() => useMaintenanceDetail('req-1'), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(result.current.error).toBe('Not authorised'));
});
