import { useState, useEffect, useCallback } from 'react';
import { propertiesApi } from '../api/propertiesApi';
import type { PropertyWithRelations } from '../api/propertiesApi';

interface UsePropertiesOptions {
  ownerId?: string;
  autoFetch?: boolean;
}

export function useProperties(options: UsePropertiesOptions = {}) {
  const { ownerId, autoFetch = true } = options;
  
  const [properties, setProperties] = useState<PropertyWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProperties = useCallback(async () => {
    if (!ownerId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await propertiesApi.getOwnerProperties(ownerId);
      setProperties(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch properties';
      setError(message);
      console.error('Error fetching properties:', err);
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  const refresh = useCallback(async () => {
    if (!ownerId) return;

    try {
      setRefreshing(true);
      setError(null);
      const data = await propertiesApi.getOwnerProperties(ownerId);
      setProperties(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh properties';
      setError(message);
      console.error('Error refreshing properties:', err);
    } finally {
      setRefreshing(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (autoFetch && ownerId) {
      fetchProperties();
    }
  }, [autoFetch, ownerId, fetchProperties]);

  return {
    properties,
    loading,
    error,
    refreshing,
    refresh,
    refetch: fetchProperties,
  };
}
