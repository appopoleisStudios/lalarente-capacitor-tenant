import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/src/core/query/queryKeys';
import { getMaintenanceRequestById } from '../api';
import type { MaintenanceRequestWithRelations } from '../types/maintenance.types';

export function useMaintenanceDetail(requestId: string) {
  const query = useQuery<MaintenanceRequestWithRelations>({
    queryKey: queryKeys.maintenance.detail(requestId),
    queryFn: () => getMaintenanceRequestById(requestId),
    enabled: !!requestId,
  });

  return {
    request: query.data ?? null,
    loading: query.isLoading,
    error: query.isError ? (query.error instanceof Error ? query.error.message : String(query.error ?? 'Failed to fetch request details')) : null,
    refetch: query.refetch,
  };
}
