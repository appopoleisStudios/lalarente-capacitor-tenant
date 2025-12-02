/**
 * Maintenance Subscriptions API
 * Real-time subscriptions for maintenance requests
 */

import { supabase } from '@/src/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to maintenance request changes for a specific owner
 * 
 * @param ownerId - The owner's user ID
 * @param callback - Callback function to handle real-time updates
 * @returns Supabase realtime channel subscription
 * 
 * @example
 * ```typescript
 * const subscription = subscribeToMaintenanceRequests(ownerId, (payload) => {
 *   console.log('Request updated:', payload);
 * });
 * 
 * // Later, unsubscribe
 * unsubscribe(subscription);
 * ```
 */
export function subscribeToMaintenanceRequests(
  ownerId: string,
  callback: (payload: any) => void
): RealtimeChannel {
  const subscription = supabase
    .channel('maintenance_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'maintenance_requests',
        filter: `owner_id=eq.${ownerId}`,
      },
      callback
    )
    .subscribe();

  return subscription;
}

/**
 * Unsubscribe from a realtime channel
 * 
 * @param subscription - The subscription to unsubscribe from
 * 
 * @example
 * ```typescript
 * unsubscribe(subscription);
 * ```
 */
export function unsubscribe(subscription: RealtimeChannel): void {
  subscription.unsubscribe();
}
