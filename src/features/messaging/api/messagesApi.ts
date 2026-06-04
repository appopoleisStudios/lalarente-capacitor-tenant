import { supabase } from '../../../lib/supabase';
import type {
  MessageThread,
  Message,
  ThreadWithRelations,
  MessageWithSender,
  CreateThreadInput,
  SendMessageInput,
  ThreadFilter,
  ThreadSummary,
} from '../types';

export const messagesApi = {
  /**
   * Create a new message thread
   */
  async createThread(input: CreateThreadInput): Promise<MessageThread> {
    // Create the thread
    const { data: thread, error: threadError } = await supabase
      .from('message_threads')
      .insert({
        owner_id: input.owner_id,
        tenant_id: input.tenant_id,
        property_id: input.property_id || null,
        lease_id: input.lease_id || null,
        subject: input.subject,
        category: input.category,
        status: 'active',
        last_message_at: new Date().toISOString(),
        unread_count_owner: input.sender_role === 'tenant' ? 1 : 0,
        unread_count_tenant: input.sender_role === 'owner' ? 1 : 0,
      })
      .select()
      .single();

    if (threadError) {
      console.error('Error creating thread:', threadError);
      throw new Error(`Failed to create thread: ${threadError.message}`);
    }

    // Send the initial message
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        thread_id: thread.id,
        content: input.initial_message,
        sender_id: input.sender_role === 'owner' ? input.owner_id : input.tenant_id,
        sender_role: input.sender_role,
      });

    if (messageError) {
      console.error('Error sending initial message:', messageError);
      // Don't throw - thread was created successfully
    }

    return thread;
  },

  /**
   * Get thread by ID with relations
   */
  async getThread(id: string): Promise<ThreadWithRelations> {
    const { data, error } = await supabase
      .from('message_threads')
      .select(`
        *,
        property:properties!property_id(id, title, address),
        lease:leases!lease_id(id, start_date, end_date),
        owner:profiles!owner_id(id, full_name, avatar_url),
        tenant:profiles!tenant_id(id, full_name, avatar_url)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching thread:', error);
      throw new Error(`Failed to fetch thread: ${error.message}`);
    }

    return data as ThreadWithRelations;
  },

  /**
   * Get threads for a user (owner or tenant)
   */
  async getUserThreads(
    userId: string,
    role: 'owner' | 'tenant',
    filter?: ThreadFilter
  ): Promise<ThreadWithRelations[]> {
    let query = supabase
      .from('message_threads')
      .select(`
        *,
        property:properties!property_id(id, title, address),
        owner:profiles!owner_id(id, full_name, avatar_url),
        tenant:profiles!tenant_id(id, full_name, avatar_url)
      `)
      .eq(role === 'owner' ? 'owner_id' : 'tenant_id', userId);

    // Apply filters
    if (filter?.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }

    if (filter?.category && filter.category !== 'all') {
      query = query.eq('category', filter.category);
    }

    if (filter?.unreadOnly) {
      const unreadField = role === 'owner' ? 'unread_count_owner' : 'unread_count_tenant';
      query = query.gt(unreadField, 0);
    }

    const { data, error } = await query.order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching threads:', error);
      throw new Error(`Failed to fetch threads: ${error.message}`);
    }

    return data as ThreadWithRelations[];
  },

  /**
   * Get thread summaries for list display
   */
  async getThreadSummaries(
    userId: string,
    role: 'owner' | 'tenant'
  ): Promise<ThreadSummary[]> {
    const threads = await this.getUserThreads(userId, role);

    return threads.map(thread => {
      const isOwner = role === 'owner';
      const otherParty = isOwner ? thread.tenant : thread.owner;

      return {
        id: thread.id,
        subject: thread.subject,
        category: thread.category as any,
        status: thread.status as any,
        lastMessage: null, // Would need to fetch last message
        lastMessageAt: thread.last_message_at,
        unreadCount: isOwner
          ? thread.unread_count_owner || 0
          : thread.unread_count_tenant || 0,
        otherPartyName: otherParty?.full_name || 'Unknown',
        otherPartyAvatar: otherParty?.avatar_url || null,
        propertyTitle: thread.property?.title,
      };
    });
  },

  /**
   * Get messages for a thread
   */
  async getThreadMessages(threadId: string): Promise<MessageWithSender[]> {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(id, full_name, avatar_url)
      `)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return data as MessageWithSender[];
  },

  /**
   * Send a message
   */
  async sendMessage(input: SendMessageInput): Promise<Message> {
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        thread_id: input.thread_id,
        content: input.content,
        sender_id: input.sender_id,
        sender_role: input.sender_role,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error sending message:', messageError);
      throw new Error(`Failed to send message: ${messageError.message}`);
    }

    // Update thread last_message_at and unread counts
    const thread = await this.getThread(input.thread_id);
    const updateData: any = {
      last_message_at: new Date().toISOString(),
    };

    // Increment unread count for the other party
    if (input.sender_role === 'owner') {
      updateData.unread_count_tenant = (thread.unread_count_tenant || 0) + 1;
    } else {
      updateData.unread_count_owner = (thread.unread_count_owner || 0) + 1;
    }

    await supabase
      .from('message_threads')
      .update(updateData)
      .eq('id', input.thread_id);

    return message;
  },

  /**
   * Mark messages as read
   */
  async markAsRead(threadId: string, userId: string, role: 'owner' | 'tenant'): Promise<void> {
    // Mark all messages in thread as read
    const { error: messagesError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('thread_id', threadId)
      .neq('sender_id', userId)
      .is('read_at', null);

    if (messagesError) {
      console.error('Error marking messages as read:', messagesError);
    }

    // Reset unread count for this user
    const updateField = role === 'owner' ? 'unread_count_owner' : 'unread_count_tenant';
    const { error: threadError } = await supabase
      .from('message_threads')
      .update({ [updateField]: 0 })
      .eq('id', threadId);

    if (threadError) {
      console.error('Error resetting unread count:', threadError);
    }
  },

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string, role: 'owner' | 'tenant'): Promise<number> {
    const unreadField = role === 'owner' ? 'unread_count_owner' : 'unread_count_tenant';

    const { data, error } = await supabase
      .from('message_threads')
      .select(unreadField)
      .eq(role === 'owner' ? 'owner_id' : 'tenant_id', userId);

    if (error) {
      console.error('Error fetching unread count:', error);
      return 0;
    }

    return data.reduce((sum, thread) => sum + ((thread as any)[unreadField] || 0), 0);
  },

  /**
   * Close a thread
   */
  async closeThread(threadId: string): Promise<MessageThread> {
    const { data, error } = await supabase
      .from('message_threads')
      .update({ status: 'archived' })
      .eq('id', threadId)
      .select()
      .single();

    if (error) {
      console.error('Error closing thread:', error);
      throw new Error(`Failed to close thread: ${error.message}`);
    }

    return data;
  },

  /**
   * Archive a thread
   */
  async archiveThread(threadId: string): Promise<MessageThread> {
    const { data, error } = await supabase
      .from('message_threads')
      .update({ status: 'archived' })
      .eq('id', threadId)
      .select()
      .single();

    if (error) {
      console.error('Error archiving thread:', error);
      throw new Error(`Failed to archive thread: ${error.message}`);
    }

    return data;
  },

  /**
   * Reopen a closed thread
   */
  async reopenThread(threadId: string): Promise<MessageThread> {
    const { data, error } = await supabase
      .from('message_threads')
      .update({ status: 'active' })
      .eq('id', threadId)
      .select()
      .single();

    if (error) {
      console.error('Error reopening thread:', error);
      throw new Error(`Failed to reopen thread: ${error.message}`);
    }

    return data;
  },

  /**
   * Subscribe to new messages in a thread
   */
  subscribeToThread(
    threadId: string,
    onMessage: (message: Message) => void
  ): () => void {
    const subscription = supabase
      .channel(`thread:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        payload => {
          onMessage(payload.new as Message);
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      subscription.unsubscribe();
    };
  },

  /**
   * Subscribe to thread updates for a user
   */
  subscribeToUserThreads(
    userId: string,
    role: 'owner' | 'tenant',
    onUpdate: (thread: MessageThread) => void
  ): () => void {
    const filterField = role === 'owner' ? 'owner_id' : 'tenant_id';

    const subscription = supabase
      .channel(`user-threads:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_threads',
          filter: `${filterField}=eq.${userId}`,
        },
        payload => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            onUpdate(payload.new as MessageThread);
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  /**
   * Get or create thread between owner and tenant
   */
  async getOrCreateThread(
    ownerId: string,
    tenantId: string,
    propertyId?: string,
    subject?: string,
    category: string = 'general'
  ): Promise<MessageThread> {
    // Try to find existing open thread
    let query = supabase
      .from('message_threads')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('tenant_id', tenantId)
      .eq('status', 'active');

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    if (category) {
      query = query.eq('category', category);
    }

    const { data: existingThreads } = await query
      .order('last_message_at', { ascending: false })
      .limit(1);

    if (existingThreads && existingThreads.length > 0) {
      return existingThreads[0];
    }

    // Create new thread
    const { data, error } = await supabase
      .from('message_threads')
      .insert({
        owner_id: ownerId,
        tenant_id: tenantId,
        property_id: propertyId || null,
        subject: subject || 'New Conversation',
        category,
        status: 'active',
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create thread: ${error.message}`);
    }

    return data;
  },
};
