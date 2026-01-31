import { SmsTemplate, SmsTemplateData, NotificationType } from '../types';

// Company name for SMS
const BRAND_NAME = 'LaLaRente';

// Max SMS length (standard is 160 characters for single SMS)
const MAX_SMS_LENGTH = 160;

// Helper to truncate message
const truncate = (text: string, maxLength: number = MAX_SMS_LENGTH): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
};

// SMS templates - keeping messages concise for SMS
export const smsTemplates: Record<NotificationType, (data: SmsTemplateData) => SmsTemplate> = {
  // Lease notifications
  lease_created: (data) => ({
    message: truncate(`${BRAND_NAME}: New lease created for ${data.propertyTitle}. Please review and sign in the app.`),
  }),

  lease_signed: (data) => ({
    message: truncate(`${BRAND_NAME}: Lease for ${data.propertyTitle} has been signed by ${data.signerName}. View details in app.`),
  }),

  lease_expiring: (data) => ({
    message: truncate(`${BRAND_NAME}: Your lease for ${data.propertyTitle} expires on ${data.expiryDate}. Contact us to discuss renewal.`),
  }),

  lease_expired: (data) => ({
    message: truncate(`${BRAND_NAME}: Your lease for ${data.propertyTitle} has expired. Please take action immediately.`),
  }),

  // Payment notifications
  payment_due: (data) => ({
    message: truncate(`${BRAND_NAME}: Payment of R${data.amount} due on ${data.dueDate} for ${data.propertyTitle}. Pay via app.`),
  }),

  payment_received: (data) => ({
    message: truncate(`${BRAND_NAME}: Payment of R${data.amount} received. Ref: ${data.reference}. Thank you!`),
  }),

  payment_overdue: (data) => ({
    message: truncate(`${BRAND_NAME} URGENT: Payment of R${data.amount} is ${data.daysOverdue} days overdue. Pay now to avoid late fees.`),
  }),

  payment_failed: (data) => ({
    message: truncate(`${BRAND_NAME}: Payment of R${data.amount} failed. Please try again or use a different payment method.`),
  }),

  // Maintenance notifications
  maintenance_created: (data) => ({
    message: truncate(`${BRAND_NAME}: New maintenance request "${data.title}" submitted for ${data.propertyTitle}.`),
  }),

  maintenance_updated: (data) => ({
    message: truncate(`${BRAND_NAME}: Maintenance "${data.title}" updated to ${data.newStatus}. Check app for details.`),
  }),

  maintenance_completed: (data) => ({
    message: truncate(`${BRAND_NAME}: Maintenance "${data.title}" completed. Please rate the service in the app.`),
  }),

  // Inspection notifications
  inspection_scheduled: (data) => ({
    message: truncate(`${BRAND_NAME}: ${data.inspectionType} inspection scheduled for ${data.inspectionDate} at ${data.inspectionTime}. Be prepared.`),
  }),

  inspection_completed: (data) => ({
    message: truncate(`${BRAND_NAME}: Inspection for ${data.propertyTitle} completed. View report in the app.`),
  }),

  // Message notification
  message_received: (data) => ({
    message: truncate(`${BRAND_NAME}: New message from ${data.senderName}. Open the app to read and reply.`),
  }),

  // Document notifications
  document_uploaded: (data) => ({
    message: truncate(`${BRAND_NAME}: New document "${data.documentTitle}" uploaded by ${data.uploaderName}. View in app.`),
  }),

  document_expiring: (data) => ({
    message: truncate(`${BRAND_NAME}: Document "${data.documentTitle}" expires on ${data.expiryDate}. Download or extend in app.`),
  }),

  // Application notifications
  application_received: (data) => ({
    message: truncate(`${BRAND_NAME}: New application from ${data.applicantName} for ${data.propertyTitle}. Review in app.`),
  }),

  application_approved: (data) => ({
    message: truncate(`${BRAND_NAME}: Congrats! Your application for ${data.propertyTitle} approved. Check app for next steps.`),
  }),

  application_rejected: (data) => ({
    message: truncate(`${BRAND_NAME}: Application update for ${data.propertyTitle}. Check the app for details.`),
  }),

  // Viewing notifications
  viewing_requested: (data) => ({
    message: truncate(`${BRAND_NAME}: New viewing request for ${data.propertyTitle}. Review in app.`),
  }),

  viewing_approved: (data) => ({
    message: truncate(`${BRAND_NAME}: Your viewing for ${data.propertyTitle} has been approved. Check app for details.`),
  }),

  viewing_declined: (data) => ({
    message: truncate(`${BRAND_NAME}: Your viewing request for ${data.propertyTitle} was declined.`),
  }),

  viewing_cancelled: (data) => ({
    message: truncate(`${BRAND_NAME}: Viewing for ${data.propertyTitle} has been cancelled.`),
  }),

  viewing_completed: (data) => ({
    message: truncate(`${BRAND_NAME}: Thank you for viewing ${data.propertyTitle}!`),
  }),

  viewing_scheduled: (data) => ({
    message: truncate(`${BRAND_NAME}: Viewing confirmed for ${data.propertyTitle} on ${data.viewingDate} at ${data.viewingTime}.`),
  }),

  viewing_reminder: (data) => ({
    message: truncate(`${BRAND_NAME} REMINDER: Property viewing tomorrow at ${data.viewingTime}. Address: ${data.propertyAddress}`),
  }),

  // Account notifications
  welcome: (data) => ({
    message: truncate(`Welcome to ${BRAND_NAME}, ${data.recipientName}! Download our app to get started with your rental journey.`),
  }),

  password_reset: (data) => ({
    message: truncate(`${BRAND_NAME}: Your password reset code is ${data.resetCode}. Valid for 15 minutes. Don't share this code.`),
  }),

  account_verified: (data) => ({
    message: truncate(`${BRAND_NAME}: Your account is verified! You now have full access to all features.`),
  }),
};

