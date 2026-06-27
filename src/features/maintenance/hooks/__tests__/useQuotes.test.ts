import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQuotes } from '../useQuotes';
import type { Quote } from '../../types/quote.types';

// ── Mocks ──────────────────────────────────────────────────────────

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

jest.mock('../../api', () => ({
  getQuotesByRequest: jest.fn(),
  subscribeToQuotes: jest.fn(() => ({ id: 'sub-1', unsubscribe: jest.fn() })),
  unsubscribeFromQuotes: jest.fn(),
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
  mockedApi.getQuotesByRequest.mockResolvedValue(mockQuotes);
});

// ── Tests ──────────────────────────────────────────────────────────

describe('useQuotes', () => {
  it('returns loading=true initially', () => {
    const { result } = renderHook(() => useQuotes(mockRequestId), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.quotes).toEqual([]);
  });

  it('returns quotes on successful fetch', async () => {
    const { result } = renderHook(() => useQuotes(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.quotes).toEqual(mockQuotes);
    expect(result.current.error).toBeNull();
  });

  it('returns empty array when requestId is empty', () => {
    const { result } = renderHook(() => useQuotes(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.quotes).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('returns error on fetch failure', async () => {
    mockedApi.getQuotesByRequest.mockRejectedValue(new Error('Failed to load'));

    const { result } = renderHook(() => useQuotes(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load');
  });

  it('falls back to generic error message when error has no message', async () => {
    mockedApi.getQuotesByRequest.mockRejectedValue({} as Error);

    const { result } = renderHook(() => useQuotes(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch quotes');
  });

  it('subscribes to real-time quote updates', async () => {
    renderHook(() => useQuotes(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockedApi.getQuotesByRequest).toHaveBeenCalled();
    });

    expect(mockedApi.subscribeToQuotes).toHaveBeenCalledWith(
      mockRequestId,
      expect.any(Function)
    );
  });

  it('unsubscribes on unmount', async () => {
    const subUnsubscribe = jest.fn();
    mockedApi.subscribeToQuotes.mockReturnValue({ id: 'sub-1', unsubscribe: subUnsubscribe });

    const { unmount } = renderHook(() => useQuotes(mockRequestId), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockedApi.getQuotesByRequest).toHaveBeenCalled();
    });

    unmount();

    expect(subUnsubscribe).toHaveBeenCalled();
  });
});
