/**
 * Message Types
 * Type definitions for messaging operations
 */

export type MessageType = 'text' | 'image' | 'file';

export interface Message {
  id: string;
  property_id: string;
  topic: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type: MessageType;
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
  topic: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  message_type?: MessageType;
  attachments?: string[];
  extension: string;
}
