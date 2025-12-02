/**
 * Quote Subscriptions API
 * Real-time subscriptions for quotes
 */

import { supabase } from '@/src/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Quote } from '../types/quote.types';

/**
 * Subscribe to quote changes for a maintenance request
 * 
 * @param requestId - The maintenance request ID
 * @param callback - Callback function to handle quote updates
 * @returns Supabase realtime channel subscription
 * 
 * @example
 * ```typescript
 * const subscription = subscribeToQuotes(requestId, (quote) => {
 *   console.log('Quote updated:', quote);
 * });
 * 
 * // Later, unsubscribe
 * unsubscribe(subscription);
 * ```
 */
export function subscribeToQuotes(
  requestId: string,
  callback: (quote: Quote) => void
): RealtimeChannel {
  const subscription = supabase
    .channel(`quotes:${requestId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'quotes',
        filter: `request_id=eq.${requestId}`,
      },
      async (payload) => {
        // Fetch the complete quote with relations
        const newRecord = payload.new as { id: string };
        const { data } = await supabase
          .from('quotes')
          .select(`
            *,
            vendor:profiles!vendor_id(
              id,
              full_name,
              phone,
              email,
              avatar_url
            )
          `)
          .eq('id', newRecord.id)
          .single();

        if (data) {
          callback(data as Quote);
        }
      }
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
