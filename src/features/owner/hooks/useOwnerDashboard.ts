/**
 * useOwnerDashboard Hook
 *
 * Fetches the owner dashboard, refetching whenever the screen gains focus.
 *
 * - `loading` is only true until the first data (cached or fresh) is shown;
 *   focus refetches update the dashboard in the background instead of
 *   replacing it with a spinner.
 * - The last payload is cached per owner, so a cold start paints instantly.
 * - Overlapping fetches (mount + focus + pull-to-refresh) share one request.
 *
 * @module useOwnerDashboard
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { getOwnerDashboardData, type OwnerDashboardData } from '../api/ownerDashboardApi';
import { reportApiError } from '@/src/core/observability/sentry';
import { readDashboardCache, writeDashboardCache } from '@/src/shared/utils/dashboardCache';

interface UseOwnerDashboardReturn {
  data: OwnerDashboardData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useOwnerDashboard(ownerId: string | null): UseOwnerDashboardReturn {
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const hasData = useRef(false);
  const ownerRef = useRef<string | null>(null);

  // Paint the cached dashboard while the first fetch is running. A different
  // owner signing in on the same device must never see the previous one's data.
  useEffect(() => {
    if (!ownerId) return;
    if (ownerRef.current && ownerRef.current !== ownerId) {
      hasData.current = false;
      setData(null);
      setLoading(true);
    }
    ownerRef.current = ownerId;
    readDashboardCache<OwnerDashboardData>('owner', ownerId).then((cached) => {
      if (cached && !hasData.current) {
        hasData.current = true;
        console.log('[perf] owner dashboard cache painted');
        setData(cached);
        setLoading(false);
      }
    });
  }, [ownerId]);

  const fetchDashboardData = useCallback(() => {
    if (!ownerId) {
      setLoading(false);
      return Promise.resolve();
    }
    if (inFlight.current) return inFlight.current;

    inFlight.current = (async () => {
      try {
        setError(null);
        const startedAt = Date.now();
        const dashboardData = await getOwnerDashboardData(ownerId);
        console.log(`[perf] owner dashboard data in ${Date.now() - startedAt}ms`);
        if (ownerRef.current && ownerRef.current !== ownerId) return; // signed-in owner changed
        hasData.current = true;
        setData(dashboardData);
        writeDashboardCache('owner', ownerId, dashboardData);
      } catch (err) {
        reportApiError(err, 'properties', 'select');
        console.error('[useOwnerDashboard] Error fetching dashboard data:', err);
        // Keep showing the last dashboard if we have one; only a first load
        // with nothing to show becomes an error screen.
        if (!hasData.current) {
          setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
        }
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    return inFlight.current;
  }, [ownerId]);

  // Fires on mount and every time the screen regains focus.
  useFocusEffect(
    useCallback(() => {
      if (ownerId) fetchDashboardData();
    }, [ownerId, fetchDashboardData])
  );

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}
