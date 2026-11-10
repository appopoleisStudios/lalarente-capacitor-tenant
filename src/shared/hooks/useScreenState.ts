import { useState, useCallback, useRef } from 'react';

export interface ScreenState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useScreenState<T>(loadFn: () => Promise<T>): ScreenState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Generation counter: only the latest inflight request may commit state.
  const latestGen = useRef(0);

  const refetch = useCallback(async () => {
    const gen = ++latestGen.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await loadFn();
      if (gen !== latestGen.current) return;
      setData(result);
    } catch (err) {
      if (gen !== latestGen.current) return;
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      if (gen === latestGen.current) setIsLoading(false);
    }
  }, [loadFn]);

  return { data, isLoading, error, refetch };
}