// South African SMS gateway configuration structure
export interface SmsGatewayConfig {
  provider: 'bulksms' | 'clickatell' | 'africastalking' | 'twilio';
  apiKey: string;
  apiSecret?: string;
  senderId: string;
  baseUrl: string;
}

// SMS sending interface
export interface SendSmsInput {
  to: string; // Phone number in international format (+27...)
  message: string;
  senderId?: string;
}

// SMS response
export interface SmsResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
  remainingCredits?: number;
}

// Format South African phone number
export const formatSAPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Handle South African numbers
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    // Convert 0xx to +27xx
    cleaned = '27' + cleaned.substring(1);
  } else if (cleaned.startsWith('27') && cleaned.length === 11) {
    // Already in correct format
  } else if (cleaned.length === 9) {
    // Assume it's missing the leading 0
    cleaned = '27' + cleaned;
  }

  return '+' + cleaned;
};

// Validate SA phone number
export const isValidSAPhoneNumber = (phone: string): boolean => {
  const formatted = formatSAPhoneNumber(phone);
  // South African mobile numbers: +27 6x, 7x, 8x followed by 7 digits
  const saPhoneRegex = /^\+27[6-8][0-9]{8}$/;
  return saPhoneRegex.test(formatted);
};

// SMS service structure (actual implementation would connect to provider)
export const smsService = {
  /**
   * Send SMS via configured gateway
   * This is a placeholder structure - actual implementation would use
   * the configured SMS provider's API
   */
  async send(input: SendSmsInput, config: SmsGatewayConfig): Promise<SmsResponse> {
    // Validate phone number
    if (!isValidSAPhoneNumber(input.to)) {
      return {
        success: false,
        error: 'Invalid South African phone number',
      };
    }

    const formattedPhone = formatSAPhoneNumber(input.to);

    // Provider-specific implementation would go here
    // This is a structure placeholder
    console.log(`SMS would be sent to ${formattedPhone}: ${input.message}`);

    // In production, this would call the actual SMS gateway API
    // Example for BulkSMS:
    // const response = await fetch(`${config.baseUrl}/messages`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     to: formattedPhone,
    //     body: input.message,
    //     from: config.senderId,
    //   }),
    // });

    return {
      success: true,
      messageId: `msg_${Date.now()}`,
    };
  },

  /**
   * Send notification SMS using template
   */
  async sendNotification(
    type: NotificationType,
    data: SmsTemplateData,
    config: SmsGatewayConfig
  ): Promise<SmsResponse> {
    const template = smsTemplates[type];
    if (!template) {
      return {
        success: false,
        error: `No SMS template found for type: ${type}`,
      };
    }

    const { message } = template(data);

    return this.send(
      {
        to: data.recipientPhone,
        message,
      },
      config
    );
  },

  /**
   * Get SMS credits balance (provider-specific)
   */
  async getCredits(config: SmsGatewayConfig): Promise<number> {
    // Provider-specific implementation
    // This would call the SMS provider's API to check balance
    console.log('Checking SMS credits for provider:', config.provider);
    return 1000; // Placeholder
  },
};

export default smsTemplates;
