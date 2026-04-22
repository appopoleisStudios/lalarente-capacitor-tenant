import { supabase } from '@/src/lib/supabase';

export interface Message {
  id: string;
  property_id: string;
  topic: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: 'text' | 'image' | 'file';
  attachments?: string[];
  read_at?: string;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    avatar_url?: string;
    role: string;
  };
  recipient?: {
    id: string;
    full_name: string;
    role: string;
  };
}

export interface SendMessageInput {
  property_id: string;
  topic: string; // Format: 'maintenance_REQUEST_ID'
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type?: 'text' | 'image' | 'file';
  attachments?: string[];
  extension: string; // Required field
}

export const messagesApi = {
  // Get messages for a maintenance request
  async getMessages(requestId: string, propertyId: string) {
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
    return data as unknown as Message[];
  },

  // Send a message
  async sendMessage(input: SendMessageInput) {
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
  },

  // Mark messages as read
  async markAsRead(requestId: string, propertyId: string, userId: string) {
    const topic = `maintenance_${requestId}`;
    
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('property_id', propertyId)
      .eq('topic', topic)
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) throw error;
  },

  // Get unread count
  async getUnreadCount(userId: string) {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .is('read_at', null);

    if (error) throw error;
    return count || 0;
  },

  // Subscribe to new messages
  subscribeToMessages(
    requestId: string,
    propertyId: string,
    callback: (message: Message) => void
  ) {
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
  },

  // Unsubscribe
  unsubscribe(subscription: any) {
    subscription.unsubscribe();
  },
};
