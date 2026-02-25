/**
 * Message Subscriptions API
 * Real-time subscriptions for messages
 */

import { supabase } from '@/src/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Message } from '../types/message.types';

/**
 * Subscribe to new messages for a maintenance request
 * 
 * @param requestId - The maintenance request ID
 * @param propertyId - The property ID
 * @param callback - Callback function to handle new messages
 * @returns Supabase realtime channel subscription
 * 
 * @example
 * ```typescript
 * const subscription = subscribeToMessages(requestId, propertyId, (message) => {
 *   console.log('New message:', message);
 * });
 * 
 * // Later, unsubscribe
 * unsubscribe(subscription);
 * ```
 */
export function subscribeToMessages(
  requestId: string,
  propertyId: string,
  callback: (message: Message) => void
): RealtimeChannel {
  const topic = `maintenance_${requestId}`;
  
  const subscription = supabase
    .channel(`messages:${topic}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `topic=eq.${topic}`,
      },
      async (payload) => {
        // Fetch the complete message with relations
        const { data } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!sender_id(id, full_name, avatar_url, role),
            recipient:profiles!recipient_id(id, full_name, role)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          callback(data as unknown as Message);
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
