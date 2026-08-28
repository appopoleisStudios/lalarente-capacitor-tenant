import { VendorPaymentCheckoutScreen } from '@/src/features/payments/vendorPay/VendorPaymentCheckoutScreen';
import { TENANT_VENDOR_PAY } from '@/src/features/payments/vendorPay/vendorPayConfig';

export default function VendorPaymentCheckout() {
  return <VendorPaymentCheckoutScreen config={TENANT_VENDOR_PAY} />;
}
