import { renderHook, waitFor } from '@testing-library/react-native';
import { useQuotes } from '../useQuotes';
import { createQueryWrapper } from './testUtils';

jest.mock('../../api', () => ({
  getQuotesByRequest: jest.fn(),
  subscribeToQuotes: jest.fn(() => ({ id: 's1', unsubscribe: jest.fn() })),
  unsubscribeFromQuotes: jest.fn(),
}));

const api = jest.requireMock('../../api') as Record<string, jest.Mock>;

beforeEach(() => jest.clearAllMocks());

it('returns quotes for the given request on success', async () => {
  api.getQuotesByRequest.mockResolvedValue([
    { id: 'q1', total_amount: 1500, status: 'submitted' },
    { id: 'q2', total_amount: 2200, status: 'approved' },
  ]);

  const { result } = renderHook(() => useQuotes('req-1'), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.quotes).toHaveLength(2);
  expect(result.current.error).toBeNull();
});

it('returns empty list when requestId is empty', () => {
  const { result } = renderHook(() => useQuotes(''), { wrapper: createQueryWrapper() });
  expect(result.current.quotes).toEqual([]);
  expect(result.current.loading).toBe(false);
});

it('surfaces the error message on fetch failure', async () => {
  api.getQuotesByRequest.mockRejectedValue(new Error('Server unreachable'));

  const { result } = renderHook(() => useQuotes('req-1'), { wrapper: createQueryWrapper() });
  await waitFor(() => expect(result.current.error).toBe('Server unreachable'));
});
