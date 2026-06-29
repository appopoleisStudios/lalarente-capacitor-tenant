import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMaintenanceDetail } from '../useMaintenanceDetail';

jest.mock('../../api', () => ({ getMaintenanceRequestById: jest.fn() }));
const api = jest.requireMock('../../api') as Record<string, jest.Mock>;

beforeEach(() => jest.clearAllMocks());

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

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
