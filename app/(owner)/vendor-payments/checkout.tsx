import { VendorPaymentCheckoutScreen } from '@/src/features/payments/vendorPay/VendorPaymentCheckoutScreen';
import { OWNER_VENDOR_PAY } from '@/src/features/payments/vendorPay/vendorPayConfig';

export default function OwnerVendorPaymentCheckout() {
  return <VendorPaymentCheckoutScreen config={OWNER_VENDOR_PAY} />;
}
