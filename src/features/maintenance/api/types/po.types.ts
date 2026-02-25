/**
 * Purchase Order Types
 * Type definitions for purchase order operations
 */

export type POStatus = 'issued' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface ServiceContract {
  id: string;
  vendor_id: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_number?: string | null;
}

export interface PurchaseOrder {
  id: string;
  contract_id: string | null;
  po_number: string;
  currency: string;
  subtotal?: number;
  vat_amount?: number;
  platform_fee_amount?: number;
  total_amount?: number;
  status: POStatus;
  pdf_url?: string;
  revision_number?: number;
  revision_reason?: string;
  scheduled_start_date?: string;
  scheduled_start_time?: string;
  work_instructions?: string;
  sent_to_vendor_at?: string;
  sent_by?: string;
  created_at: string;
  updated_at: string;
  contract?: ServiceContract;
}

export interface PurchaseOrderWithDetails extends Omit<PurchaseOrder, 'contract'> {
  contract?: {
    id: string;
    quote?: {
      id: string;
      total_amount: number | null;
      vendor?: {
        id: string;
        full_name: string;
        phone: string;
        email: string;
        business_name: string | null;
      };
    };
  };
}

export interface PORevision {
  id: string;
  po_id: string;
  revision_number: number;
  subtotal: number;
  vat_amount: number;
  platform_fee_amount: number;
  total_amount: number;
  revised_by: string;
  revision_reason?: string;
  created_at: string;
}

export interface POUpdateData {
  subtotal?: number;
  vat_amount?: number;
  platform_fee_amount?: number;
  total_amount?: number;
  revision_reason?: string;
}

export interface POCreateData {
  contract_id?: string | null;
  po_number: string;
  currency: string;
  subtotal: number;
  vat_amount: number;
  platform_fee_amount: number;
  total_amount: number;
  status: POStatus;
  revision_number: number;
}

export interface PORevisionData {
  subtotal: number;
  vat_amount: number;
  platform_fee_amount: number;
  total_amount: number;
  revision_reason?: string;
  revision_number?: number;
}

export interface AuditTrail {
  request_id: string;
  quote_history: any[];
  po_history: PORevision[];
}
