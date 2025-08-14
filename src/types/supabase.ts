export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      contract_templates: {
        Row: {
          content_html: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          role_scope: string
          title: string
          updated_at: string
          variables_json: Json | null
        }
        Insert: {
          content_html: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          role_scope: string
          title: string
          updated_at?: string
          variables_json?: Json | null
        }
        Update: {
          content_html?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          role_scope?: string
          title?: string
          updated_at?: string
          variables_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string | null
          data: Json | null
          event: string
          id: string
          inspection_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          event: string
          id?: string
          inspection_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          event?: string
          id?: string
          inspection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_audit_logs_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          completed_date: string | null
          created_at: string | null
          id: string
          images: string[] | null
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspector_id: string | null
          inspector_signature: string | null
          owner_signature: string | null
          property_id: string | null
          report_data: Json | null
          report_url: string | null
          scheduled_date: string
          tenant_id: string | null
          tenant_signature: string | null
        }
        Insert: {
          completed_date?: string | null
          created_at?: string | null
          id?: string
          images?: string[] | null
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspector_id?: string | null
          inspector_signature?: string | null
          owner_signature?: string | null
          property_id?: string | null
          report_data?: Json | null
          report_url?: string | null
          scheduled_date: string
          tenant_id?: string | null
          tenant_signature?: string | null
        }
        Update: {
          completed_date?: string | null
          created_at?: string | null
          id?: string
          images?: string[] | null
          inspection_type?: Database["public"]["Enums"]["inspection_type"]
          inspector_id?: string | null
          inspector_signature?: string | null
          owner_signature?: string | null
          property_id?: string | null
          report_data?: Json | null
          report_url?: string | null
          scheduled_date?: string
          tenant_id?: string | null
          tenant_signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          created_at: string | null
          deposit_amount: number | null
          id: string
          lease_document_url: string | null
          lease_end: string
          lease_start: string
          property_id: string | null
          rent_amount: number
          status: string | null
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          lease_document_url?: string | null
          lease_end: string
          lease_start: string
          property_id?: string | null
          rent_amount: number
          status?: string | null
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          lease_document_url?: string | null
          lease_end?: string
          lease_start?: string
          property_id?: string | null
          rent_amount?: number
          status?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          actual_cost: number | null
          completed_date: string | null
          created_at: string | null
          description: string
          estimated_cost: number | null
          id: string
          images: string[] | null
          priority: string | null
          property_id: string | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["maintenance_status"] | null
          tenant_id: string | null
          title: string
          vendor_id: string | null
        }
        Insert: {
          actual_cost?: number | null
          completed_date?: string | null
          created_at?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          images?: string[] | null
          priority?: string | null
          property_id?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"] | null
          tenant_id?: string | null
          title: string
          vendor_id?: string | null
        }
        Update: {
          actual_cost?: number | null
          completed_date?: string | null
          created_at?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          images?: string[] | null
          priority?: string | null
          property_id?: string | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"] | null
          tenant_id?: string | null
          title?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: string[] | null
          content: string
          created_at: string | null
          id: string
          message_type: string | null
          property_id: string | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string | null
        }
        Insert: {
          attachments?: string[] | null
          content: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          property_id?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Update: {
          attachments?: string[] | null
          content?: string
          created_at?: string | null
          id?: string
          message_type?: string | null
          property_id?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          commission_amount: number | null
          commission_rate: number | null
          created_at: string | null
          due_date: string
          id: string
          lease_id: string | null
          net_amount: number | null
          paid_date: string | null
          payment_method: string | null
          payment_reference: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["payment_status"] | null
          tenant_id: string | null
        }
        Insert: {
          amount: number
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          due_date: string
          id?: string
          lease_id?: string | null
          net_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          due_date?: string
          id?: string
          lease_id?: string | null
          net_amount?: number | null
          paid_date?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bank_details: Json | null
          created_at: string | null
          email: string | null
          fica_documents: Json | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          verification_status: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bank_details?: Json | null
          created_at?: string | null
          email?: string | null
          fica_documents?: Json | null
          full_name: string
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          verification_status?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bank_details?: Json | null
          created_at?: string | null
          email?: string | null
          fica_documents?: Json | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          verification_status?: boolean | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          amenities: string[] | null
          assigned_vendor_id: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string | null
          deposit_amount: number | null
          description: string | null
          id: string
          images: string[] | null
          lease_terms: Json | null
          owner_id: string
          parking_spaces: number | null
          postal_code: string | null
          property_type: string
          province: string
          rent_amount: number
          status: Database["public"]["Enums"]["property_status"] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          address: string
          amenities?: string[] | null
          assigned_vendor_id?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          images?: string[] | null
          lease_terms?: Json | null
          owner_id: string
          parking_spaces?: number | null
          postal_code?: string | null
          property_type: string
          province: string
          rent_amount: number
          status?: Database["public"]["Enums"]["property_status"] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          amenities?: string[] | null
          assigned_vendor_id?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          images?: string[] | null
          lease_terms?: Json | null
          owner_id?: string
          parking_spaces?: number | null
          postal_code?: string | null
          property_type?: string
          province?: string
          rent_amount?: number
          status?: Database["public"]["Enums"]["property_status"] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_assigned_vendor_id_fkey"
            columns: ["assigned_vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      property_assignments: {
        Row: {
          contract_details: Json | null
          created_at: string | null
          end_date: string | null
          id: string
          is_active: boolean | null
          owner_id: string | null
          property_id: string | null
          start_date: string
          vendor_id: string | null
        }
        Insert: {
          contract_details?: Json | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          property_id?: string | null
          start_date: string
          vendor_id?: string | null
        }
        Update: {
          contract_details?: Json | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          owner_id?: string | null
          property_id?: string | null
          start_date?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_assignments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_assignments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          description: string
          id: string
          qty: number
          quote_id: string
          tax_rate: number | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          qty?: number
          quote_id: string
          tax_rate?: number | null
          unit?: string | null
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          qty?: number
          quote_id?: string
          tax_rate?: number | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          contract_id: string | null
          created_at: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          owner_id: string
          property_id: string
          request_id: string | null
          status: string
          subtotal: number | null
          total_amount: number | null
          updated_at: string | null
          vat_amount: number | null
          vendor_id: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          owner_id: string
          property_id: string
          request_id?: string | null
          status?: string
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vendor_id: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          owner_id?: string
          property_id?: string
          request_id?: string | null
          status?: string
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      service_contract_audit_logs: {
        Row: {
          actor_id: string | null
          contract_id: string
          created_at: string | null
          data: Json | null
          event: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          contract_id: string
          created_at?: string | null
          data?: Json | null
          event: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          contract_id?: string
          created_at?: string | null
          data?: Json | null
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_audit_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contract_signatures: {
        Row: {
          contract_id: string
          id: string
          ip_address: unknown | null
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: unknown | null
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: unknown | null
          signature_image_url?: string
          signed_at?: string
          signer_id?: string
          signer_role?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contract_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_contracts: {
        Row: {
          compiled_html: string | null
          compiled_variables: Json | null
          created_at: string | null
          id: string
          maintenance_request_id: string | null
          owner_id: string
          pdf_sha256: string | null
          pdf_url: string | null
          property_id: string
          requires_tenant_signature: boolean | null
          status: string
          template_id: string | null
          tenant_id: string | null
          terms: Json | null
          title: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          compiled_html?: string | null
          compiled_variables?: Json | null
          created_at?: string | null
          id?: string
          maintenance_request_id?: string | null
          owner_id: string
          pdf_sha256?: string | null
          pdf_url?: string | null
          property_id: string
          requires_tenant_signature?: boolean | null
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          terms?: Json | null
          title: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          compiled_html?: string | null
          compiled_variables?: Json | null
          created_at?: string | null
          id?: string
          maintenance_request_id?: string | null
          owner_id?: string
          pdf_sha256?: string | null
          pdf_url?: string | null
          property_id?: string
          requires_tenant_signature?: boolean | null
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          terms?: Json | null
          title?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_contracts_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_contracts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_contract_audit_logs: {
        Row: {
          actor_id: string | null
          contract_id: string
          created_at: string | null
          data: Json | null
          event: string
          id: string
        }
        Insert: {
          actor_id?: string | null
          contract_id: string
          created_at?: string | null
          data?: Json | null
          event: string
          id?: string
        }
        Update: {
          actor_id?: string | null
          contract_id?: string
          created_at?: string | null
          data?: Json | null
          event?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_contract_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_contract_audit_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "tenancy_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_contract_signatures: {
        Row: {
          contract_id: string
          id: string
          ip_address: unknown | null
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: unknown | null
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: unknown | null
          signature_image_url?: string
          signed_at?: string
          signer_id?: string
          signer_role?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_contract_signatures_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "tenancy_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_contract_signatures_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenancy_contracts: {
        Row: {
          compiled_html: string | null
          compiled_variables: Json | null
          created_at: string | null
          id: string
          lease_id: string | null
          owner_id: string
          pdf_sha256: string | null
          pdf_url: string | null
          property_id: string
          requires_owner_signature: boolean | null
          requires_tenant_signature: boolean | null
          status: string
          template_id: string | null
          tenant_id: string
          terms: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          compiled_html?: string | null
          compiled_variables?: Json | null
          created_at?: string | null
          id?: string
          lease_id?: string | null
          owner_id: string
          pdf_sha256?: string | null
          pdf_url?: string | null
          property_id: string
          requires_owner_signature?: boolean | null
          requires_tenant_signature?: boolean | null
          status?: string
          template_id?: string | null
          tenant_id: string
          terms?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          compiled_html?: string | null
          compiled_variables?: Json | null
          created_at?: string | null
          id?: string
          lease_id?: string | null
          owner_id?: string
          pdf_sha256?: string | null
          pdf_url?: string | null
          property_id?: string
          requires_owner_signature?: boolean | null
          requires_tenant_signature?: boolean | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          terms?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenancy_contracts_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_contracts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenancy_contracts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_availability_slots: {
        Row: {
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          end_time: string
          id: string
          is_recurring: boolean | null
          start_time: string
          vendor_id: string
          weekday: number | null
        }
        Insert: {
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          end_time: string
          id?: string
          is_recurring?: boolean | null
          start_time: string
          vendor_id: string
          weekday?: number | null
        }
        Update: {
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          start_time?: string
          vendor_id?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_availability_slots_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_documents: {
        Row: {
          doc_type: string
          file_url: string
          id: string
          notes: string | null
          reviewed_at: string | null
          status: string
          uploaded_at: string | null
          vendor_id: string
        }
        Insert: {
          doc_type: string
          file_url: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          status?: string
          uploaded_at?: string | null
          vendor_id: string
        }
        Update: {
          doc_type?: string
          file_url?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          status?: string
          uploaded_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_documents_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_service_areas: {
        Row: {
          city: string | null
          created_at: string | null
          id: string
          postal_codes: string[] | null
          province: string | null
          vendor_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          id?: string
          postal_codes?: string[] | null
          province?: string | null
          vendor_id: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          id?: string
          postal_codes?: string[] | null
          province?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_service_areas_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_services: {
        Row: {
          base_price: number
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          min_callout_fee: number | null
          pricing_unit: string | null
          title: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          base_price?: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_callout_fee?: number | null
          pricing_unit?: string | null
          title: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          base_price?: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          min_callout_fee?: number | null
          pricing_unit?: string | null
          title?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_services_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_duplicate_id_number: {
        Args: { new_id_number: string; exclude_user_id?: string }
        Returns: boolean
      }
      check_email_exists: {
        Args: { email_to_check: string }
        Returns: boolean
      }
      check_id_exists: {
        Args: { id_num: string }
        Returns: boolean
      }
      check_id_exists_for_role: {
        Args: { id_num: string; user_role: string }
        Returns: boolean
      }
      check_id_number_exists_normalized: {
        Args: { id_num: string }
        Returns: {
          id_exists: boolean
          profile_count: number
          profile_details: Json
        }[]
      }
      get_profile_minimal: {
        Args: { uid: string }
        Returns: {
          id: string
          full_name: string
          email: string
        }[]
      }
      get_profiles_by_id_and_role: {
        Args: { id_num: string; user_role: string }
        Returns: {
          id: string
          full_name: string
          email: string
          role: string
          id_number: string
          created_at: string
        }[]
      }
      get_profiles_by_id_number: {
        Args: { id_num: string }
        Returns: {
          id: string
          full_name: string
          email: string
          role: string
          id_number: string
          created_at: string
        }[]
      }
      log_service_contract_event: {
        Args: { p_contract_id: string; p_event: string; p_data?: Json }
        Returns: undefined
      }
      log_tenancy_contract_event: {
        Args: { p_contract_id: string; p_event: string; p_data?: Json }
        Returns: undefined
      }
      search_tenants_by_name: {
        Args: { q: string }
        Returns: {
          id: string
          full_name: string
        }[]
      }
      validate_email_format: {
        Args: { email: string }
        Returns: boolean
      }
    }
    Enums: {
      inspection_type: "move_in" | "routine" | "move_out"
      maintenance_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "completed"
        | "closed"
      payment_status: "pending" | "paid" | "overdue" | "failed"
      property_status: "available" | "occupied" | "maintenance" | "vacant"
      user_role: "tenant" | "owner" | "vendor" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      inspection_type: ["move_in", "routine", "move_out"],
      maintenance_status: [
        "open",
        "assigned",
        "in_progress",
        "completed",
        "closed",
      ],
      payment_status: ["pending", "paid", "overdue", "failed"],
      property_status: ["available", "occupied", "maintenance", "vacant"],
      user_role: ["tenant", "owner", "vendor", "admin"],
    },
  },
} as const
