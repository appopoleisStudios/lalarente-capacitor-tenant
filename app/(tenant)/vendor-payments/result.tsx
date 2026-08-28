import { VendorPaymentResultScreen } from '@/src/features/payments/vendorPay/VendorPaymentResultScreen';
import { TENANT_VENDOR_PAY } from '@/src/features/payments/vendorPay/vendorPayConfig';

export default function VendorPaymentResult() {
  return <VendorPaymentResultScreen config={TENANT_VENDOR_PAY} />;
}
