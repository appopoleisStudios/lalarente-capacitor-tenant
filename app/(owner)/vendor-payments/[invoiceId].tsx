import { VendorInvoicePayScreen } from '@/src/features/payments/vendorPay/VendorInvoicePayScreen';
import { OWNER_VENDOR_PAY } from '@/src/features/payments/vendorPay/vendorPayConfig';

export default function OwnerVendorPayScreen() {
  return <VendorInvoicePayScreen config={OWNER_VENDOR_PAY} />;
}
