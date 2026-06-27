import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/core/query/queryKeys';
import { getQuotesByRequest, subscribeToQuotes, unsubscribeFromQuotes } from '../api';

export function useQuotes(requestId: string) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.maintenance.quotes(requestId);

  const { data: quotes = [], isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getQuotesByRequest(requestId),
    enabled: !!requestId,
  });

  // Real-time subscription — invalidates query on changes
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
    quotes,
    loading: isLoading,
    error: isError ? (error as any)?.message || 'Failed to fetch quotes' : null,
    refetch,
  };
}
