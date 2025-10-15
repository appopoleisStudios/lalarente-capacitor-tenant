import { useState, useEffect, useCallback } from 'react';
import { maintenanceApi } from '../api/maintenanceApi';
import { useAuth } from '@/src/contexts/AuthContext';

export function useMaintenanceRequests() {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch maintenance requests with role-based filtering
  const fetchRequests = useCallback(async () => {
    if (!user?.id || !profile?.role) {
      // No user logged in - set loading to false and show empty state
      setLoading(false);
      setRefreshing(false);
      setRequests([]);
      return;
    }

    try {
      setError(null);
      // Filter out admin role (not supported in maintenance)
      const role = profile.role === 'admin' ? 'owner' : profile.role;
      const data = await maintenanceApi.getMaintenanceRequests(user.id, role);
      setRequests(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch maintenance requests');
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, profile?.role]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  // Initial load + Real-time subscription
  useEffect(() => {
    if (!user?.id || !profile?.role) {
      // No user - stop loading and show empty state
      setLoading(false);
      setRequests([]);
      return;
    }

    fetchRequests();

    // Subscribe to real-time changes
    const subscription = maintenanceApi.subscribeToMaintenanceRequests(
      user.id,
      (payload: any) => {
        console.log('Real-time update:', payload);
        fetchRequests(); // Re-fetch on any change
      }
    );

    return () => {
      maintenanceApi.unsubscribe(subscription);
    };
  }, [user?.id, profile?.role, fetchRequests]);

  // Filter by status
  const filterByStatus = useCallback(
    async (statuses: Array<'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'>) => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const data = await maintenanceApi.filterByStatus(user.id, statuses);
        setRequests(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  // Filter by priority
  const filterByPriority = useCallback(
    async (priorities: Array<'low' | 'medium' | 'high'>) => {
      if (!user?.id) return;

      try {
        setLoading(true);
        const data = await maintenanceApi.filterByPriority(user.id, priorities);
        setRequests(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [user?.id]
  );

  return {
    requests,
    loading,
    error,
    refreshing,
    onRefresh,
    refetch: fetchRequests,
    filterByStatus,
    filterByPriority,
  };
}
