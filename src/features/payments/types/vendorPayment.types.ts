/**
 * Vendor Payment Types
 * Type definitions for the Tenant→Vendor payment system
 * (Uber-like parallel flow to existing Owner→Vendor payments)
 *
 * @see docs/VENDOR_PAYMENT_ARCHITECTURE.md
 */

// ─── Enums ──────────────────────────────────────────────────────────

export type VendorPaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'refunded';

export type VendorPayoutStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'cancelled'
  | 'on_hold';

export type VendorPayoutMethod = 'payfast_payout' | 'manual_eft' | 'instant';

export type VendorPaymentGateway = 'payfast' | 'yoco' | 'manual';

export type VendorDisputeStatus = 'none' | 'opened' | 'resolved' | 'escalated';

export type VendorLedgerEntryType =
  | 'payment_received'
  | 'platform_fee'
  | 'gateway_fee'
  | 'payout_sent'
  | 'payout_fee'
  | 'refund'
  | 'dispute_hold'
  | 'dispute_release';

export type VendorPayoutSchedule = 'instant' | 'daily' | 'weekly';

export type PayerRole = 'tenant' | 'owner';

// ─── Core Types ─────────────────────────────────────────────────────

/** Core transaction record for each vendor payment */
export interface VendorPayment {
  id: string;

  // Relationships
  invoice_id: string;
  maintenance_request_id: string;
  tenant_id: string;
  vendor_id: string;
  owner_id: string;

  // Financials
  total_amount: number;
  platform_fee: number;
  platform_fee_percent: number;
  gateway_fee: number;
  payout_fee: number;
  vendor_payout: number;
  /** Generated column: platform_fee - gateway_fee. Read-only. */
  net_revenue?: number;

  // Gateway
  payment_gateway: VendorPaymentGateway;
  gateway_transaction_id: string | null;
  gateway_response: Record<string, unknown> | null;
  idempotency_key: string | null;

  // Payment status
  payment_status: VendorPaymentStatus;
  paid_at: string | null;

  // Payout status
  payout_status: VendorPayoutStatus;
  /** Defaults to 'manual_eft' for v1 (PayFast payout API TBD). */
  payout_method: VendorPayoutMethod;
  payout_initiated_at: string | null;
  payout_completed_at: string | null;
  payout_reference: string | null;

  // Dispute
  dispute_status: VendorDisputeStatus;
  dispute_resolved_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/** Input for creating a new vendor payment via Edge Function */
export interface VendorPaymentCreateInput {
  invoice_id: string;
  maintenance_request_id: string;
  tenant_id: string;
  vendor_id: string;
  owner_id: string;
  total_amount: number;
  platform_fee: number;
  vendor_payout: number;
  idempotency_key: string;
}

/** Fields allowed to be updated post-creation */
export interface VendorPaymentUpdate {
  payment_status?: VendorPaymentStatus;
  paid_at?: string | null;
  gateway_transaction_id?: string | null;
  gateway_response?: Record<string, unknown> | null;
  gateway_fee?: number;
  payout_status?: VendorPayoutStatus;
  payout_method?: VendorPayoutMethod | null;
  payout_initiated_at?: string | null;
  payout_completed_at?: string | null;
  payout_reference?: string | null;
  payout_fee?: number;
  dispute_status?: VendorDisputeStatus;
  dispute_resolved_at?: string | null;
}

/** Single entry in the payment audit ledger */
export interface VendorPaymentLedgerEntry {
  id: string;
  vendor_payment_id: string;
  entry_type: VendorLedgerEntryType;
  amount: number; // Positive = inflow, Negative = outflow
  running_balance: number;
  description: string | null;
  reference_id: string | null;
  created_by: string | null;
  created_at: string;
}

/** Vendor payout preferences / bank details */
export interface VendorPayoutPreferences {
  vendor_id: string;
  schedule: VendorPayoutSchedule;
  bank_account_name: string | null;
  bank_name: string | null;
  branch_code: string | null;
  account_number_encrypted: string | null;
  account_type: 'cheque' | 'savings' | 'transmission' | null;
  updated_at: string;
}

// ─── Extended Relations ─────────────────────────────────────────────

/** Vendor payment with related data for display */
export interface VendorPaymentWithRelations extends VendorPayment {
  invoice?: {
    id: string;
    invoice_number: string;
    line_items: {
      description: string;
      quantity: number;
      unit_price: number;
      total: number;
    }[];
    subtotal: number;
    vat_amount: number;
    total_amount: number;
  };
  maintenance_request?: {
    id: string;
    title: string;
    description: string;
    status: string;
  };
  tenant?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  vendor?: {
    id: string;
    full_name: string;
    business_name: string | null;
    email: string | null;
    phone: string | null;
  };
  property?: {
    id: string;
    title: string;
    address: string;
  };
}

/** Earnings summary for vendor dashboard */
export interface VendorEarningsSummary {
  total_earned_all_time: number;
  total_platform_fees: number;
  total_payout_fees: number;
  net_earnings: number;
  pending_payout_count: number;
  pending_payout_total: number;
  next_scheduled_payout_date: string | null;
  payout_schedule: VendorPayoutSchedule;
  recent_transactions: VendorPaymentWithRelations[];
}

/** Fee breakdown for a single payment (displayed to tenant before they pay) */
export interface PaymentBreakdown {
  total_amount: number;
  line_items: {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  subtotal: number;
  vat_amount: number;
}

// ─── API Types ──────────────────────────────────────────────────────

/** Request to create a PayFast checkout session */
export interface CreateCheckoutRequest {
  invoice_id: string;
  return_url: string;
  cancel_url: string;
}

/** Response from createVendorPaymentCheckout Edge Function */
export interface CreateCheckoutResponse {
  payment_id: string;
  payfast_form_action: string;
  payfast_fields: Record<string, string>;
  payfast_redirect_url?: string;
  sandbox?: boolean;
  expires_at: string;
}

/** Response from getVendorPaymentStatus Edge Function */
export interface PaymentStatusResponse {
  payment_id: string;
  payment_status: VendorPaymentStatus;
  payout_status: VendorPayoutStatus;
  dispute_status: VendorDisputeStatus;
  paid_at: string | null;
  total_amount: number;
  breakdown: PaymentBreakdown;
}

// ─── Invoice Types (extended for payer role) ────────────────────────

/** Extended maintenance invoice with payer_role */
export interface MaintenanceInvoiceWithPayerRole {
  id: string;
  invoice_number: string;
  status: string;
  payer_role: PayerRole;
  total_amount: number;
  subtotal: number;
  vat_amount: number;
  line_items: {
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  maintenance_request_id: string;
  vendor_id: string;
  owner_id: string;
  created_at: string;
}

// ─── Closure Types (extended for Tenant→Vendor photos) ─────────────

/** Closure report extended with two-sided photo verification fields */
export interface ClosureReportWithPhotos {
  id: string;
  maintenance_request_id: string;
  status: string | null;

  // Vendor side
  completion_photos: string[] | null;
  vendor_after_photos: string[];
  vendor_closure_notes: string | null;
  vendor_confirmed_at: string | null;

  // Tenant side
  tenant_verification_status: string | null;
  tenant_confirmation_photos: string[];
  tenant_notes: string | null;
  tenant_ack_at: string | null;
  tenant_rejection_photos: string[] | null;

  // Auto-approval
  auto_approve_at: string | null;

  created_at: string | null;
  updated_at: string | null;
}
