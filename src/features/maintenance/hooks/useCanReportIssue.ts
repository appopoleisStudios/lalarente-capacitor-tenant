import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import {
  LEASE_IN_EFFECT_STATUSES,
  canReportIssue,
} from '@/src/features/leases/utils/leaseInEffect';

/**
 * Whether the signed-in tenant has a lease in effect, i.e. may report an
 * issue to their owner. `null` while the first check runs; entry points show
 * only on `true`, so they never flash on for an unsigned lease.
 */
export function useCanReportIssue(enabled = true) {
  const { user } = useAuth();
  const [canReport, setCanReport] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || !user?.id) {
      setCanReport(false);
      return;
    }
    const { data, error } = await supabase
      .from('leases')
      .select('id, status')
      .eq('tenant_id', user.id)
      .in('status', [...LEASE_IN_EFFECT_STATUSES]);
    setCanReport(!error && (data ?? []).some((lease) => canReportIssue(lease.status)));
  }, [enabled, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { canReport, refresh };
}
