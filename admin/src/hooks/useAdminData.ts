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
 */
export function useAdminData<T = unknown[]>(
  rpcName: string,
  params?: Record<string, unknown>
): UseAdminDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: rpcError } = await supabase.rpc(rpcName, params ?? {});
      if (rpcError) throw new Error(String(rpcError));
      setData((result ?? []) as T);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fetch data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [rpcName, JSON.stringify(params)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}
