/**
 * useOwnerDashboard Hook
 *
 * Custom React hook for fetching and managing owner dashboard data.
 * Follows React best practices with proper state management, error handling,
 * and automatic refetching on screen focus.
 *
 * Enterprise patterns:
 * - Separation of concerns (data fetching logic isolated from UI)
 * - Proper error boundaries
 * - Loading states
 * - Automatic refresh on screen focus
 * - Type safety
 *
 * @module useOwnerDashboard
 */

import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { getOwnerDashboardData, type OwnerDashboardData } from '../api/ownerDashboardApi';

interface UseOwnerDashboardReturn {
  data: OwnerDashboardData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage owner dashboard data
 *
 * Features:
 * - Automatic data fetching on mount
 * - Automatic refetch when screen comes into focus
 * - Loading and error states
 * - Manual refetch capability
 * - Type-safe return values
 *
 * @param ownerId - The authenticated owner's user ID
 * @returns Dashboard data, loading state, error state, and refetch function
 *
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useOwnerDashboard(user.id);
 *
 * if (loading) return <Loader />;
 * if (error) return <ErrorView error={error} onRetry={refetch} />;
 * return <Dashboard data={data} />;
 * ```
 */
export function useOwnerDashboard(ownerId: string | null): UseOwnerDashboardReturn {
  const [data, setData] = useState<OwnerDashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch dashboard data
   * Wrapped in useCallback to prevent unnecessary re-renders
   */
  const fetchDashboardData = useCallback(async () => {
    if (!ownerId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const dashboardData = await getOwnerDashboardData(ownerId);
      setData(dashboardData);
    } catch (err) {
      console.error('[useOwnerDashboard] Error fetching dashboard data:', err);
      setError(err instanceof Error ? err : new Error('Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  // Initial data fetch on mount
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Refetch when screen comes into focus (user navigates back)
  useFocusEffect(
    useCallback(() => {
      if (ownerId) {
        console.log('[useOwnerDashboard] Screen focused - refetching data');
        fetchDashboardData();
      }

      return () => {
        console.log('[useOwnerDashboard] Screen unfocused');
      };
    }, [ownerId, fetchDashboardData])
  );

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData,
  };
}
