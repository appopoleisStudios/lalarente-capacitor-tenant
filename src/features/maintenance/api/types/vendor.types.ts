/**
 * Vendor Types
 * Type definitions for vendor-related operations
 */

import type { MaintenanceRequest, MaintenanceStatus } from './maintenance.types';

export interface VendorServiceArea {
  city: string | null;
  province: string | null;
}

export interface VendorProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  business_name: string | null;
  rating: number | null;
  /** Number of maintenance requests completed with this vendor selected. */
  completed_jobs?: number;
  role?: string;
  /** Optional public vendor introduction when the profile schema provides one. */
  bio?: string | null;
  /** Active trades (service category names). Loaded by directory queries. */
  trades?: string[];
  /** Cities / provinces the vendor covers. Loaded by directory queries. */
  service_areas?: VendorServiceArea[];
}

export interface VendorMaintenanceRequest extends MaintenanceRequest {
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    province: string;
  };
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  owner?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  tenant?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  };
  // Vendor-specific fields
  my_quote?: {
    id: string;
    status: string;
    total_amount: number | null;
    created_at: string;
    revision_reason?: string | null;
  };
  has_quote_request?: boolean;
  can_quote?: boolean;
}

export interface VendorMaintenanceFilters {
  status?: MaintenanceStatus;
  category?: string;
  hasQuote?: boolean;
}

export interface VendorQuoteRequest {
  id: string;
  request_id: string;
  vendor_id: string;
  status: QuoteRequestStatus;
  response_deadline: string;
  responded_at?: string | null;
  quote_id?: string | null;
  created_at: string;
  invited_by?: string | null;
  invited_by_role?: 'owner' | 'tenant' | null;
  inviter_name?: string | null;
}

export type QuoteRequestStatus = 'pending' | 'responded' | 'declined' | 'submitted';

export interface JobStatusUpdate {
  status: 'in_progress' | 'completed';
  completion_notes?: string;
  completion_photos?: string[];
}

export interface QuoteSubmission {
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
  line_items: {
    name: string;
    quantity: number;
    unit_price: number;
  }[];
}

export interface VendorService {
  vendor_id: string;
  category_id: string;
  is_active: boolean;
}

export interface DedicatedVendor {
  id: string;
  property_id: string;
  vendor_id: string;
  category_id: string | null;
  priority: number;
  is_active: boolean;
  vendor?: VendorProfile;
}
