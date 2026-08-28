import { supabase } from '@/src/lib/supabase';

/**
 * Atomically joins an assigned vendor to the maintenance thread and sends
 * their first message. The RPC validates auth, assignment, job/invoice state,
 * and returns only the authorized thread id.
 */
export async function bootstrapVendorMaintenanceThread(
  requestId: string,
  initialMessage: string
): Promise<string> {
  const { data, error } = await (supabase as any).rpc('bootstrap_vendor_maintenance_thread', {
    p_request_id: requestId,
    p_initial_message: initialMessage,
  });

  if (error) {
    console.error('Error bootstrapping vendor maintenance thread:', error);
    throw new Error(`Failed to open maintenance chat: ${error.message}`);
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Failed to open maintenance chat: no thread returned');
  }

  return data;
}
