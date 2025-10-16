/**
 * Supabase Database Types
 * Auto-generated from database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // ============================================
      // MAINTENANCE REQUESTS
      // ============================================
      maintenance_requests: {
        Row: {
          id: string
          property_id: string | null
          tenant_id: string | null
          vendor_id: string | null
          owner_id: string | null
          title: string
          description: string
          priority: 'low' | 'medium' | 'high'
          status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'
          mms_status: 'notification' | 'acknowledged' | 'vendor_routed' | 'quote_received' | 'po_issued' | 'in_progress' | 'completed'
          images: string[] | null
          category_id: string | null
          estimated_cost: number | null
          actual_cost: number | null
          scheduled_date: string | null
          completed_date: string | null
          acknowledged_at: string | null
          vendor_routed_at: string | null
          quote_deadline: string | null
          selected_vendor_id: string | null
          selected_quote_id: string | null
          po_id: string | null
          visibility: 'public' | 'invited' | 'private'
          created_at: string
        }
        Insert: {
          id?: string
          property_id?: string | null
          tenant_id?: string | null
          vendor_id?: string | null
          owner_id?: string | null
          title: string
          description: string
          priority?: 'low' | 'medium' | 'high'
          status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'
          mms_status?: string
          images?: string[] | null
          category_id?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          scheduled_date?: string | null
          completed_date?: string | null
          acknowledged_at?: string | null
          vendor_routed_at?: string | null
          quote_deadline?: string | null
          selected_vendor_id?: string | null
          selected_quote_id?: string | null
          po_id?: string | null
          visibility?: 'public' | 'invited' | 'private'
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string | null
          tenant_id?: string | null
          vendor_id?: string | null
          owner_id?: string | null
          title?: string
          description?: string
          priority?: 'low' | 'medium' | 'high'
          status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'
          mms_status?: string
          images?: string[] | null
          category_id?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
          scheduled_date?: string | null
          completed_date?: string | null
          acknowledged_at?: string | null
          vendor_routed_at?: string | null
          quote_deadline?: string | null
          selected_vendor_id?: string | null
          selected_quote_id?: string | null
          po_id?: string | null
          visibility?: 'public' | 'invited' | 'private'
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_category_id_fkey"
            columns: ["category_id"]
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      
      // ============================================
      // QUOTES
      // ============================================
      quotes: {
        Row: {
          id: string
          request_id: string | null
          vendor_id: string | null
          owner_id: string | null
          property_id: string | null
          contract_id: string | null
          quote_number: string | null
          total_amount: number | null
          tax_amount: number | null
          discount_amount: number | null
          net_amount: number | null
          validity_date: string | null
          status: string | null
          notes: string | null
          terms_conditions: string | null
          created_at: string
          updated_at: string
          accepted_at: string | null
          rejected_at: string | null
        }
        Insert: {
          id?: string
          request_id?: string | null
          vendor_id?: string | null
          owner_id?: string | null
          property_id?: string | null
          contract_id?: string | null
          quote_number?: string | null
          total_amount?: number | null
          tax_amount?: number | null
          discount_amount?: number | null
          net_amount?: number | null
          validity_date?: string | null
          status?: string | null
          notes?: string | null
          terms_conditions?: string | null
          created_at?: string
          updated_at?: string
          accepted_at?: string | null
          rejected_at?: string | null
        }
        Update: {
          id?: string
          request_id?: string | null
          vendor_id?: string | null
          owner_id?: string | null
          property_id?: string | null
          contract_id?: string | null
          quote_number?: string | null
          total_amount?: number | null
          tax_amount?: number | null
          discount_amount?: number | null
          net_amount?: number | null
          validity_date?: string | null
          status?: string | null
          notes?: string | null
          terms_conditions?: string | null
          created_at?: string
          updated_at?: string
          accepted_at?: string | null
          rejected_at?: string | null
        }
      }
      
      // ============================================
      // PURCHASE ORDERS
      // ============================================
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          contract_id: string | null
          total_amount: number | null
          status: string | null
          issued_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      
      // ============================================
      // SERVICE CONTRACTS
      // ============================================
      service_contracts: {
        Row: {
          id: string
          property_id: string | null
          owner_id: string | null
          vendor_id: string | null
          tenant_id: string | null
          maintenance_request_id: string | null
          template_id: string | null
          contract_number: string | null
          title: string | null
          description: string | null
          amount: number | null
          start_date: string | null
          end_date: string | null
          renewal_date: string | null
          status: string | null
          content_html: string | null
          variables_json: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['service_contracts']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['service_contracts']['Insert']>
      }
      
      // ============================================
      // JOB EXECUTIONS
      // ============================================
      job_executions: {
        Row: {
          id: string
          contract_id: string
          status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'
          start_at: string | null
          end_at: string | null
          sla_window_start: string | null
          sla_window_end: string | null
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['job_executions']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['job_executions']['Insert']>
      }
      
      // ============================================
      // VENDOR QUOTE REQUESTS
      // ============================================
      vendor_quote_requests: {
        Row: {
          id: string
          request_id: string
          vendor_id: string
          status: 'pending' | 'responded' | 'declined' | 'expired'
          response_deadline: string | null
          responded_at: string | null
          quote_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          request_id: string
          vendor_id: string
          status?: 'pending' | 'responded' | 'declined' | 'expired'
          response_deadline?: string | null
          responded_at?: string | null
          quote_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          request_id?: string
          vendor_id?: string
          status?: 'pending' | 'responded' | 'declined' | 'expired'
          response_deadline?: string | null
          responded_at?: string | null
          quote_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      
      // ============================================
      // VENDOR SERVICES
      // ============================================
      vendor_services: {
        Row: {
          id: string
          vendor_id: string
          category_id: string
          title: string | null
          description: string | null
          base_price: number | null
          pricing_unit: string | null
          min_callout_fee: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          vendor_id: string
          category_id: string
          title?: string | null
          description?: string | null
          base_price?: number | null
          pricing_unit?: string | null
          min_callout_fee?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          vendor_id?: string
          category_id?: string
          title?: string | null
          description?: string | null
          base_price?: number | null
          pricing_unit?: string | null
          min_callout_fee?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      
      // ============================================
      // DEDICATED VENDORS
      // ============================================
      dedicated_vendors: {
        Row: {
          id: string
          property_id: string
          category_id: string | null
          vendor_id: string
          priority: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          category_id?: string | null
          vendor_id: string
          priority?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          category_id?: string | null
          vendor_id?: string
          priority?: number
          is_active?: boolean
          created_at?: string
        }
      }
      
      // ============================================
      // SERVICE CATEGORIES
      // ============================================
      service_categories: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['service_categories']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['service_categories']['Insert']>
      }
      
      // ============================================
      // PROPERTIES
      // ============================================
      properties: {
        Row: {
          id: string
          owner_id: string | null
          assigned_vendor_id: string | null
          title: string
          description: string | null
          address: string
          city: string
          state: string
          postal_code: string
          country: string
          latitude: number | null
          longitude: number | null
          property_type: string | null
          bedrooms: number | null
          bathrooms: number | null
          square_feet: number | null
          rent_amount: number | null
          deposit_amount: number | null
          images: string[] | null
          amenities: Json | null
          status: 'available' | 'occupied' | 'maintenance' | 'vacant'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['properties']['Insert']>
      }
      
      // ============================================
      // LEASES
      // ============================================
      leases: {
        Row: {
          id: string
          property_id: string | null
          tenant_id: string | null
          lease_start: string
          lease_end: string
          rent_amount: number
          deposit_amount: number | null
          lease_document_url: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          property_id?: string | null
          tenant_id?: string | null
          lease_start: string
          lease_end: string
          rent_amount: number
          deposit_amount?: number | null
          lease_document_url?: string | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string | null
          tenant_id?: string | null
          lease_start?: string
          lease_end?: string
          rent_amount?: number
          deposit_amount?: number | null
          lease_document_url?: string | null
          status?: string | null
          created_at?: string
        }
      }
      
      // ============================================
      // PROFILES (USERS)
      // ============================================
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          phone: string | null
          role: 'tenant' | 'owner' | 'vendor' | 'admin'
          avatar_url: string | null
          fica_documents: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
    }
    Views: {}
    Functions: {}
    Enums: {
      user_role: 'tenant' | 'owner' | 'vendor' | 'admin'
      property_status: 'available' | 'occupied' | 'maintenance' | 'vacant'
      maintenance_status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'
      inspection_type: 'move_in' | 'routine' | 'move_out'
      payment_status: 'pending' | 'paid' | 'overdue' | 'failed'
    }
  }
}

// Helper types
export type MaintenanceRequest = Database['public']['Tables']['maintenance_requests']['Row']
export type MaintenanceRequestInsert = Database['public']['Tables']['maintenance_requests']['Insert']
export type MaintenanceRequestUpdate = Database['public']['Tables']['maintenance_requests']['Update']

export type Quote = Database['public']['Tables']['quotes']['Row']
export type PurchaseOrder = Database['public']['Tables']['purchase_orders']['Row']
export type ServiceContract = Database['public']['Tables']['service_contracts']['Row']
export type JobExecution = Database['public']['Tables']['job_executions']['Row']
export type ServiceCategory = Database['public']['Tables']['service_categories']['Row']
export type Property = Database['public']['Tables']['properties']['Row']
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Lease = Database['public']['Tables']['leases']['Row']
export type VendorQuoteRequest = Database['public']['Tables']['vendor_quote_requests']['Row']
export type VendorService = Database['public']['Tables']['vendor_services']['Row']
export type DedicatedVendor = Database['public']['Tables']['dedicated_vendors']['Row']

// Extended types with relationships
export type MaintenanceRequestWithRelations = MaintenanceRequest & {
  property?: Property
  tenant?: Profile
  owner?: Profile
  category?: ServiceCategory
  selected_vendor?: Profile
  selected_quote?: Quote
  purchase_order?: PurchaseOrder
}
