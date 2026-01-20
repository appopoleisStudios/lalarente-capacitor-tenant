import {
  smsTemplates,
  formatSAPhoneNumber,
  isValidSAPhoneNumber,
} from '../templates/smsTemplates';
import { NotificationType } from '../types';

describe('SMS Templates', () => {
  describe('formatSAPhoneNumber', () => {
    it('should format 0xx numbers to +27xx', () => {
      expect(formatSAPhoneNumber('0821234567')).toBe('+27821234567');
      expect(formatSAPhoneNumber('0711234567')).toBe('+27711234567');
      expect(formatSAPhoneNumber('0612345678')).toBe('+27612345678');
    });

    it('should handle numbers already in international format', () => {
      expect(formatSAPhoneNumber('27821234567')).toBe('+27821234567');
      expect(formatSAPhoneNumber('+27821234567')).toBe('+27821234567');
    });

    it('should handle numbers with spaces and dashes', () => {
      expect(formatSAPhoneNumber('082 123 4567')).toBe('+27821234567');
      expect(formatSAPhoneNumber('082-123-4567')).toBe('+27821234567');
      expect(formatSAPhoneNumber('+27 82 123 4567')).toBe('+27821234567');
    });

    it('should handle 9-digit numbers (missing leading 0)', () => {
      expect(formatSAPhoneNumber('821234567')).toBe('+27821234567');
    });
  });

  describe('isValidSAPhoneNumber', () => {
    it('should validate correct SA mobile numbers', () => {
      // Valid mobile prefixes: 06x, 07x, 08x
      expect(isValidSAPhoneNumber('0821234567')).toBe(true);
      expect(isValidSAPhoneNumber('0711234567')).toBe(true);
      expect(isValidSAPhoneNumber('0612345678')).toBe(true);
      expect(isValidSAPhoneNumber('+27821234567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      // Landline (not mobile)
      expect(isValidSAPhoneNumber('0111234567')).toBe(false);
      expect(isValidSAPhoneNumber('0211234567')).toBe(false);

      // Too short
      expect(isValidSAPhoneNumber('082123456')).toBe(false);

      // Too long
      expect(isValidSAPhoneNumber('08212345678')).toBe(false);
    });

    it('should reject non-SA numbers', () => {
      expect(isValidSAPhoneNumber('+1234567890')).toBe(false);
      expect(isValidSAPhoneNumber('+44123456789')).toBe(false);
    });
  });

  describe('smsTemplates', () => {
    it('should have templates for all notification types', () => {
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
        expect(smsTemplates[type]).toBeDefined();
        expect(typeof smsTemplates[type]).toBe('function');
      });
    });

    it('should generate SMS content under 160 characters', () => {
      const testData = {
        recipientPhone: '0821234567',
        propertyTitle: 'Beautiful 2 Bedroom Apartment in Sandton',
        amount: '15000',
        dueDate: '2024-02-01',
        expiryDate: '2024-03-15',
        signerName: 'John Doe',
        title: 'Leaking tap in bathroom',
        newStatus: 'In Progress',
        senderName: 'Jane Smith',
        inspectionDate: '2024-02-15',
        inspectionTime: '10:00',
        inspectionType: 'Move-In',
        applicantName: 'John Applicant',
        viewingDate: '2024-02-20',
        viewingTime: '14:00',
        propertyAddress: '123 Main Street, Sandton',
        documentTitle: 'Lease Agreement 2024',
        uploaderName: 'Property Manager',
        daysOverdue: '15',
        recipientName: 'Test User',
        resetCode: '123456',
      };

      Object.entries(smsTemplates).forEach(([type, templateFn]) => {
        const result = templateFn(testData);
        expect(result.message.length).toBeLessThanOrEqual(160);
        expect(result.message).toContain('LaLaRente');
      });
    });

    it('should include amount in payment templates', () => {
      const paymentData = {
        recipientPhone: '0821234567',
        amount: '5000',
        dueDate: '2024-02-01',
        propertyTitle: 'Test Property',
        reference: 'PAY-123',
        daysOverdue: '10',
      };

      const paymentDue = smsTemplates.payment_due(paymentData);
      expect(paymentDue.message).toContain('R5000');

      const paymentReceived = smsTemplates.payment_received(paymentData);
      expect(paymentReceived.message).toContain('R5000');

      const paymentOverdue = smsTemplates.payment_overdue(paymentData);
      expect(paymentOverdue.message).toContain('R5000');
      expect(paymentOverdue.message).toContain('10');
    });

    it('should include property title in lease templates', () => {
      const leaseData = {
        recipientPhone: '0821234567',
        propertyTitle: 'Sunset Apartments',
        expiryDate: '2024-06-01',
        signerName: 'John Doe',
      };

      const leaseCreated = smsTemplates.lease_created(leaseData);
      expect(leaseCreated.message).toContain('Sunset Apartments');

      const leaseExpiring = smsTemplates.lease_expiring(leaseData);
      expect(leaseExpiring.message).toContain('Sunset Apartments');
    });

    it('should include inspection details in inspection templates', () => {
      const inspectionData = {
        recipientPhone: '0821234567',
        propertyTitle: 'Test Property',
        inspectionType: 'Move-In',
        inspectionDate: '2024-02-15',
        inspectionTime: '10:00',
      };

      const inspectionScheduled = smsTemplates.inspection_scheduled(inspectionData);
      expect(inspectionScheduled.message).toContain('Move-In');
      expect(inspectionScheduled.message).toContain('2024-02-15');
      expect(inspectionScheduled.message).toContain('10:00');
    });
  });
});
