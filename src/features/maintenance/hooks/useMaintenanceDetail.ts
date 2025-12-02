import { useEffect, useState } from 'react';
import { getMaintenanceRequestById } from '../api';

export function useMaintenanceDetail(requestId: string) {
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!requestId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getMaintenanceRequestById(requestId);
        setRequest(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch request details');
        console.error('Error fetching detail:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [requestId]);

  return { request, loading, error };
}
