import { VendorPaymentResultScreen } from '@/src/features/payments/vendorPay/VendorPaymentResultScreen';
import { OWNER_VENDOR_PAY } from '@/src/features/payments/vendorPay/vendorPayConfig';

export default function OwnerVendorPaymentResult() {
  return <VendorPaymentResultScreen config={OWNER_VENDOR_PAY} />;
}
