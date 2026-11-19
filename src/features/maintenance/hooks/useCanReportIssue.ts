import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import {
  LEASE_IN_EFFECT_STATUSES,
  canReportIssue,
} from '@/src/features/leases/utils/leaseInEffect';

/**
 * Whether the signed-in tenant has a lease in effect, i.e. may report an
 * issue to their owner. `true`/`false` only after a successful check; `null`
 * while checking or when the check failed. Entry points show only on `true`
 * and the needs-lease note only on `false`, so a network error shows neither.
 */
export function useCanReportIssue(enabled = true) {
  const { user } = useAuth();
  const [canReport, setCanReport] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !user?.id) {
      setCanReport(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('leases')
        .select('id, status')
        .eq('tenant_id', user.id)
        .in('status', [...LEASE_IN_EFFECT_STATUSES]);
      setCanReport(error ? null : (data ?? []).some((lease) => canReportIssue(lease.status)));
    } catch {
      setCanReport(null);
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { canReport, refresh };
}
