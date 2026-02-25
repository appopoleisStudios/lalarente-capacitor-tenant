import { supabase } from '../../../lib/supabase';
import type {
  Notification,
  NotificationWithRecipient,
  NotificationPreferences,
  NotificationType,
  NotificationChannel,
  SendNotificationInput,
  NotificationFilter,
  NotificationStats,
} from '../types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../types';

import { emailTemplates } from '../templates/emailTemplates';
import { smsTemplates, smsService, formatSAPhoneNumber, isValidSAPhoneNumber } from '../templates/smsTemplates';

// notifications table does not yet have a migration — cast via any until 033 is applied
const notifTable = () => (supabase as any).from('notifications');

export const notificationsApi = {
  /**
   * Send a notification to a user
   */
  async sendNotification(input: SendNotificationInput): Promise<Notification | null> {
    try {
      // Get user details
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('id', input.user_id)
        .single();

      if (userError || !user) {
        console.error('Error fetching user for notification:', userError);
        return null;
      }

      // Get user preferences
      const preferences = await this.getUserPreferences(input.user_id);

      // Determine which channels to use
      const channels = input.channels || this.getDefaultChannels(input.type, preferences ?? undefined);

      // Get notification content
      const content = this.getNotificationContent(input.type, input.data);

      // Create notification record
      const { data: notification, error: notifError } = await notifTable()
        .insert({
          user_id: input.user_id,
          type: input.type,
          title: content.title,
          body: content.body,
          data: input.data,
          channels,
          priority: input.priority || 'normal',
          status: 'pending',
        })
        .select()
        .single();

      if (notifError) {
        console.error('Error creating notification:', notifError);
        return null;
      }

      // Send via each channel
      const sendPromises: Promise<void>[] = [];

      if (channels.includes('email') && user.email) {
        sendPromises.push(this.sendEmail(input.type, {
          recipientName: user.full_name || 'User',
          recipientEmail: user.email,
          ...input.data,
        }));
      }

      if (channels.includes('sms') && user.phone && isValidSAPhoneNumber(user.phone)) {
        sendPromises.push(this.sendSms(input.type, {
          recipientPhone: user.phone,
          recipientName: user.full_name || undefined,
          ...input.data,
        }));
      }

      if (channels.includes('push')) {
        sendPromises.push(this.sendPushNotification(input.user_id, content.title, content.body, input.data));
      }

      // Execute all sends
      await Promise.allSettled(sendPromises);

      // Update notification status
      await notifTable()
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id);

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return null;
    }
  },

  /**
   * Get notification content based on type
   */
  getNotificationContent(type: NotificationType, data?: Record<string, any>): { title: string; body: string } {
    const templates: Record<NotificationType, { title: string; body: string }> = {
      lease_created: {
        title: 'New Lease Created',
        body: `A new lease has been created for ${data?.propertyTitle || 'your property'}.`,
      },
      lease_signed: {
        title: 'Lease Signed',
        body: `The lease for ${data?.propertyTitle || 'your property'} has been signed.`,
      },
      lease_expiring: {
        title: 'Lease Expiring Soon',
        body: `Your lease for ${data?.propertyTitle || 'your property'} expires on ${data?.expiryDate || 'soon'}.`,
      },
      lease_expired: {
        title: 'Lease Expired',
        body: `Your lease for ${data?.propertyTitle || 'your property'} has expired.`,
      },
      payment_due: {
        title: 'Payment Due',
        body: `Payment of R${data?.amount || '0'} is due on ${data?.dueDate || 'soon'}.`,
      },
      payment_received: {
        title: 'Payment Received',
        body: `Your payment of R${data?.amount || '0'} has been received. Thank you!`,
      },
      payment_overdue: {
        title: 'Payment Overdue',
        body: `Your payment of R${data?.amount || '0'} is ${data?.daysOverdue || '0'} days overdue.`,
      },
      payment_failed: {
        title: 'Payment Failed',
        body: `Your payment of R${data?.amount || '0'} could not be processed.`,
      },
      maintenance_created: {
        title: 'New Maintenance Request',
        body: `A maintenance request "${data?.title || ''}" has been submitted.`,
      },
      maintenance_updated: {
        title: 'Maintenance Update',
        body: `Maintenance request "${data?.title || ''}" has been updated to ${data?.newStatus || ''}.`,
      },
      maintenance_completed: {
        title: 'Maintenance Completed',
        body: `Maintenance request "${data?.title || ''}" has been completed.`,
      },
      inspection_scheduled: {
        title: 'Inspection Scheduled',
        body: `An inspection has been scheduled for ${data?.inspectionDate || 'soon'}.`,
      },
      inspection_completed: {
        title: 'Inspection Completed',
        body: `The inspection for ${data?.propertyTitle || 'your property'} has been completed.`,
      },
      message_received: {
        title: 'New Message',
        body: `You have a new message from ${data?.senderName || 'someone'}.`,
      },
      document_uploaded: {
        title: 'New Document',
        body: `A new document "${data?.documentTitle || ''}" has been uploaded.`,
      },
      document_expiring: {
        title: 'Document Expiring',
        body: `Document "${data?.documentTitle || ''}" will be deleted on ${data?.expiryDate || 'soon'}.`,
      },
      application_received: {
        title: 'New Application',
        body: `New application received from ${data?.applicantName || 'an applicant'}.`,
      },
      application_approved: {
        title: 'Application Approved',
        body: `Your application for ${data?.propertyTitle || ''} has been approved!`,
      },
      application_rejected: {
        title: 'Application Update',
        body: `Your application for ${data?.propertyTitle || ''} was not successful.`,
      },
      viewing_requested: {
        title: 'New Viewing Request',
        body: `${data?.tenantName || 'A tenant'} requested to view ${data?.propertyTitle || 'your property'} on ${data?.requestedDate || ''}.`,
      },
      viewing_approved: {
        title: 'Viewing Approved',
        body: `Your viewing request for ${data?.propertyTitle || ''} on ${data?.confirmedDate || data?.requestedDate || ''} has been approved!`,
      },
      viewing_declined: {
        title: 'Viewing Request Update',
        body: `Your viewing request for ${data?.propertyTitle || ''} was declined. ${data?.ownerResponse || ''}`,
      },
      viewing_cancelled: {
        title: 'Viewing Cancelled',
        body: `The viewing for ${data?.propertyTitle || ''} on ${data?.viewingDate || ''} has been cancelled.`,
      },
      viewing_completed: {
        title: 'Viewing Completed',
        body: `The viewing for ${data?.propertyTitle || ''} has been marked as completed.`,
      },
      viewing_scheduled: {
        title: 'Viewing Confirmed',
        body: `Viewing scheduled for ${data?.viewingDate || ''} at ${data?.viewingTime || ''}.`,
      },
      viewing_reminder: {
        title: 'Viewing Tomorrow',
        body: `Reminder: Property viewing tomorrow at ${data?.viewingTime || ''}.`,
      },
      welcome: {
        title: 'Welcome to LaLaRente!',
        body: 'Thank you for joining us. Start exploring properties today!',
      },
      password_reset: {
        title: 'Password Reset',
        body: 'A password reset has been requested for your account.',
      },
      account_verified: {
        title: 'Account Verified',
        body: 'Your account has been successfully verified!',
      },
    };

    return templates[type] || { title: 'Notification', body: 'You have a new notification.' };
  },

  /**
   * Get default channels based on notification type and preferences
   */
  getDefaultChannels(
    type: NotificationType,
    preferences?: NotificationPreferences
  ): NotificationChannel[] {
    const defaults = DEFAULT_NOTIFICATION_PREFERENCES[type];
    const userPrefs = preferences?.preferences?.[type];

    const channels: NotificationChannel[] = ['in_app']; // Always include in-app

    if (userPrefs) {
      if (userPrefs.email && preferences?.email_enabled) channels.push('email');
      if (userPrefs.sms && preferences?.sms_enabled) channels.push('sms');
      if (userPrefs.push && preferences?.push_enabled) channels.push('push');
    } else if (defaults) {
      if (defaults.email) channels.push('email');
      if (defaults.sms) channels.push('sms');
      if (defaults.push) channels.push('push');
    }

    return channels;
  },

  /**
   * Send email notification
   */
  async sendEmail(type: NotificationType, data: Record<string, any>): Promise<void> {
    try {
      const template = emailTemplates[type];
      if (!template) {
        console.error(`No email template found for type: ${type}`);
        return;
      }

      const emailContent = template({
        recipientName: data.recipientName,
        recipientEmail: data.recipientEmail,
        ...data,
      });

      // In production, this would use Supabase Edge Functions or a service like Resend/SendGrid
      // For now, we'll use Supabase's built-in email (if configured) or log
      console.log('Email would be sent:', {
        to: data.recipientEmail,
        subject: emailContent.subject,
      });

      // Example with Supabase Edge Function:
      // await supabase.functions.invoke('send-email', {
      //   body: {
      //     to: data.recipientEmail,
      //     subject: emailContent.subject,
      //     html: emailContent.html,
      //     text: emailContent.text,
      //   },
      // });
    } catch (error) {
      console.error('Error sending email:', error);
    }
  },

  /**
   * Send SMS notification
   */
  async sendSms(type: NotificationType, data: Record<string, any>): Promise<void> {
    try {
      const template = smsTemplates[type];
      if (!template) {
        console.error(`No SMS template found for type: ${type}`);
        return;
      }

      const smsContent = template({
        recipientPhone: data.recipientPhone,
        ...data,
      });

      // In production, this would use an SMS gateway
      console.log('SMS would be sent:', {
        to: formatSAPhoneNumber(data.recipientPhone),
        message: smsContent.message,
      });

      // Example with SMS service:
      // await smsService.send({
      //   to: data.recipientPhone,
      //   message: smsContent.message,
      // }, smsConfig);
    } catch (error) {
      console.error('Error sending SMS:', error);
    }
  },

  /**
   * Send push notification
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      // Get user's push tokens
      const { data: tokens, error } = await (supabase as any)
        .from('push_tokens')
        .select('token, platform')
        .eq('user_id', userId);

      if (error || !tokens?.length) {
        console.log('No push tokens found for user:', userId);
        return;
      }

      // In production, this would use Expo Push Notifications or Firebase
      console.log('Push notification would be sent:', {
        tokens: tokens.map((t: any) => t.token),
        title,
        body,
        data,
      });

      // Example with Expo Push:
      // for (const { token } of tokens) {
      //   await fetch('https://exp.host/--/api/v2/push/send', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({
      //       to: token,
      //       title,
      //       body,
      //       data,
      //     }),
      //   });
      // }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  },

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string,
    filter?: NotificationFilter,
    limit: number = 50,
    offset: number = 0
  ): Promise<Notification[]> {
    let query = notifTable()
      .select('*')
      .eq('user_id', userId);

    if (filter?.type) {
      query = query.eq('type', filter.type);
    }

    if (filter?.status) {
      query = query.eq('status', filter.status);
    }

    if (filter?.read !== undefined) {
      if (filter.read) {
        query = query.not('read_at', 'is', null);
      } else {
        query = query.is('read_at', null);
      }
    }

    if (filter?.from_date) {
      query = query.gte('created_at', filter.from_date);
    }

    if (filter?.to_date) {
      query = query.lte('created_at', filter.to_date);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notifications:', error);
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await notifTable()
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const { error } = await notifTable()
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
  },

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const { error } = await notifTable()
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
  },

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    const { error } = await notifTable()
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      throw new Error(`Failed to delete notification: ${error.message}`);
    }
  },

  /**
   * Delete all read notifications
   */
  async deleteReadNotifications(userId: string): Promise<void> {
    const { error } = await notifTable()
      .delete()
      .eq('user_id', userId)
      .not('read_at', 'is', null);

    if (error) {
      console.error('Error deleting read notifications:', error);
      throw new Error(`Failed to delete read notifications: ${error.message}`);
    }
  },

  /**
   * Get notification statistics
   */
  async getNotificationStats(userId: string): Promise<NotificationStats> {
    const notifications = await this.getUserNotifications(userId, undefined, 1000, 0);

    const stats: NotificationStats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read_at).length,
      byType: {},
      byStatus: {},
    };

    notifications.forEach(n => {
      stats.byType[n.type] = (stats.byType[n.type] || 0) + 1;
      stats.byStatus[n.status] = (stats.byStatus[n.status] || 0) + 1;
    });

    return stats;
  },

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching notification preferences:', error);
      return null;
    }

    return data as unknown as NotificationPreferences | null;
  },

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      throw new Error(`Failed to update notification preferences: ${error.message}`);
    }

    return data as unknown as NotificationPreferences;
  },

  /**
   * Register push token
   * TODO: Uncomment when push_tokens table is created
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android' | 'web'
  ): Promise<void> {
    console.log('Push token registration not implemented - push_tokens table needs to be created');
    // const { error } = await supabase
    //   .from('push_tokens')
    //   .upsert({
    //     user_id: userId,
    //     token,
    //     platform,
    //     updated_at: new Date().toISOString(),
    //   });

    // if (error) {
    //   console.error('Error registering push token:', error);
    //   throw new Error(`Failed to register push token: ${error.message}`);
    // }
  },

  /**
   * Remove push token
   * TODO: Uncomment when push_tokens table is created
   */
  async removePushToken(token: string): Promise<void> {
    console.log('Push token removal not implemented - push_tokens table needs to be created');
    // const { error } = await supabase
    //   .from('push_tokens')
    //   .delete()
    //   .eq('token', token);

    // if (error) {
    //   console.error('Error removing push token:', error);
    //   throw new Error(`Failed to remove push token: ${error.message}`);
    // }
  },

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ): () => void {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as Notification);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

export default notificationsApi;
