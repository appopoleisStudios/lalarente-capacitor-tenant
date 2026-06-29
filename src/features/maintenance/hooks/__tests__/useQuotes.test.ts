import { renderHook, waitFor } from '@testing-library/react-native';
import { useQuotes } from '../useQuotes';
import { createQueryWrapper } from './testUtils';
import type { Quote } from '../../../api/types/quote.types';

const mockRequestId = 'req-1';

jest.mock('../../api', () => ({
  getQuotesByRequest: jest.fn(),
  subscribeToQuotes: jest.fn(() => ({ id: 'sub-1', unsubscribe: jest.fn() })),
  unsubscribeFromQuotes: jest.fn(),
}));

const mockedApi = jest.requireMock('../../api') as Record<string, jest.Mock>;

function buildSampleQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'quote-1',
    request_id: mockRequestId,
    vendor_id: 'vendor-1',
    status: 'submitted' as const,
    total_amount: 1500,
    subtotal: 1304.35,
    vat_amount: 195.65,
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
    ...overrides,
  } as Quote;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedApi.getQuotesByRequest.mockResolvedValue([
    buildSampleQuote(),
    buildSampleQuote({ id: 'quote-2', total_amount: 2200, status: 'approved' }),
  ]);
});

describe('useQuotes', () => {
  it('returns all quotes for the given request on success', async () => {
    const { result } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.quotes).toHaveLength(2);
    expect(result.current.quotes[0].id).toBe('quote-1');
    expect(result.current.quotes[1].id).toBe('quote-2');
    expect(result.current.error).toBeNull();
  });

  it('returns an empty list when requestId is empty', () => {
    const { result } = renderHook(() => useQuotes(''), { wrapper: createQueryWrapper() });
    expect(result.current.quotes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(mockedApi.getQuotesByRequest).not.toHaveBeenCalled();
  });

  it('exposes the error message when the fetch fails', async () => {
    mockedApi.getQuotesByRequest.mockRejectedValue(new Error('Unable to load quotes'));

    const { result } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.error).toBe('Unable to load quotes'));
  });

  it('uses the fallback message when err is not an Error instance', async () => {
    mockedApi.getQuotesByRequest.mockRejectedValue('string rejection');

    const { result } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch quotes'));
  });

  it('subscribes to real-time quote changes and cleans up on unmount', async () => {
    const { unmount } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(mockedApi.getQuotesByRequest).toHaveBeenCalled());

    expect(mockedApi.subscribeToQuotes).toHaveBeenCalledWith(mockRequestId, expect.any(Function));

    unmount();
    expect(mockedApi.unsubscribeFromQuotes).toHaveBeenCalledWith({ id: 'sub-1', unsubscribe: expect.any(Function) });
  });

  it('supports manual refetch via returned function', async () => {
    const { result } = renderHook(() => useQuotes(mockRequestId), { wrapper: createQueryWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedApi.getQuotesByRequest.mockClear();
    result.current.refetch();

    await waitFor(() => expect(mockedApi.getQuotesByRequest).toHaveBeenCalled());
  });
});
