/**
 * Maintenance Request Types
 * Centralized type definitions for maintenance requests
 */

export type MaintenanceStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed';

export type MmsStatus = 
  | 'notification' 
  | 'acknowledged' 
  | 'vendor_routed' 
  | 'quote_received' 
  | 'po_issued' 
  | 'in_progress' 
  | 'completed'
  | 'quoting'
  | 'vendor_routing';

export type Priority = 'low' | 'medium' | 'high';

export type Visibility = 'public' | 'invited' | 'private';

export interface MaintenanceRequest {
  id: string;
  property_id: string;
  owner_id: string;
  tenant_id: string | null;
  category_id: string | null;
  title: string;
  description: string;
  priority: Priority;
  status: MaintenanceStatus;
  mms_status: MmsStatus;
  visibility: Visibility;
  images: string[] | null;
  selected_vendor_id: string | null;
  selected_quote_id: string | null;
  po_id: string | null;
  acknowledged_at: string | null;
  vendor_routed_at: string | null;
  completed_date: string | null;
  closure_requested_at: string | null;
  work_started_at: string | null;
  work_started_by: string | null;
  work_can_start: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequestWithRelations extends MaintenanceRequest {
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    owner_id?: string;
  };
  tenant?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
    phone: string | null;
  };
  owner?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  category?: {
    id: string;
    name: string;
    description: string | null;
  };
  selected_vendor?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  };
  quotes?: Array<{
    id: string;
    vendor_id: string;
    total_amount: number | null;
    status: string;
    created_at: string;
    vendor?: {
      full_name: string | null;
      phone: string | null;
    };
  }>;
}

export interface CreateMaintenanceRequestInput {
  property_id: string;
  owner_id: string;
  tenant_id: string;
  category_id?: string;
  priority?: Priority;
  visibility?: Visibility;
  title: string;
  description: string;
  images?: string[];
}

export interface MaintenanceRequestUpdate {
  title?: string;
  description?: string;
  priority?: Priority;
  category_id?: string;
  images?: string[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  owner_id?: string;
}

export interface ProgressUpdate {
  id: string;
  maintenance_request_id: string;
  vendor_id: string;
  update_date: string;
  notes: string;
  photos: string[];
  created_at: string;
}

export interface ClosureReport {
  id: string;
  maintenance_request_id: string;
  completion_notes: string;
  completion_photos: string[];
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string | null;
  // Migration 018: Tenant verification fields
  tenant_verification_status?: 'pending_tenant' | 'tenant_approved' | 'tenant_rejected' | 'auto_approved' | null;
  rejection_count?: number | null;
  forwarded_to_tenant_at?: string | null;
  tenant_verified_at?: string | null;
  tenant_rejection_reason?: string | null;
  tenant_rejection_photos?: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressEvent {
  id: string;
  type: 'status_change' | 'progress_update' | 'message' | 'quote' | 'po';
  timestamp: string;
  description: string;
  user?: {
    id: string;
    full_name: string | null;
    role: string;
  };
}

export interface ProgressNote {
  id: string;
  maintenance_request_id: string;
  vendor_id: string;
  note: string;
  created_at: string;
}
