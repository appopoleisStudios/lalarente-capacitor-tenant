import { VendorInvoicePayScreen } from '@/src/features/payments/vendorPay/VendorInvoicePayScreen';
import { TENANT_VENDOR_PAY } from '@/src/features/payments/vendorPay/vendorPayConfig';

export default function VendorPayScreen() {
  return <VendorInvoicePayScreen config={TENANT_VENDOR_PAY} />;
}
