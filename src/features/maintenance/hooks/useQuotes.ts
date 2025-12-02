import { useCallback, useEffect, useState } from 'react';
import { getQuotesByRequest, subscribeToQuotes, unsubscribeFromQuotes } from '../api';

export function useQuotes(requestId: string) {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (!requestId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getQuotesByRequest(requestId);
      setQuotes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch quotes');
      console.error('Error fetching quotes:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;

    fetchQuotes();

    // Subscribe to real-time quote updates
    const subscription = subscribeToQuotes(requestId, (payload: any) => {
      console.log('Quote updated:', payload);
      fetchQuotes();
    });

    return () => {
      unsubscribeFromQuotes(subscription);
    };
  }, [requestId, fetchQuotes]);

  return {
    quotes,
    loading,
    error,
    refetch: fetchQuotes,
  };
}
