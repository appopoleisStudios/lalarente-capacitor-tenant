import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/core/query/queryKeys';
import { getQuotesByRequest, subscribeToQuotes, unsubscribeFromQuotes } from '../api';
import type { Quote } from '../types/quote.types';

export function useQuotes(requestId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.maintenance.quotes(requestId);

  const query = useQuery<Quote[]>({
    queryKey,
    queryFn: () => getQuotesByRequest(requestId),
    enabled: !!requestId,
  });

  // Re-fetch when a new quote is submitted or status changes
  useEffect(() => {
    if (!requestId) return;

    const subscription = subscribeToQuotes(requestId, () => {
      queryClient.invalidateQueries({ queryKey });
    });

    return () => {
      unsubscribeFromQuotes(subscription);
    };
  }, [requestId, queryClient, queryKey]);

  return {
    quotes: query.data ?? [],
    loading: query.isLoading,
    error: query.isError ? (query.error as Error)?.message || 'Failed to fetch quotes' : null,
    refetch: query.refetch,
  };
}
