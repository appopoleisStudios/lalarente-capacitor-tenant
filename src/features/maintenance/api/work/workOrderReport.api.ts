/**
 * Work Order Report API
 * Plane #68 — trigger Work Order completion report generation + email.
 *
 * Fire-and-forget wrapper around the generate-work-order-report edge function.
 * Called at every completion point (owner approves closure, tenant confirms,
 * owner closes, auto-approve cron) so the Owner and Tenant receive the PDF by
 * email. Failures are logged, never thrown — the caller's completion flow must
 * not block on the report.
 */

import { supabase } from '@/src/lib/supabase';

export async function triggerWorkOrderReport(
  maintenanceRequestId: string,
  opts: { sendEmail?: boolean } = {}
): Promise<void> {
  if (!maintenanceRequestId) return;
  try {
    const { error } = await supabase.functions.invoke('generate-work-order-report', {
      body: {
        maintenance_request_id: maintenanceRequestId,
        send_email: opts.sendEmail ?? true,
      },
    });
    if (error) {
      // Expected when the request isn't completed yet (409) or authz fails —
      // log and move on; the caller's flow already succeeded.
      console.warn('⚠️ Work order report trigger (non-fatal):', error.message);
    }
  } catch (err) {
    console.error('Failed to trigger work order report:', err);
  }
}
