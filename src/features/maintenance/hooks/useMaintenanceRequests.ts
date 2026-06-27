import { useAuth } from '@/src/contexts/AuthContext';
import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/core/query/queryKeys';
import {
    filterByPriority as filterRequestsByPriority,
    filterByStatus as filterRequestsByStatus,
    getMaintenanceRequests,
    subscribeToMaintenanceRequests,
    unsubscribeFromMaintenanceRequests,
} from '../api';

export function useMaintenanceRequests() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const userId = user?.id;
  const role = profile?.role === 'admin' ? 'owner' : profile?.role;
  const queryKey = queryKeys.maintenance.requests(userId, role);

  // TanStack Query manages loading/error/data states automatically
  const { data: requests = [], isLoading, isError, error, isRefetching, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!userId || !role) return [];
      return await getMaintenanceRequests(userId, role);
    },
    enabled: !!userId && !!role,
    // Only show stale data while refetching (no flash of loading on pull-to-refresh)
    placeholderData: (previousData) => previousData,
  });

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Real-time subscription — invalidates query on changes
  useEffect(() => {
    if (!userId || !role) return;

    const subscription = subscribeToMaintenanceRequests(
      userId,
      () => {
        queryClient.invalidateQueries({ queryKey });
      }
    );

    return () => {
      unsubscribeFromMaintenanceRequests(subscription);
    };
  }, [userId, role, queryClient, queryKey]);

  // Filter by status
  const filterByStatus = useCallback(
    async (statuses: Array<'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'>) => {
      if (!userId) return;

      try {
        const data = await filterRequestsByStatus(userId, statuses);
        // Update the cache manually with filtered results
        queryClient.setQueryData(queryKey, data);
      } catch (err: any) {
        console.error('Error filtering by status:', err);
      }
    },
    [userId, queryClient, queryKey]
  );

  // Filter by priority
  const filterByPriority = useCallback(
    async (priorities: Array<'low' | 'medium' | 'high'>) => {
      if (!userId) return;

      try {
        const data = await filterRequestsByPriority(userId, priorities);
        queryClient.setQueryData(queryKey, data);
      } catch (err: any) {
        console.error('Error filtering by priority:', err);
      }
    },
    [userId, queryClient, queryKey]
  );

  return {
    requests,
    loading: isLoading,
    error: isError ? (error as any)?.message || 'Failed to fetch maintenance requests' : null,
    refreshing: isRefetching,
    onRefresh,
    refetch,
    filterByStatus,
    filterByPriority,
  };
}
