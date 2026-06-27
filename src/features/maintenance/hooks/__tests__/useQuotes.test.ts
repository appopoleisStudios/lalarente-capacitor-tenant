import { renderHook, waitFor } from '@testing-library/react-native';
import { useQuotes } from '../useQuotes';
import { createQueryWrapper } from './testUtils';
import type { Quote } from '../../../api/types/quote.types';

const mockRequestId = 'req-1';

const mockQuotes: Quote[] = [
  {
    id: 'quote-1',
    request_id: mockRequestId,
    vendor_id: 'vendor-1',
    status: 'submitted',
    total_amount: 1500,
    subtotal: 1304.35,
    vat_amount: 195.65,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  } as Quote,
];

const mockSubscription = { id: 'sub-1', unsubscribe: jest.fn() };

jest.mock('../../api', () => ({
  getQuotesByRequest: jest.fn(),
  subscribeToQuotes: jest.fn(() => mockSubscription),
  unsubscribeFromQuotes: jest.fn(),
}));

const mockedApi = jest.requireMock('../../api') as Record<string, jest.Mock>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getQuotesByRequest.mockResolvedValue(mockQuotes);
});

describe('useQuotes', () => {
  it('returns loading then quotes on success', async () => {
    const { result } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.quotes).toEqual(mockQuotes);
    expect(result.current.error).toBeNull();
  });

  it('returns empty array when requestId is empty', () => {
    const { result } = renderHook(() => useQuotes(''), { wrapper: createQueryWrapper() });
    expect(result.current.quotes).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('returns error on fetch failure', async () => {
    mockedApi.getQuotesByRequest.mockRejectedValue(new Error('Failed to load'));

    const { result } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to load');
  });

  it('subscribes to real-time updates and cleans up on unmount', async () => {
    const { unmount } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(mockedApi.getQuotesByRequest).toHaveBeenCalled());

    expect(mockedApi.subscribeToQuotes).toHaveBeenCalledWith(mockRequestId, expect.any(Function));
    unmount();
    expect(mockedApi.unsubscribeFromQuotes).toHaveBeenCalled();
  });
});
