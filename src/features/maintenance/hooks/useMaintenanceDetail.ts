import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/src/core/query/queryKeys';
import { getMaintenanceRequestById } from '../api';

export function useMaintenanceDetail(requestId: string) {
  const { data: request, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.maintenance.detail(requestId),
    queryFn: () => getMaintenanceRequestById(requestId),
    enabled: !!requestId,
  });

  return {
    request: request ?? null,
    loading: isLoading,
    error: isError ? (error as any)?.message || 'Failed to fetch request details' : null,
    refetch,
  };
}
