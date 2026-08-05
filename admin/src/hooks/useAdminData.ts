import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

interface UseAdminDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches admin data from a Supabase RPC function.
 * Handles loading, error, and refetch states uniformly.
 *
 * When `enabled` is false the RPC is not called at all (avoids firing
 * with placeholder params, e.g. a zero-UUID drill-down until a row is
 * selected). Loading starts at `enabled` so disabled callers begin idle
 * while enabled callers keep the original spinner-on-first-render
 * behavior that consumers rely on (`if (loading) return <Spinner/>`).
 */
export function useAdminData<T = unknown[]>(
  rpcName: string,
  params?: Record<string, unknown>,
  enabled = true
): UseAdminDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params ?? {});

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc(rpcName, params ?? {});
      if (rpcError) throw new Error(rpcError.message || JSON.stringify(rpcError));
      setData((result ?? []) as T);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rpcName, paramsKey, enabled]);

  useEffect(() => {
    if (!enabled) return;
    fetch();
  }, [fetch, enabled]);

  return { data, loading, error, refetch: fetch };
}
