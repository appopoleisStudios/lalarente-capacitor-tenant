/** Row shape returned by admin_get_properties RPC */
export interface PropertyRow {
  id: string;
  title: string;
  city: string;
  rent_amount: number | null;
  status: string;
  created_at: string;
  owner_name: string | null;
}

/** Row shape returned by admin_get_leases RPC */
export interface LeaseRow {
  id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  status: string;
  deposit_amount: number | null;
  owner_name: string | null;
  tenant_name: string | null;
}

/** Row shape returned by admin_get_maintenance RPC */
export interface MaintenanceRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  estimated_cost: number | null;
  owner_name: string | null;
  tenant_name: string | null;
}

/** Row shape returned by admin_get_users RPC */
export interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  dev_admin: boolean;
  verification_status: boolean | null;
  created_at: string | null;
}

/** Shape returned by admin_get_dashboard_stats RPC */
export interface DashboardStats {
  total_users: number;
  total_properties: number;
  total_leases: number;
  active_leases: number;
  maintenance_open: number;
  monthly_revenue: number;
  total_disputes: number;
  total_arrears: number;
}

/** Shape returned by admin_get_payment_stats RPC */
export interface PaymentStats {
  total_payments: number;
  paid_payments: number;
  overdue_payments: number;
  active_disputes: number;
  total_arrears: number;
}

/** Shape returned by admin_get_vendor_revenue_summary RPC */
export interface VendorRevenueStats {
  gross_collected: number;
  platform_fees: number;
  gateway_fees: number;
  net_revenue: number;
  pending_payouts_total: number;
  active_disputes: number;
  pending_disputes: number;
  completed_count: number;
  pending_count: number;
  failed_count: number;
  total_count: number;
  revenue_30d: number;
  revenue_7d: number;
}

/** Row shape returned by admin_get_vendor_transactions RPC */
export interface VendorTransactionRow {
  id: string;
  invoice_number: string | null;
  maintenance_title: string | null;
  vendor_name: string | null;
  tenant_name: string | null;
  total_amount: number;
  platform_fee: number;
  gateway_fee: number;
  vendor_payout: number;
  net_revenue: number | null;
  payment_status: string;
  payout_status: string;
  dispute_status: string;
  paid_at: string | null;
  created_at: string;
}

/** Row shape returned by admin_get_vendor_disputes RPC */
export interface VendorDisputeRow {
  id: string;
  invoice_number: string | null;
  maintenance_title: string | null;
  vendor_name: string | null;
  tenant_name: string | null;
  total_amount: number;
  vendor_payout: number;
  dispute_status: string;
  payout_status: string;
  created_at: string;
  evidence?: VendorEvidence | null;
}

/** Photo evidence entry (closure + progress photos) */
export interface EvidencePhoto {
  url: string;
  stage: string;
  at: string | null;
}

/** Event timeline entry for a maintenance request */
export interface EvidenceTimelineEntry {
  event: string;
  note: string | null;
  at: string | null;
}

/** Evidence bundle returned by admin_vendor_evidence */
export interface VendorEvidence {
  photos: EvidencePhoto[];
  timeline: EvidenceTimelineEntry[];
}

/** Ledger journal entry (immutable) */
export interface VendorLedgerEntry {
  entry_type: string;
  amount: number;
  running_balance: number;
  description: string | null;
  created_at: string;
}

/** Full drill-down shape returned by admin_get_vendor_transaction_detail */
export interface VendorTransactionDetail {
  id: string;
  invoice_number: string | null;
  maintenance_title: string | null;
  vendor_name: string | null;
  tenant_name: string | null;
  total_amount: number;
  platform_fee: number;
  platform_fee_percent: number;
  gateway_fee: number;
  payout_fee: number;
  vendor_payout: number;
  net_revenue: number | null;
  payment_status: string;
  payout_status: string;
  dispute_status: string;
  payout_method: string | null;
  payout_reference: string | null;
  payment_gateway: string | null;
  gateway_transaction_id: string | null;
  paid_at: string | null;
  payout_initiated_at: string | null;
  payout_completed_at: string | null;
  created_at: string;
  ledger: VendorLedgerEntry[];
  evidence: VendorEvidence;
}

/** Daily revenue bucket returned by admin_get_vendor_revenue_series */
export interface RevenuePoint {
  day: string;
  gross: number;
  net: number;
}

/** Distinct parties for filter dropdowns (admin_get_vendor_party_options) */
export interface VendorPartyOption {
  id: string;
  full_name: string | null;
}

export interface VendorPartyOptions {
  vendors: VendorPartyOption[];
  tenants: VendorPartyOption[];
}

/** Active transaction filters for the vendor revenue tab */
export interface VendorTransactionFilters {
  payment_status: string | null;
  from: string | null;
  to: string | null;
  vendor_id: string | null;
  tenant_id: string | null;
}
