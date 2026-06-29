import { useAuth } from '@/src/contexts/AuthContext';
import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/src/core/query/queryKeys';
import { extractErrorMessage } from '@/src/core/query/queryErrors';
import {
    filterByPriority as filterRequestsByPriority,
    filterByStatus as filterRequestsByStatus,
    getMaintenanceRequests,
    subscribeToMaintenanceRequests,
    unsubscribeFromMaintenanceRequests,
} from '../api';
import type { MaintenanceRequestWithRelations, MaintenanceStatus, Priority } from '../api/types/maintenance.types';

export function useMaintenanceRequests() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const userId = user?.id;
  const role = profile?.role === 'admin' ? 'owner' : profile?.role;
  const queryKey = queryKeys.maintenance.requests(userId, role);

  const { data: requests = [], isLoading, isError, error, isRefetching, refetch } = useQuery<
    MaintenanceRequestWithRelations[]
  >({
    queryKey,
    queryFn: async () => {
      if (!userId || !role) return [];
      return await getMaintenanceRequests(userId, role);
    },
    enabled: !!userId && !!role,
    // Keep showing previous data while refetching — avoids flicker on pull-to-refresh
    placeholderData: (previousData) => previousData,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Listen for real-time DB changes and re-fetch when data mutates
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

  const filterByStatus = useCallback(
    async (statuses: MaintenanceStatus[]) => {
      if (!userId) return;
      try {
        const data = await filterRequestsByStatus(userId, statuses);
        queryClient.setQueryData(queryKey, data);
      } catch (err) {
        console.error('Error filtering by status:', err);
        // Re-throw so callers can surface feedback (toast, snackbar, etc.)
        // rather than silently showing stale cached data.
        throw err;
      }
    },
    [userId, queryClient, queryKey]
  );

  const filterByPriority = useCallback(
    async (priorities: Priority[]) => {
      if (!userId) return;
      try {
        const data = await filterRequestsByPriority(userId, priorities);
        queryClient.setQueryData(queryKey, data);
      } catch (err) {
        console.error('Error filtering by priority:', err);
        // Re-throw so callers can surface feedback (toast, snackbar, etc.)
        // rather than silently showing stale cached data.
        throw err;
      }
    },
    [userId, queryClient, queryKey]
  );

  return {
    requests,
    loading: isLoading,
    error: isError ? extractErrorMessage(error, 'Failed to fetch maintenance requests') : null,
    refreshing: isRefetching,
    onRefresh,
    refetch,
    filterByStatus,
    filterByPriority,
  };
}
