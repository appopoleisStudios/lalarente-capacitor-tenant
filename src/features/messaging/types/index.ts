import type { Database } from '../../../types/database.types';

// Base types from database
export type MessageThread = Database['public']['Tables']['message_threads']['Row'];
export type MessageThreadInsert = Database['public']['Tables']['message_threads']['Insert'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageInsert = Database['public']['Tables']['messages']['Insert'];

// Thread category enum
export type ThreadCategory =
  | 'general'
  | 'maintenance'
  | 'lease'
  | 'payment'
  | 'viewing'
  | 'application'
  | 'other';

// Thread status enum
export type ThreadStatus = 'open' | 'closed' | 'archived';

// Sender role enum
export type SenderRole = 'owner' | 'tenant' | 'vendor' | 'admin';

// Extended thread with relations
export interface ThreadWithRelations extends MessageThread {
  property?: {
    id: string;
    title: string;
    address: string;
  };
  lease?: {
    id: string;
    start_date: string;
    end_date: string;
  };
  owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  tenant?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  last_message?: Message;
}

// Extended message with sender info
export interface MessageWithSender extends Message {
  sender?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// Create thread input
export interface CreateThreadInput {
  owner_id: string;
  tenant_id: string;
  property_id?: string;
  lease_id?: string;
  subject: string;
  category: ThreadCategory;
  initial_message: string;
  sender_role: SenderRole;
}

// Send message input
export interface SendMessageInput {
  thread_id: string;
  content: string;
  sender_id: string;
  sender_role: SenderRole;
}

// Thread list filter
export interface ThreadFilter {
  status?: ThreadStatus | 'all';
  category?: ThreadCategory | 'all';
  unreadOnly?: boolean;
}

// Thread summary for list display
export interface ThreadSummary {
  id: string;
  subject: string;
  category: ThreadCategory;
  status: ThreadStatus;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  otherPartyName: string;
  otherPartyAvatar: string | null;
  propertyTitle?: string;
}

// Real-time subscription events
export interface MessageEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  message: Message;
  thread_id: string;
}

export interface ThreadEvent {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  thread: MessageThread;
}

// Category display info
export const CATEGORY_INFO: Record<ThreadCategory, { label: string; icon: string; color: string }> = {
  general: { label: 'General', icon: 'chatbubble', color: '#2196F3' },
  maintenance: { label: 'Maintenance', icon: 'construct', color: '#FF9800' },
  lease: { label: 'Lease', icon: 'document-text', color: '#9C27B0' },
  payment: { label: 'Payment', icon: 'cash', color: '#4CAF50' },
  viewing: { label: 'Viewing', icon: 'eye', color: '#00BCD4' },
  application: { label: 'Application', icon: 'clipboard', color: '#E91E63' },
  other: { label: 'Other', icon: 'ellipsis-horizontal', color: '#607D8B' },
};
