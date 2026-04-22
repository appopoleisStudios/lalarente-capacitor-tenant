// Notifications feature exports
export * from './types';
export { notificationsApi } from './api/notificationsApi';
export { emailTemplates } from './templates/emailTemplates';
export {
  smsTemplates,
  smsService,
  formatSAPhoneNumber,
  isValidSAPhoneNumber,
} from './templates/smsTemplates';
