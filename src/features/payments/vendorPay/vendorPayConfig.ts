export type VendorPayConfig = {
  role: 'owner' | 'tenant';
  accent: string;
  checkoutPath: string;
  resultPath: string;
  jobsPath: string;
  listPath: string;
  listLabel: string;
  emptyActionLabel: string;
  aiRoute: string;
  checkoutPinId: string;
  checkoutPinTitle: string;
  checkoutPinMessage: string;
  checkoutAiPrompt: string;
};

export const TENANT_VENDOR_PAY: VendorPayConfig = {
  role: 'tenant',
  accent: '#007A4D',
  checkoutPath: '/(tenant)/vendor-payments/checkout',
  resultPath: '/(tenant)/vendor-payments/result',
  jobsPath: '/(tenant)/maintenance',
  listPath: '/(tenant)/vendor-payments',
  listLabel: 'Back to Payments',
  emptyActionLabel: 'Back to Payments',
  aiRoute: '/(tenant)/ai-chat',
  checkoutPinId: 'tenant-pay-vendor-checkout',
  checkoutPinTitle: 'Secure Checkout',
  checkoutPinMessage:
    "You're paying inside the app through PayFast — no need to leave. Fill in your card or banking details on the secure page. When you finish (or cancel), you'll come straight back to a result screen.",
  checkoutAiPrompt: 'What is Pay Vendor and how does checkout work?',
};

export const OWNER_VENDOR_PAY: VendorPayConfig = {
  role: 'owner',
  accent: '#002395',
  checkoutPath: '/(owner)/vendor-payments/checkout',
  resultPath: '/(owner)/vendor-payments/result',
  jobsPath: '/(owner)/maintenance',
  listPath: '/(owner)/maintenance',
  listLabel: 'Back to Maintenance',
  emptyActionLabel: 'Go back',
  aiRoute: '/(owner)/ai-chat',
  checkoutPinId: 'owner-pay-vendor-checkout',
  checkoutPinTitle: 'Secure Checkout',
  checkoutPinMessage:
    'You are paying this vendor invoice inside the app through PayFast. When you finish or cancel, you come back to a result screen.',
  checkoutAiPrompt: 'How do I pay a vendor invoice as an owner?',
};
