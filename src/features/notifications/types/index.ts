import type { Database } from '../../../types/database.types';

// Notification types
export type NotificationType =
  | 'lease_created'
  | 'lease_signed'
  | 'lease_expiring'
  | 'lease_expired'
  | 'payment_due'
  | 'payment_received'
  | 'payment_overdue'
  | 'payment_failed'
  | 'maintenance_created'
  | 'maintenance_updated'
  | 'maintenance_completed'
  | 'inspection_scheduled'
  | 'inspection_completed'
  | 'message_received'
  | 'document_uploaded'
  | 'document_expiring'
  | 'application_received'
  | 'application_approved'
  | 'application_rejected'
  | 'viewing_requested'
  | 'viewing_approved'
  | 'viewing_declined'
  | 'viewing_cancelled'
  | 'viewing_completed'
  | 'viewing_scheduled'
  | 'viewing_reminder'
  | 'welcome'
  | 'password_reset'
  | 'account_verified';

// Notification channel
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';

// Notification priority
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Notification status
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

// Base notification interface
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  read_at?: string | null;
  sent_at?: string | null;
  created_at: string;
  updated_at?: string;
}

// Send notification input
export interface SendNotificationInput {
  user_id: string;
  type: NotificationType;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  data?: Record<string, any>;
}

// Email template data
export interface EmailTemplateData {
  recipientName: string;
  recipientEmail: string;
  [key: string]: any;
}

// SMS template data
export interface SmsTemplateData {
  recipientPhone: string;
  recipientName?: string;
  [key: string]: any;
}

// Push notification data
export interface PushNotificationData {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

// Email template
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// SMS template
export interface SmsTemplate {
  message: string;
}

// Notification preferences
export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
  preferences: {
    [key in NotificationType]?: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };
}

// Default notification preferences
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences['preferences'] = {
  lease_created: { email: true, sms: true, push: true },
  lease_signed: { email: true, sms: true, push: true },
  lease_expiring: { email: true, sms: true, push: true },
  lease_expired: { email: true, sms: false, push: true },
  payment_due: { email: true, sms: true, push: true },
  payment_received: { email: true, sms: false, push: true },
  payment_overdue: { email: true, sms: true, push: true },
  payment_failed: { email: true, sms: true, push: true },
  maintenance_created: { email: true, sms: false, push: true },
  maintenance_updated: { email: false, sms: false, push: true },
  maintenance_completed: { email: true, sms: false, push: true },
  inspection_scheduled: { email: true, sms: true, push: true },
  inspection_completed: { email: true, sms: false, push: true },
  message_received: { email: false, sms: false, push: true },
  document_uploaded: { email: false, sms: false, push: true },
  document_expiring: { email: true, sms: false, push: true },
  application_received: { email: true, sms: true, push: true },
  application_approved: { email: true, sms: true, push: true },
  application_rejected: { email: true, sms: false, push: true },
  viewing_requested: { email: true, sms: true, push: true },
  viewing_approved: { email: true, sms: true, push: true },
  viewing_declined: { email: true, sms: false, push: true },
  viewing_cancelled: { email: true, sms: false, push: true },
  viewing_completed: { email: true, sms: false, push: true },
  viewing_scheduled: { email: true, sms: true, push: true },
  viewing_reminder: { email: false, sms: true, push: true },
  welcome: { email: true, sms: false, push: false },
  password_reset: { email: true, sms: false, push: false },
  account_verified: { email: true, sms: false, push: true },
};

// Notification with recipient info
export interface NotificationWithRecipient extends Notification {
  recipient?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
}

// Notification filter
export interface NotificationFilter {
  type?: NotificationType;
  status?: NotificationStatus;
  channel?: NotificationChannel;
  read?: boolean;
  from_date?: string;
  to_date?: string;
}

// Notification stats
export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}
