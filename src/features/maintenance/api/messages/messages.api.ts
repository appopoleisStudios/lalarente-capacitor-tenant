/**
 * Messages API
 * Send and receive messages for maintenance requests
 */

import { supabase } from '@/src/lib/supabase';
import type { Message, SendMessageInput } from '../types/message.types';

/**
 * Get messages for a maintenance request
 * 
 * @param requestId - The maintenance request ID
 * @param propertyId - The property ID
 * @returns Array of messages ordered by creation time
 * 
 * @example
 * ```typescript
 * const messages = await getMessages(requestId, propertyId);
 * ```
 */
export async function getMessages(
  requestId: string,
  propertyId: string
): Promise<Message[]> {
  const topic = `maintenance_${requestId}`;
  
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, avatar_url, role),
      recipient:profiles!recipient_id(id, full_name, role)
    `)
    .eq('property_id', propertyId)
    .eq('topic', topic)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as Message[];
}

/**
 * Send a message
 * 
 * @param input - Message data
 * @returns Created message
 * 
 * @example
 * ```typescript
 * const message = await sendMessage({
 *   property_id: 'prop-123',
 *   topic: 'maintenance_req-123',
 *   sender_id: 'user-123',
 *   recipient_id: 'user-456',
 *   content: 'Hello, when can you start?',
 *   extension: 'maintenance',
 * });
 * ```
 */
export async function sendMessage(input: SendMessageInput): Promise<Message> {
  const { data, error } = await (supabase as any)
    .from('messages')
    .insert({
      property_id: input.property_id,
      topic: input.topic,
      sender_id: input.sender_id,
      recipient_id: input.recipient_id,
      content: input.content,
      message_type: input.message_type || 'text',
      attachments: input.attachments || null,
      extension: input.extension,
      private: false,
    })
    .select(`
      *,
      sender:profiles!sender_id(id, full_name, avatar_url, role),
      recipient:profiles!recipient_id(id, full_name, role)
    `)
    .single();

  if (error) throw error;
  return data as unknown as Message;
}

/**
 * Mark messages as read
 * 
 * @param requestId - The maintenance request ID
 * @param propertyId - The property ID
 * @param userId - The user ID marking messages as read
 * 
 * @example
 * ```typescript
 * await markAsRead(requestId, propertyId, userId);
 * ```
 */
export async function markAsRead(
  requestId: string,
  propertyId: string,
  userId: string
): Promise<void> {
  const topic = `maintenance_${requestId}`;
  
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('property_id', propertyId)
    .eq('topic', topic)
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

/**
 * Get unread message count for a user
 * 
 * @param userId - The user ID
 * @returns Number of unread messages
 * 
 * @example
 * ```typescript
 * const count = await getUnreadCount(userId);
 * ```
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);

  if (error) throw error;
  return count || 0;
}
