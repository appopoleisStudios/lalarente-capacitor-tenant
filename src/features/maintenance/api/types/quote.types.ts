/**
 * Quote Types
 * Type definitions for quote operations
 */

export type QuoteStatus = 'requested' | 'submitted' | 'approved' | 'rejected' | 'revision_requested';

export interface Quote {
  id: string;
  vendor_id: string;
  owner_id: string;
  property_id: string;
  request_id?: string;
  contract_id: string | null;
  status: QuoteStatus;
  subtotal?: number;
  vat_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  notes?: string;
  revision_number?: number;
  revision_reason?: string;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
    avatar_url?: string;
  };
  contract?: {
    id: string;
    status: string | null;
  };
}

export interface QuoteRevision {
  id: string;
  quote_id: string;
  revision_number: number;
  subtotal: number;
  vat_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  revised_by: string;
  revision_reason?: string;
  created_at: string;
}

export interface QuoteUpdateData {
  subtotal?: number;
  vat_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  notes?: string;
  revision_reason?: string;
}

export interface QuoteSubmissionData {
  request_id: string;
  vendor_id: string;
  owner_id: string;
  property_id: string;
  contract_id?: string | null;
  subtotal: number;
  vat_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  estimated_duration?: string;
  warranty_period?: string;
  line_items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
  }>;
}

export interface QuoteRevisionData {
  subtotal: number;
  vat_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  revision_reason?: string;
}

export interface QuoteLine {
  id: string;
  quote_id: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  created_at: string;
}
