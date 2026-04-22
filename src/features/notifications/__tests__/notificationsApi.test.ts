import { DEFAULT_NOTIFICATION_PREFERENCES, NotificationType } from '../types';

describe('notificationsApi', () => {
  describe('DEFAULT_NOTIFICATION_PREFERENCES', () => {
    it('should have preferences for all notification types', () => {
      const notificationTypes: NotificationType[] = [
        'lease_created',
        'lease_signed',
        'lease_expiring',
        'lease_expired',
        'payment_due',
        'payment_received',
        'payment_overdue',
        'payment_failed',
        'maintenance_created',
        'maintenance_updated',
        'maintenance_completed',
        'inspection_scheduled',
        'inspection_completed',
        'message_received',
        'document_uploaded',
        'document_expiring',
        'application_received',
        'application_approved',
        'application_rejected',
        'viewing_scheduled',
        'viewing_reminder',
        'welcome',
        'password_reset',
        'account_verified',
      ];

      notificationTypes.forEach((type) => {
        expect(DEFAULT_NOTIFICATION_PREFERENCES[type]).toBeDefined();
        expect(DEFAULT_NOTIFICATION_PREFERENCES[type]).toHaveProperty('email');
        expect(DEFAULT_NOTIFICATION_PREFERENCES[type]).toHaveProperty('sms');
        expect(DEFAULT_NOTIFICATION_PREFERENCES[type]).toHaveProperty('push');
      });
    });

    it('should enable email for critical notifications', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.payment_overdue?.email).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.lease_expiring?.email).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.payment_due?.email).toBe(true);
    });

    it('should enable SMS for urgent notifications', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.payment_due?.sms).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.payment_overdue?.sms).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.inspection_scheduled?.sms).toBe(true);
    });

    it('should enable push notifications for real-time updates', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.message_received?.push).toBe(true);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.maintenance_updated?.push).toBe(true);
    });

    it('should not send SMS for low-priority notifications', () => {
      expect(DEFAULT_NOTIFICATION_PREFERENCES.maintenance_updated?.sms).toBe(false);
      expect(DEFAULT_NOTIFICATION_PREFERENCES.document_uploaded?.sms).toBe(false);
    });
  });
});
