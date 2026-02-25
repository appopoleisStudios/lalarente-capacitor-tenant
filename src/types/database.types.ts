export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      arrears_escalations: {
        Row: {
          amount_owed: number
          breach_notice_url: string | null
          created_at: string | null
          cure_period_ends_at: string | null
          cure_period_starts_at: string | null
          demand_letter_url: string | null
          escalated_at: string
          id: string
          interest_accrued: number | null
          lease_id: string
          notes: string | null
          notification_method: string | null
          notification_sent: boolean | null
          notification_sent_at: string | null
          owner_id: string
          payment_id: string
          property_id: string
          resolved_at: string | null
          stage: string
          tenant_id: string
          total_owed: number
          updated_at: string | null
        }
        Insert: {
          amount_owed: number
          breach_notice_url?: string | null
          created_at?: string | null
          cure_period_ends_at?: string | null
          cure_period_starts_at?: string | null
          demand_letter_url?: string | null
          escalated_at?: string
          id?: string
          interest_accrued?: number | null
          lease_id: string
          notes?: string | null
          notification_method?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          owner_id: string
          payment_id: string
          property_id: string
          resolved_at?: string | null
          stage: string
          tenant_id: string
          total_owed: number
          updated_at?: string | null
        }
        Update: {
          amount_owed?: number
          breach_notice_url?: string | null
          created_at?: string | null
          cure_period_ends_at?: string | null
          cure_period_starts_at?: string | null
          demand_letter_url?: string | null
          escalated_at?: string
          id?: string
          interest_accrued?: number | null
          lease_id?: string
          notes?: string | null
          notification_method?: string | null
          notification_sent?: boolean | null
          notification_sent_at?: string | null
          owner_id?: string
          payment_id?: string
          property_id?: string
          resolved_at?: string | null
          stage?: string
          tenant_id?: string
          total_owed?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrears_escalations_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrears_escalations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrears_escalations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrears_escalations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrears_escalations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      closure_mediation_messages: {
        Row: {
          closure_report_id: string
          created_at: string | null
          id: string
          message: string
          photos: string[] | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          closure_report_id: string
          created_at?: string | null
          id?: string
          message: string
          photos?: string[] | null
          sender_id: string
          sender_role: string
        }
        Update: {
          closure_report_id?: string
          created_at?: string | null
          id?: string
          message?: string
          photos?: string[] | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "closure_mediation_messages_closure_report_id_fkey"
            columns: ["closure_report_id"]
            isOneToOne: false
            referencedRelation: "closure_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      closure_reports: {
        Row: {
          auto_approve_at: string | null
          closed_at: string | null
          completion_notes: string | null
          completion_photos: string[] | null
          created_at: string | null
          forwarded_to_tenant_at: string | null
          id: string
          maintenance_request_id: string
          mediation_reason: string | null
          mediation_required: boolean | null
          owner_accept_at: string | null
          owner_override_at: string | null
          owner_override_reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_count: number | null
          rejection_reason: string | null
          status: string | null
          tenant_ack_at: string | null
          tenant_notes: string | null
          tenant_rejection_photos: string[] | null
          tenant_verification_status: string | null
          updated_at: string | null
          vendor_notes: string | null
        }
        Insert: {
          auto_approve_at?: string | null
          closed_at?: string | null
          completion_notes?: string | null
          completion_photos?: string[] | null
          created_at?: string | null
          forwarded_to_tenant_at?: string | null
          id?: string
          maintenance_request_id: string
          mediation_reason?: string | null
          mediation_required?: boolean | null
          owner_accept_at?: string | null
          owner_override_at?: string | null
          owner_override_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_count?: number | null
          rejection_reason?: string | null
          status?: string | null
          tenant_ack_at?: string | null
          tenant_notes?: string | null
          tenant_rejection_photos?: string[] | null
          tenant_verification_status?: string | null
          updated_at?: string | null
          vendor_notes?: string | null
        }
        Update: {
          auto_approve_at?: string | null
          closed_at?: string | null
          completion_notes?: string | null
          completion_photos?: string[] | null
          created_at?: string | null
          forwarded_to_tenant_at?: string | null
          id?: string
          maintenance_request_id?: string
          mediation_reason?: string | null
          mediation_required?: boolean | null
          owner_accept_at?: string | null
          owner_override_at?: string | null
          owner_override_reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_count?: number | null
          rejection_reason?: string | null
          status?: string | null
          tenant_ack_at?: string | null
          tenant_notes?: string | null
          tenant_rejection_photos?: string[] | null
          tenant_verification_status?: string | null
          updated_at?: string | null
          vendor_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closure_reports_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "closure_reports_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      co_applicants: {
        Row: {
          created_at: string | null
          date_of_birth: string
          email: string
          full_name: string
          id: string
          id_number: string
          monthly_income: number | null
          phone: string
          primary_application_id: string
          relationship_to_primary: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth: string
          email: string
          full_name: string
          id?: string
          id_number: string
          monthly_income?: number | null
          phone: string
          primary_application_id: string
          relationship_to_primary?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string
          email?: string
          full_name?: string
          id?: string
          id_number?: string
          monthly_income?: number | null
          phone?: string
          primary_application_id?: string
          relationship_to_primary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "co_applicants_primary_application_id_fkey"
            columns: ["primary_application_id"]
            isOneToOne: false
            referencedRelation: "rental_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_applicants_primary_application_id_fkey"
            columns: ["primary_application_id"]
            isOneToOne: false
            referencedRelation: "rental_applications_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          capture_method: string
          consent_text: string
          consent_type: string
          created_at: string | null
          device_id: string | null
          expires_at: string | null
          granted_at: string
          id: string
          ip_address: unknown
          privacy_notice_version: string
          status: string
          updated_at: string | null
          user_agent: string | null
          user_id: string
          withdrawn_at: string | null
        }
        Insert: {
          capture_method: string
          consent_text: string
          consent_type: string
          created_at?: string | null
          device_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          ip_address?: unknown
          privacy_notice_version?: string
          status?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
          withdrawn_at?: string | null
        }
        Update: {
          capture_method?: string
          consent_text?: string
          consent_type?: string
          created_at?: string | null
          device_id?: string | null
          expires_at?: string | null
          granted_at?: string
          id?: string
          ip_address?: unknown
          privacy_notice_version?: string
          status?: string
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_documents: {
        Row: {
          contract_id: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_primary: boolean | null
          mime_type: string | null
          notes: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          version: number | null
        }
        Insert: {
          contract_id: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Update: {
          contract_id?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          notes?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_management_audit_logs: {
        Row: {
          actor_id: string | null
          contract_id: string
          created_at: string | null
          event: string
          id: string
          new_values: Json | null
          old_values: Json | null
        }
        Insert: {
          actor_id?: string | null
          contract_id: string
          created_at?: string | null
          event: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Update: {
          actor_id?: string | null
          contract_id?: string
          created_at?: string | null
          event?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_management_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_management_audit_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_notifications: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          notification_type: string
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          notification_type: string
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          notification_type?: string
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_notifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      data_access_requests: {
        Row: {
          created_at: string | null
          deadline_at: string
          description: string | null
          export_file_url: string | null
          export_format: string | null
          export_generated_at: string | null
          id: string
          identity_verified: boolean | null
          received_at: string
          rejection_reason: string | null
          request_type: string
          responded_at: string | null
          response_notes: string | null
          status: string
          updated_at: string | null
          user_id: string
          verification_method: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string | null
          deadline_at: string
          description?: string | null
          export_file_url?: string | null
          export_format?: string | null
          export_generated_at?: string | null
          id?: string
          identity_verified?: boolean | null
          received_at?: string
          rejection_reason?: string | null
          request_type?: string
          responded_at?: string | null
          response_notes?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string | null
          deadline_at?: string
          description?: string | null
          export_file_url?: string | null
          export_format?: string | null
          export_generated_at?: string | null
          id?: string
          identity_verified?: boolean | null
          received_at?: string
          rejection_reason?: string | null
          request_type?: string
          responded_at?: string | null
          response_notes?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          verification_method?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "data_access_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_correction_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_value: string | null
          field_name: string
          id: string
          justification: string | null
          rejection_reason: string | null
          requested_value: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: string | null
          field_name: string
          id?: string
          justification?: string | null
          rejection_reason?: string | null
          requested_value: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: string | null
          field_name?: string
          id?: string
          justification?: string | null
          rejection_reason?: string | null
          requested_value?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_correction_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      data_deletion_requests: {
        Row: {
          created_at: string | null
          data_retained: Json | null
          deletion_certificate_url: string | null
          executed_at: string | null
          id: string
          reason: string | null
          rejection_reason: string | null
          retention_check_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          specific_categories: string[] | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data_retained?: Json | null
          deletion_certificate_url?: string | null
          executed_at?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          retention_check_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          specific_categories?: string[] | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          data_retained?: Json | null
          deletion_certificate_url?: string | null
          executed_at?: string | null
          id?: string
          reason?: string | null
          rejection_reason?: string | null
          retention_check_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          specific_categories?: string[] | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_deletion_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dedicated_vendors: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          priority: number | null
          property_id: string
          vendor_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          property_id: string
          vendor_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          priority?: number | null
          property_id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dedicated_vendors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dedicated_vendors_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dedicated_vendors_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_deductions: {
        Row: {
          amount: number
          created_at: string | null
          deduction_type: string
          description: string
          evidence_urls: string[] | null
          id: string
          lease_id: string
          owner_id: string
          status: string
          tenant_agreed: boolean | null
          tenant_dispute_reason: string | null
          tenant_id: string
          tenant_response_at: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          deduction_type: string
          description: string
          evidence_urls?: string[] | null
          id?: string
          lease_id: string
          owner_id: string
          status?: string
          tenant_agreed?: boolean | null
          tenant_dispute_reason?: string | null
          tenant_id: string
          tenant_response_at?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          deduction_type?: string
          description?: string
          evidence_urls?: string[] | null
          id?: string
          lease_id?: string
          owner_id?: string
          status?: string
          tenant_agreed?: boolean | null
          tenant_dispute_reason?: string | null
          tenant_id?: string
          tenant_response_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_deductions_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_deductions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_deductions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_disputes: {
        Row: {
          created_at: string | null
          description: string
          dispute_type: string
          disputed_amount: number
          escalated_to_rth_at: string | null
          id: string
          lease_id: string
          owner_id: string
          resolution_notes: string | null
          resolved_amount: number | null
          resolved_at: string | null
          rth_case_number: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          dispute_type: string
          disputed_amount: number
          escalated_to_rth_at?: string | null
          id?: string
          lease_id: string
          owner_id: string
          resolution_notes?: string | null
          resolved_amount?: number | null
          resolved_at?: string | null
          rth_case_number?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          dispute_type?: string
          disputed_amount?: number
          escalated_to_rth_at?: string | null
          id?: string
          lease_id?: string
          owner_id?: string
          resolution_notes?: string | null
          resolved_amount?: number | null
          resolved_at?: string | null
          rth_case_number?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_disputes_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_disputes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_disputes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_interest_accruals: {
        Row: {
          accrual_period_end: string
          accrual_period_start: string
          balance_after_interest: number
          calculated_at: string
          created_at: string | null
          cumulative_interest: number
          deposit_amount: number
          id: string
          interest_earned: number
          interest_rate: number
          lease_id: string
          tenant_id: string
        }
        Insert: {
          accrual_period_end: string
          accrual_period_start: string
          balance_after_interest: number
          calculated_at?: string
          created_at?: string | null
          cumulative_interest: number
          deposit_amount: number
          id?: string
          interest_earned: number
          interest_rate: number
          lease_id: string
          tenant_id: string
        }
        Update: {
          accrual_period_end?: string
          accrual_period_start?: string
          balance_after_interest?: number
          calculated_at?: string
          created_at?: string | null
          cumulative_interest?: number
          deposit_amount?: number
          id?: string
          interest_earned?: number
          interest_rate?: number
          lease_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_interest_accruals_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_interest_accruals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_access_log: {
        Row: {
          accessed_at: string | null
          accessed_by: string
          document_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
        }
        Insert: {
          accessed_at?: string | null
          accessed_by: string
          document_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Update: {
          accessed_at?: string | null
          accessed_by?: string
          document_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_accessed_by_fkey"
            columns: ["accessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          access_level: string
          created_at: string | null
          delete_after: string | null
          description: string | null
          encrypted: boolean | null
          file_size: number
          file_url: string
          filename: string
          id: string
          last_accessed_at: string | null
          lease_id: string | null
          mime_type: string
          owner_id: string | null
          property_id: string | null
          retention_period_years: number
          tags: string[] | null
          tenant_id: string | null
          title: string
          type: string
          uploaded_by: string
        }
        Insert: {
          access_level: string
          created_at?: string | null
          delete_after?: string | null
          description?: string | null
          encrypted?: boolean | null
          file_size: number
          file_url: string
          filename: string
          id?: string
          last_accessed_at?: string | null
          lease_id?: string | null
          mime_type: string
          owner_id?: string | null
          property_id?: string | null
          retention_period_years: number
          tags?: string[] | null
          tenant_id?: string | null
          title: string
          type: string
          uploaded_by: string
        }
        Update: {
          access_level?: string
          created_at?: string | null
          delete_after?: string | null
          description?: string | null
          encrypted?: boolean | null
          file_size?: number
          file_url?: string
          filename?: string
          id?: string
          last_accessed_at?: string | null
          lease_id?: string | null
          mime_type?: string
          owner_id?: string | null
          property_id?: string | null
          retention_period_years?: number
          tags?: string[] | null
          tenant_id?: string | null
          title?: string
          type?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holding_deposits: {
        Row: {
          amount: number
          application_id: string | null
          applied_at: string | null
          created_at: string | null
          decision_deadline: string | null
          forfeited_at: string | null
          hold_expires_at: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_deadline: string | null
          payment_method: string | null
          payment_reference: string | null
          property_id: string
          refund_reason: string | null
          refunded_at: string | null
          status: string
          tenant_id: string
          transaction_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          application_id?: string | null
          applied_at?: string | null
          created_at?: string | null
          decision_deadline?: string | null
          forfeited_at?: string | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          property_id: string
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          tenant_id: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          application_id?: string | null
          applied_at?: string | null
          created_at?: string | null
          decision_deadline?: string | null
          forfeited_at?: string | null
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_deadline?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          property_id?: string
          refund_reason?: string | null
          refunded_at?: string | null
          status?: string
          tenant_id?: string
          transaction_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holding_deposits_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rental_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_deposits_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rental_applications_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_deposits_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holding_deposits_tenant_id_fkey"
            columns: ["tenant_id"]
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
        ]
      }
      inspection_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          inspection_id: string
          issue_severity: string | null
          photo_url: string
          room_name: string
          thumbnail_url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          inspection_id: string
          issue_severity?: string | null
          photo_url: string
          room_name: string
          thumbnail_url: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          inspection_id?: string
          issue_severity?: string | null
          photo_url?: string
          room_name?: string
          thumbnail_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_photos_inspection_id_fkey"
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
          inspector_id: string | null
          lease_id: string | null
          notes: string | null
          overall_condition: string | null
          owner_id: string
          owner_signature_url: string | null
          owner_signed_at: string | null
          property_id: string
          report_url: string | null
          rooms: Json
          scheduled_date: string
          status: string
          tenant_id: string
          tenant_signature_url: string | null
          tenant_signed_at: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          completed_date?: string | null
          created_at?: string | null
          id?: string
          inspector_id?: string | null
          lease_id?: string | null
          notes?: string | null
          overall_condition?: string | null
          owner_id: string
          owner_signature_url?: string | null
          owner_signed_at?: string | null
          property_id: string
          report_url?: string | null
          rooms?: Json
          scheduled_date: string
          status?: string
          tenant_id: string
          tenant_signature_url?: string | null
          tenant_signed_at?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          completed_date?: string | null
          created_at?: string | null
          id?: string
          inspector_id?: string | null
          lease_id?: string | null
          notes?: string | null
          overall_condition?: string | null
          owner_id?: string
          owner_signature_url?: string | null
          owner_signed_at?: string | null
          property_id?: string
          report_url?: string | null
          rooms?: Json
          scheduled_date?: string
          status?: string
          tenant_id?: string
          tenant_signature_url?: string | null
          tenant_signed_at?: string | null
          type?: string
          updated_at?: string | null
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
            foreignKeyName: "inspections_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_owner_id_fkey"
            columns: ["owner_id"]
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
      insurance_claim_documents: {
        Row: {
          claim_id: string
          created_at: string | null
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          title: string
          uploaded_by: string
        }
        Insert: {
          claim_id: string
          created_at?: string | null
          document_type: string
          file_size?: number | null
          file_url: string
          id?: string
          title: string
          uploaded_by: string
        }
        Update: {
          claim_id?: string
          created_at?: string | null
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claim_documents_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "insurance_claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claim_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_claims: {
        Row: {
          acknowledged_at: string | null
          approved_amount: number | null
          approved_at: string | null
          assessment_date: string | null
          assessment_notes: string | null
          assessor_contact: string | null
          assessor_name: string | null
          claim_number: string | null
          claim_type: string
          claimed_amount: number | null
          closed_at: string | null
          created_at: string | null
          description: string
          estimated_cost: number
          excess_paid: number | null
          id: string
          incident_date: string
          maintenance_request_id: string | null
          notes: string | null
          owner_id: string
          paid_out_at: string | null
          payout_received: number | null
          policy_id: string
          property_id: string
          rejection_reason: string | null
          status: string
          submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          assessment_date?: string | null
          assessment_notes?: string | null
          assessor_contact?: string | null
          assessor_name?: string | null
          claim_number?: string | null
          claim_type: string
          claimed_amount?: number | null
          closed_at?: string | null
          created_at?: string | null
          description: string
          estimated_cost: number
          excess_paid?: number | null
          id?: string
          incident_date: string
          maintenance_request_id?: string | null
          notes?: string | null
          owner_id: string
          paid_out_at?: string | null
          payout_received?: number | null
          policy_id: string
          property_id: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          approved_amount?: number | null
          approved_at?: string | null
          assessment_date?: string | null
          assessment_notes?: string | null
          assessor_contact?: string | null
          assessor_name?: string | null
          claim_number?: string | null
          claim_type?: string
          claimed_amount?: number | null
          closed_at?: string | null
          created_at?: string | null
          description?: string
          estimated_cost?: number
          excess_paid?: number | null
          id?: string
          incident_date?: string
          maintenance_request_id?: string | null
          notes?: string | null
          owner_id?: string
          paid_out_at?: string | null
          payout_received?: number | null
          policy_id?: string
          property_id?: string
          rejection_reason?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_claims_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "insurance_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_claims_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_policies: {
        Row: {
          cover_amount: number | null
          created_at: string | null
          end_date: string
          excess_amount: number | null
          id: string
          insurer_contact: string | null
          insurer_email: string | null
          insurer_name: string
          notes: string | null
          owner_id: string
          policy_document_url: string | null
          policy_number: string
          policy_type: string
          premium_amount: number | null
          premium_frequency: string | null
          property_id: string
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          cover_amount?: number | null
          created_at?: string | null
          end_date: string
          excess_amount?: number | null
          id?: string
          insurer_contact?: string | null
          insurer_email?: string | null
          insurer_name: string
          notes?: string | null
          owner_id: string
          policy_document_url?: string | null
          policy_number: string
          policy_type: string
          premium_amount?: number | null
          premium_frequency?: string | null
          property_id: string
          start_date: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          cover_amount?: number | null
          created_at?: string | null
          end_date?: string
          excess_amount?: number | null
          id?: string
          insurer_contact?: string | null
          insurer_email?: string | null
          insurer_name?: string
          notes?: string | null
          owner_id?: string
          policy_document_url?: string | null
          policy_number?: string
          policy_type?: string
          premium_amount?: number | null
          premium_frequency?: string | null
          property_id?: string
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_policies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_policies_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      job_attachments: {
        Row: {
          execution_id: string
          id: string
          kind: string
          url: string
        }
        Insert: {
          execution_id: string
          id?: string
          kind: string
          url: string
        }
        Update: {
          execution_id?: string
          id?: string
          kind?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_attachments_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "job_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      job_executions: {
        Row: {
          contract_id: string
          created_at: string | null
          end_at: string | null
          id: string
          notes: string | null
          sla_window_end: string | null
          sla_window_start: string | null
          start_at: string | null
          status: string
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          end_at?: string | null
          id?: string
          notes?: string | null
          sla_window_end?: string | null
          sla_window_start?: string | null
          start_at?: string | null
          status?: string
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          end_at?: string | null
          id?: string
          notes?: string | null
          sla_window_end?: string | null
          sla_window_start?: string | null
          start_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_executions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_progress_updates: {
        Row: {
          created_at: string | null
          id: string
          maintenance_request_id: string
          notes: string | null
          photos: string[] | null
          update_date: string
          updated_at: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          maintenance_request_id: string
          notes?: string | null
          photos?: string[] | null
          update_date: string
          updated_at?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          maintenance_request_id?: string
          notes?: string | null
          photos?: string[] | null
          update_date?: string
          updated_at?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_progress_updates_maintenance_request_id_fkey"
            columns: ["maintenance_request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_progress_updates_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      key_handovers: {
        Row: {
          access_cards: Json | null
          access_codes: Json | null
          created_at: string | null
          handed_over_by: string
          handover_date: string
          id: string
          lease_id: string
          missing_items: string[] | null
          notes: string | null
          physical_keys: Json | null
          property_id: string
          received_by: string
          replacement_cost: number | null
          returned_date: string | null
          signature_url: string | null
          type: string
        }
        Insert: {
          access_cards?: Json | null
          access_codes?: Json | null
          created_at?: string | null
          handed_over_by: string
          handover_date: string
          id?: string
          lease_id: string
          missing_items?: string[] | null
          notes?: string | null
          physical_keys?: Json | null
          property_id: string
          received_by: string
          replacement_cost?: number | null
          returned_date?: string | null
          signature_url?: string | null
          type: string
        }
        Update: {
          access_cards?: Json | null
          access_codes?: Json | null
          created_at?: string | null
          handed_over_by?: string
          handover_date?: string
          id?: string
          lease_id?: string
          missing_items?: string[] | null
          notes?: string | null
          physical_keys?: Json | null
          property_id?: string
          received_by?: string
          replacement_cost?: number | null
          returned_date?: string | null
          signature_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_handovers_handed_over_by_fkey"
            columns: ["handed_over_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_handovers_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_handovers_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_handovers_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lease_addendums: {
        Row: {
          changes: Json
          created_at: string | null
          description: string
          effective_date: string
          id: string
          lease_id: string
          owner_signed_at: string | null
          tenant_signed_at: string | null
          type: string
        }
        Insert: {
          changes: Json
          created_at?: string | null
          description: string
          effective_date: string
          id?: string
          lease_id: string
          owner_signed_at?: string | null
          tenant_signed_at?: string | null
          type: string
        }
        Update: {
          changes?: Json
          created_at?: string | null
          description?: string
          effective_date?: string
          id?: string
          lease_id?: string
          owner_signed_at?: string | null
          tenant_signed_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lease_addendums_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
        ]
      }
      leases: {
        Row: {
          application_id: string | null
          auto_converted_to_mtm: boolean | null
          converted_to_mtm_at: string | null
          created_at: string | null
          deposit_account_number: string | null
          deposit_amount: number | null
          deposit_bank_name: string | null
          deposit_interest_rate: number | null
          deposit_refund_amount: number | null
          deposit_refund_deadline: string | null
          deposit_refund_status: string | null
          deposit_refunded_at: string | null
          deposit_total_interest: number | null
          document_template_id: string | null
          early_termination_effective_date: string | null
          early_termination_notice_period_days: number | null
          early_termination_penalty: number | null
          early_termination_reason: string | null
          early_termination_requested_at: string | null
          early_termination_requested_by: string | null
          end_date: string
          escalation_history: Json | null
          executed_at: string | null
          id: string
          interest_on_arrears_rate: number | null
          last_escalation_amount: number | null
          last_escalation_date: string | null
          lease_document_url: string | null
          lease_type: string | null
          monthly_rent: number
          next_escalation_date: string | null
          notice_40_sent_at: string | null
          notice_60_sent_at: string | null
          notice_80_sent_at: string | null
          original_lease_id: string | null
          owner_id: string | null
          owner_signature_url: string | null
          owner_signed_at: string | null
          payment_due_day: number | null
          property_id: string | null
          renewal_count: number | null
          rent_escalation_frequency_months: number | null
          rent_escalation_type: string | null
          rent_escalation_value: number | null
          start_date: string
          status: string | null
          tenant_id: string | null
          tenant_renewal_response: string | null
          tenant_response_at: string | null
          tenant_signature_url: string | null
          tenant_signed_at: string | null
          terminated_at: string | null
          updated_at: string | null
        }
        Insert: {
          application_id?: string | null
          auto_converted_to_mtm?: boolean | null
          converted_to_mtm_at?: string | null
          created_at?: string | null
          deposit_account_number?: string | null
          deposit_amount?: number | null
          deposit_bank_name?: string | null
          deposit_interest_rate?: number | null
          deposit_refund_amount?: number | null
          deposit_refund_deadline?: string | null
          deposit_refund_status?: string | null
          deposit_refunded_at?: string | null
          deposit_total_interest?: number | null
          document_template_id?: string | null
          early_termination_effective_date?: string | null
          early_termination_notice_period_days?: number | null
          early_termination_penalty?: number | null
          early_termination_reason?: string | null
          early_termination_requested_at?: string | null
          early_termination_requested_by?: string | null
          end_date: string
          escalation_history?: Json | null
          executed_at?: string | null
          id?: string
          interest_on_arrears_rate?: number | null
          last_escalation_amount?: number | null
          last_escalation_date?: string | null
          lease_document_url?: string | null
          lease_type?: string | null
          monthly_rent: number
          next_escalation_date?: string | null
          notice_40_sent_at?: string | null
          notice_60_sent_at?: string | null
          notice_80_sent_at?: string | null
          original_lease_id?: string | null
          owner_id?: string | null
          owner_signature_url?: string | null
          owner_signed_at?: string | null
          payment_due_day?: number | null
          property_id?: string | null
          renewal_count?: number | null
          rent_escalation_frequency_months?: number | null
          rent_escalation_type?: string | null
          rent_escalation_value?: number | null
          start_date: string
          status?: string | null
          tenant_id?: string | null
          tenant_renewal_response?: string | null
          tenant_response_at?: string | null
          tenant_signature_url?: string | null
          tenant_signed_at?: string | null
          terminated_at?: string | null
          updated_at?: string | null
        }
        Update: {
          application_id?: string | null
          auto_converted_to_mtm?: boolean | null
          converted_to_mtm_at?: string | null
          created_at?: string | null
          deposit_account_number?: string | null
          deposit_amount?: number | null
          deposit_bank_name?: string | null
          deposit_interest_rate?: number | null
          deposit_refund_amount?: number | null
          deposit_refund_deadline?: string | null
          deposit_refund_status?: string | null
          deposit_refunded_at?: string | null
          deposit_total_interest?: number | null
          document_template_id?: string | null
          early_termination_effective_date?: string | null
          early_termination_notice_period_days?: number | null
          early_termination_penalty?: number | null
          early_termination_reason?: string | null
          early_termination_requested_at?: string | null
          early_termination_requested_by?: string | null
          end_date?: string
          escalation_history?: Json | null
          executed_at?: string | null
          id?: string
          interest_on_arrears_rate?: number | null
          last_escalation_amount?: number | null
          last_escalation_date?: string | null
          lease_document_url?: string | null
          lease_type?: string | null
          monthly_rent?: number
          next_escalation_date?: string | null
          notice_40_sent_at?: string | null
          notice_60_sent_at?: string | null
          notice_80_sent_at?: string | null
          original_lease_id?: string | null
          owner_id?: string | null
          owner_signature_url?: string | null
          owner_signed_at?: string | null
          payment_due_day?: number | null
          property_id?: string | null
          renewal_count?: number | null
          rent_escalation_frequency_months?: number | null
          rent_escalation_type?: string | null
          rent_escalation_value?: number | null
          start_date?: string
          status?: string | null
          tenant_id?: string | null
          tenant_renewal_response?: string | null
          tenant_response_at?: string | null
          tenant_signature_url?: string | null
          tenant_signed_at?: string | null
          terminated_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leases_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rental_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "rental_applications_with_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_early_termination_requested_by_fkey"
            columns: ["early_termination_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_original_lease_id_fkey"
            columns: ["original_lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      maintenance_request_audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string | null
          data: Json | null
          event: string
          id: string
          request_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          event: string
          id?: string
          request_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          event?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_request_audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_request_audit_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          acknowledged_at: string | null
          actual_cost: number | null
          category_id: string | null
          closure_approved_at: string | null
          closure_requested_at: string | null
          completed_date: string | null
          created_at: string | null
          description: string
          estimated_cost: number | null
          id: string
          images: string[] | null
          mms_status: string | null
          owner_id: string | null
          po_id: string | null
          priority: string | null
          property_id: string | null
          quote_deadline: string | null
          scheduled_date: string | null
          selected_quote_id: string | null
          selected_vendor_id: string | null
          status: Database["public"]["Enums"]["maintenance_status"] | null
          tenant_id: string | null
          title: string
          vendor_id: string | null
          vendor_routed_at: string | null
          visibility: string | null
          work_can_start: boolean | null
          work_started_at: string | null
          work_started_by: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          actual_cost?: number | null
          category_id?: string | null
          closure_approved_at?: string | null
          closure_requested_at?: string | null
          completed_date?: string | null
          created_at?: string | null
          description: string
          estimated_cost?: number | null
          id?: string
          images?: string[] | null
          mms_status?: string | null
          owner_id?: string | null
          po_id?: string | null
          priority?: string | null
          property_id?: string | null
          quote_deadline?: string | null
          scheduled_date?: string | null
          selected_quote_id?: string | null
          selected_vendor_id?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"] | null
          tenant_id?: string | null
          title: string
          vendor_id?: string | null
          vendor_routed_at?: string | null
          visibility?: string | null
          work_can_start?: boolean | null
          work_started_at?: string | null
          work_started_by?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          actual_cost?: number | null
          category_id?: string | null
          closure_approved_at?: string | null
          closure_requested_at?: string | null
          completed_date?: string | null
          created_at?: string | null
          description?: string
          estimated_cost?: number | null
          id?: string
          images?: string[] | null
          mms_status?: string | null
          owner_id?: string | null
          po_id?: string | null
          priority?: string | null
          property_id?: string | null
          quote_deadline?: string | null
          scheduled_date?: string | null
          selected_quote_id?: string | null
          selected_vendor_id?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"] | null
          tenant_id?: string | null
          title?: string
          vendor_id?: string | null
          vendor_routed_at?: string | null
          visibility?: string | null
          work_can_start?: boolean | null
          work_started_at?: string | null
          work_started_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_selected_quote_id_fkey"
            columns: ["selected_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_selected_vendor_id_fkey"
            columns: ["selected_vendor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "maintenance_requests_work_started_by_fkey"
            columns: ["work_started_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          file_size: number
          file_url: string
          filename: string
          id: string
          message_id: string
          mime_type: string
        }
        Insert: {
          created_at?: string | null
          file_size: number
          file_url: string
          filename: string
          id?: string
          message_id: string
          mime_type: string
        }
        Update: {
          created_at?: string | null
          file_size?: number
          file_url?: string
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          category: string
          created_at: string | null
          id: string
          last_message_at: string | null
          lease_id: string | null
          owner_id: string
          property_id: string | null
          status: string
          subject: string
          tenant_id: string
          unread_count_owner: number | null
          unread_count_tenant: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lease_id?: string | null
          owner_id: string
          property_id?: string | null
          status?: string
          subject: string
          tenant_id: string
          unread_count_owner?: number | null
          unread_count_tenant?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          last_message_at?: string | null
          lease_id?: string | null
          owner_id?: string
          property_id?: string | null
          status?: string
          subject?: string
          tenant_id?: string
          unread_count_owner?: number | null
          unread_count_tenant?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          delivered_at: string | null
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role: string
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          id: string
          preferences: Json | null
          push_enabled: boolean | null
          sms_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          preferences?: Json | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          id?: string
          preferences?: Json | null
          push_enabled?: boolean | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_arrangements: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          amount_paid: number | null
          created_at: string | null
          end_date: string
          id: string
          instalments_paid: number | null
          lease_id: string
          monthly_instalment: number
          next_due_date: string | null
          notes: string | null
          number_of_instalments: number
          owner_id: string
          proposed_by: string
          start_date: string
          status: string
          tenant_id: string
          total_owed: number
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          amount_paid?: number | null
          created_at?: string | null
          end_date: string
          id?: string
          instalments_paid?: number | null
          lease_id: string
          monthly_instalment: number
          next_due_date?: string | null
          notes?: string | null
          number_of_instalments: number
          owner_id: string
          proposed_by: string
          start_date: string
          status?: string
          tenant_id: string
          total_owed: number
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          amount_paid?: number | null
          created_at?: string | null
          end_date?: string
          id?: string
          instalments_paid?: number | null
          lease_id?: string
          monthly_instalment?: number
          next_due_date?: string | null
          notes?: string | null
          number_of_instalments?: number
          owner_id?: string
          proposed_by?: string
          start_date?: string
          status?: string
          tenant_id?: string
          total_owed?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_arrangements_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_arrangements_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_arrangements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_arrangements_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_arrangements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_disputes: {
        Row: {
          created_at: string | null
          description: string
          disputed_amount: number
          evidence_urls: string[] | null
          id: string
          lease_id: string
          payment_id: string
          raised_by: string
          reason: string
          resolution_amount: number | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          disputed_amount: number
          evidence_urls?: string[] | null
          id?: string
          lease_id: string
          payment_id: string
          raised_by: string
          reason: string
          resolution_amount?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          disputed_amount?: number
          evidence_urls?: string[] | null
          id?: string
          lease_id?: string
          payment_id?: string
          raised_by?: string
          reason?: string
          resolution_amount?: number | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_disputes_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_disputes_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_schedules: {
        Row: {
          active: boolean | null
          amount: number
          auto_pay_enabled: boolean | null
          created_at: string | null
          end_date: string
          id: string
          lease_id: string
          next_payment_date: string
          payment_day: number
          payment_method_id: string | null
          start_date: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          amount: number
          auto_pay_enabled?: boolean | null
          created_at?: string | null
          end_date: string
          id?: string
          lease_id: string
          next_payment_date: string
          payment_day: number
          payment_method_id?: string | null
          start_date: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number
          auto_pay_enabled?: boolean | null
          created_at?: string | null
          end_date?: string
          id?: string
          lease_id?: string
          next_payment_date?: string
          payment_day?: number
          payment_method_id?: string | null
          start_date?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_schedules_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_schedules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_outstanding: number | null
          amount_paid: number | null
          created_at: string | null
          credit_balance: number | null
          days_overdue: number | null
          due_date: string
          failure_reason: string | null
          fee_paid_by: string | null
          id: string
          interest_amount: number | null
          interest_calculated_at: string | null
          last_retry_at: string | null
          lease_id: string
          max_retry_count: number | null
          next_retry_at: string | null
          notes: string | null
          original_amount: number | null
          owner_id: string
          paid_date: string | null
          parent_payment_id: string | null
          payment_gateway: string | null
          payment_method: string | null
          payment_variant: string | null
          property_id: string
          retry_count: number | null
          status: string
          tenant_id: string
          transaction_fee: number | null
          transaction_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          amount_outstanding?: number | null
          amount_paid?: number | null
          created_at?: string | null
          credit_balance?: number | null
          days_overdue?: number | null
          due_date: string
          failure_reason?: string | null
          fee_paid_by?: string | null
          id?: string
          interest_amount?: number | null
          interest_calculated_at?: string | null
          last_retry_at?: string | null
          lease_id: string
          max_retry_count?: number | null
          next_retry_at?: string | null
          notes?: string | null
          original_amount?: number | null
          owner_id: string
          paid_date?: string | null
          parent_payment_id?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_variant?: string | null
          property_id: string
          retry_count?: number | null
          status?: string
          tenant_id: string
          transaction_fee?: number | null
          transaction_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          amount_outstanding?: number | null
          amount_paid?: number | null
          created_at?: string | null
          credit_balance?: number | null
          days_overdue?: number | null
          due_date?: string
          failure_reason?: string | null
          fee_paid_by?: string | null
          id?: string
          interest_amount?: number | null
          interest_calculated_at?: string | null
          last_retry_at?: string | null
          lease_id?: string
          max_retry_count?: number | null
          next_retry_at?: string | null
          notes?: string | null
          original_amount?: number | null
          owner_id?: string
          paid_date?: string | null
          parent_payment_id?: string | null
          payment_gateway?: string | null
          payment_method?: string | null
          payment_variant?: string | null
          property_id?: string
          retry_count?: number | null
          status?: string
          tenant_id?: string
          transaction_fee?: number | null
          transaction_id?: string | null
          type?: string
          updated_at?: string | null
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
            foreignKeyName: "payments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_payment_id_fkey"
            columns: ["parent_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
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
      po_revisions: {
        Row: {
          created_at: string | null
          id: string
          platform_fee_amount: number | null
          po_id: string
          revised_by: string
          revision_number: number
          revision_reason: string | null
          subtotal: number | null
          total_amount: number | null
          vat_amount: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform_fee_amount?: number | null
          po_id: string
          revised_by: string
          revision_number: number
          revision_reason?: string | null
          subtotal?: number | null
          total_amount?: number | null
          vat_amount?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          platform_fee_amount?: number | null
          po_id?: string
          revised_by?: string
          revision_number?: number
          revision_reason?: string | null
          subtotal?: number | null
          total_amount?: number | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "po_revisions_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "po_revisions_revised_by_fkey"
            columns: ["revised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "privacy_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
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
          date_of_birth: string | null
          email: string | null
          employer: string | null
          employer_contact: string | null
          employment_start_date: string | null
          fica_documents: Json | null
          full_name: string
          id: string
          id_number: string | null
          monthly_income: number | null
          onboarding_owner_done: boolean
          onboarding_tenant_done: boolean
          onboarding_vendor_done: boolean
          phone: string | null
          position: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          verification_status: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bank_details?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          employer_contact?: string | null
          employment_start_date?: string | null
          fica_documents?: Json | null
          full_name: string
          id: string
          id_number?: string | null
          monthly_income?: number | null
          onboarding_owner_done?: boolean
          onboarding_tenant_done?: boolean
          onboarding_vendor_done?: boolean
          phone?: string | null
          position?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          verification_status?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bank_details?: Json | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          employer?: string | null
          employer_contact?: string | null
          employment_start_date?: string | null
          fica_documents?: Json | null
          full_name?: string
          id?: string
          id_number?: string | null
          monthly_income?: number | null
          onboarding_owner_done?: boolean
          onboarding_tenant_done?: boolean
          onboarding_vendor_done?: boolean
          phone?: string | null
          position?: string | null
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
          application_count: number | null
          assigned_vendor_id: string | null
          available_from: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string | null
          deposit_amount: number | null
          description: string | null
          id: string
          images: string[] | null
          inquiry_count: number | null
          latitude: number | null
          lease_terms: Json | null
          longitude: number | null
          minimum_lease_months: number | null
          owner_id: string
          parking_spaces: number | null
          pets_allowed: boolean | null
          postal_code: string | null
          property_type: string
          province: string
          rent_amount: number
          services_provided: string[] | null
          size_sqm: number | null
          smoking_allowed: boolean | null
          status: Database["public"]["Enums"]["property_status"] | null
          title: string
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          address: string
          amenities?: string[] | null
          application_count?: number | null
          assigned_vendor_id?: string | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          images?: string[] | null
          inquiry_count?: number | null
          latitude?: number | null
          lease_terms?: Json | null
          longitude?: number | null
          minimum_lease_months?: number | null
          owner_id: string
          parking_spaces?: number | null
          pets_allowed?: boolean | null
          postal_code?: string | null
          property_type: string
          province: string
          rent_amount: number
          services_provided?: string[] | null
          size_sqm?: number | null
          smoking_allowed?: boolean | null
          status?: Database["public"]["Enums"]["property_status"] | null
          title: string
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          address?: string
          amenities?: string[] | null
          application_count?: number | null
          assigned_vendor_id?: string | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string | null
          deposit_amount?: number | null
          description?: string | null
          id?: string
          images?: string[] | null
          inquiry_count?: number | null
          latitude?: number | null
          lease_terms?: Json | null
          longitude?: number | null
          minimum_lease_months?: number | null
          owner_id?: string
          parking_spaces?: number | null
          pets_allowed?: boolean | null
          postal_code?: string | null
          property_type?: string
          province?: string
          rent_amount?: number
          services_provided?: string[] | null
          size_sqm?: number | null
          smoking_allowed?: boolean | null
          status?: Database["public"]["Enums"]["property_status"] | null
          title?: string
          updated_at?: string | null
          view_count?: number | null
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
      property_amenities: {
        Row: {
          amenity: string
          created_at: string | null
          id: string
          is_custom: boolean | null
          property_id: string
          unit: string | null
          value: string | null
        }
        Insert: {
          amenity: string
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          property_id: string
          unit?: string | null
          value?: string | null
        }
        Update: {
          amenity?: string
          created_at?: string | null
          id?: string
          is_custom?: boolean | null
          property_id?: string
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
      property_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          deleted_at: string | null
          display_order: number
          file_size_bytes: number | null
          height_px: number | null
          id: string
          is_primary: boolean | null
          mime_type: string | null
          property_id: string
          storage_path: string | null
          thumbnail_url: string
          updated_at: string | null
          url: string
          width_px: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_order?: number
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          property_id: string
          storage_path?: string | null
          thumbnail_url: string
          updated_at?: string | null
          url: string
          width_px?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          deleted_at?: string | null
          display_order?: number
          file_size_bytes?: number | null
          height_px?: number | null
          id?: string
          is_primary?: boolean | null
          mime_type?: string | null
          property_id?: string
          storage_path?: string | null
          thumbnail_url?: string
          updated_at?: string | null
          url?: string
          width_px?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_waitlist: {
        Row: {
          created_at: string | null
          id: string
          notification_email: boolean | null
          notification_sms: boolean | null
          notified_at: string | null
          position: number | null
          property_id: string
          responded_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notification_email?: boolean | null
          notification_sms?: boolean | null
          notified_at?: string | null
          position?: number | null
          property_id: string
          responded_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notification_email?: boolean | null
          notification_sms?: boolean | null
          notified_at?: string | null
          position?: number | null
          property_id?: string
          responded_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_waitlist_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_waitlist_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          description: string
          id: string
          po_id: string
          qty: number
          tax_rate: number | null
          unit: string | null
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          po_id: string
          qty?: number
          tax_rate?: number | null
          unit?: string | null
          unit_price: number
        }
        Update: {
          description?: string
          id?: string
          po_id?: string
          qty?: number
          tax_rate?: number | null
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          contract_id: string | null
          created_at: string | null
          currency: string | null
          id: string
          pdf_url: string | null
          platform_fee_amount: number | null
          po_number: string
          revision_number: number | null
          revision_reason: string | null
          scheduled_start_date: string | null
          scheduled_start_time: string | null
          sent_by: string | null
          sent_to_vendor_at: string | null
          status: string
          subtotal: number | null
          total_amount: number | null
          updated_at: string | null
          vat_amount: number | null
          work_instructions: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          pdf_url?: string | null
          platform_fee_amount?: number | null
          po_number: string
          revision_number?: number | null
          revision_reason?: string | null
          scheduled_start_date?: string | null
          scheduled_start_time?: string | null
          sent_by?: string | null
          sent_to_vendor_at?: string | null
          status?: string
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          work_instructions?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          pdf_url?: string | null
          platform_fee_amount?: number | null
          po_number?: string
          revision_number?: number | null
          revision_reason?: string | null
          scheduled_start_date?: string | null
          scheduled_start_time?: string | null
          sent_by?: string | null
          sent_to_vendor_at?: string | null
          status?: string
          subtotal?: number | null
          total_amount?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          work_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "service_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_sent_by_fkey"
            columns: ["sent_by"]
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
      quote_revisions: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          quote_id: string
          revised_by: string
          revision_number: number
          revision_reason: string | null
          subtotal: number | null
          total_amount: number | null
          vat_amount: number | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          quote_id: string
          revised_by: string
          revision_number: number
          revision_reason?: string | null
          subtotal?: number | null
          total_amount?: number | null
          vat_amount?: number | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          quote_id?: string
          revised_by?: string
          revision_number?: number
          revision_reason?: string | null
          subtotal?: number | null
          total_amount?: number | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_revisions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_revisions_revised_by_fkey"
            columns: ["revised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          revision_number: number | null
          revision_reason: string | null
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
          revision_number?: number | null
          revision_reason?: string | null
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
          revision_number?: number | null
          revision_reason?: string | null
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
      refunds: {
        Row: {
          account_number: string | null
          amount: number
          bank_account_holder: string | null
          bank_name: string | null
          branch_code: string | null
          created_at: string | null
          deductions: Json | null
          id: string
          lease_id: string
          net_refund: number
          owner_id: string
          payment_id: string | null
          processed_at: string | null
          reason: string
          refund_method: string | null
          status: string
          tenant_id: string
          type: string
        }
        Insert: {
          account_number?: string | null
          amount: number
          bank_account_holder?: string | null
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string | null
          deductions?: Json | null
          id?: string
          lease_id: string
          net_refund: number
          owner_id: string
          payment_id?: string | null
          processed_at?: string | null
          reason: string
          refund_method?: string | null
          status?: string
          tenant_id: string
          type: string
        }
        Update: {
          account_number?: string | null
          amount?: number
          bank_account_holder?: string | null
          bank_name?: string | null
          branch_code?: string | null
          created_at?: string | null
          deductions?: Json | null
          id?: string
          lease_id?: string
          net_refund?: number
          owner_id?: string
          payment_id?: string | null
          processed_at?: string | null
          reason?: string
          refund_method?: string | null
          status?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_negotiations: {
        Row: {
          created_at: string | null
          id: string
          initiated_by: string
          lease_id: string
          owner_id: string
          proposed_duration_months: number | null
          proposed_escalation_rate: number | null
          proposed_lease_type: string
          proposed_monthly_rent: number
          proposed_start_date: string
          proposed_terms_notes: string | null
          response_at: string | null
          response_deadline: string | null
          response_notes: string | null
          round: number
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          initiated_by: string
          lease_id: string
          owner_id: string
          proposed_duration_months?: number | null
          proposed_escalation_rate?: number | null
          proposed_lease_type: string
          proposed_monthly_rent: number
          proposed_start_date: string
          proposed_terms_notes?: string | null
          response_at?: string | null
          response_deadline?: string | null
          response_notes?: string | null
          round?: number
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          initiated_by?: string
          lease_id?: string
          owner_id?: string
          proposed_duration_months?: number | null
          proposed_escalation_rate?: number | null
          proposed_lease_type?: string
          proposed_monthly_rent?: number
          proposed_start_date?: string
          proposed_terms_notes?: string | null
          response_at?: string | null
          response_deadline?: string | null
          response_notes?: string | null
          round?: number
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renewal_negotiations_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_negotiations_lease_id_fkey"
            columns: ["lease_id"]
            isOneToOne: false
            referencedRelation: "leases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_negotiations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_negotiations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rental_applications: {
        Row: {
          affordability_ratio: number | null
          application_score: number | null
          approved_at: string | null
          approved_by: string | null
          background_check_result: Json | null
          background_check_status: string | null
          backup_rank: number | null
          created_at: string | null
          credit_check_at: string | null
          credit_check_result: Json | null
          credit_check_status: string | null
          date_of_birth: string
          email: string
          employer: string | null
          employer_contact: string | null
          employment_start_date: string | null
          full_name: string
          holding_deposit_id: string | null
          id: string
          id_document_url: string | null
          id_number: string
          identity_verification_status: string | null
          monthly_income: number | null
          owner_id: string
          owner_notes: string | null
          phone: string
          position: string | null
          proof_of_income_urls: string[] | null
          property_id: string
          reference_urls: string[] | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          rental_history: Json | null
          reviewed_at: string | null
          risk_level: string | null
          score: number | null
          shortlisted: boolean | null
          shortlisted_at: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          tenant_notes: string | null
          updated_at: string | null
        }
        Insert: {
          affordability_ratio?: number | null
          application_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          background_check_result?: Json | null
          background_check_status?: string | null
          backup_rank?: number | null
          created_at?: string | null
          credit_check_at?: string | null
          credit_check_result?: Json | null
          credit_check_status?: string | null
          date_of_birth: string
          email: string
          employer?: string | null
          employer_contact?: string | null
          employment_start_date?: string | null
          full_name: string
          holding_deposit_id?: string | null
          id?: string
          id_document_url?: string | null
          id_number: string
          identity_verification_status?: string | null
          monthly_income?: number | null
          owner_id: string
          owner_notes?: string | null
          phone: string
          position?: string | null
          proof_of_income_urls?: string[] | null
          property_id: string
          reference_urls?: string[] | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          rental_history?: Json | null
          reviewed_at?: string | null
          risk_level?: string | null
          score?: number | null
          shortlisted?: boolean | null
          shortlisted_at?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          tenant_notes?: string | null
          updated_at?: string | null
        }
        Update: {
          affordability_ratio?: number | null
          application_score?: number | null
          approved_at?: string | null
          approved_by?: string | null
          background_check_result?: Json | null
          background_check_status?: string | null
          backup_rank?: number | null
          created_at?: string | null
          credit_check_at?: string | null
          credit_check_result?: Json | null
          credit_check_status?: string | null
          date_of_birth?: string
          email?: string
          employer?: string | null
          employer_contact?: string | null
          employment_start_date?: string | null
          full_name?: string
          holding_deposit_id?: string | null
          id?: string
          id_document_url?: string | null
          id_number?: string
          identity_verification_status?: string | null
          monthly_income?: number | null
          owner_id?: string
          owner_notes?: string | null
          phone?: string
          position?: string | null
          proof_of_income_urls?: string[] | null
          property_id?: string
          reference_urls?: string[] | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          rental_history?: Json | null
          reviewed_at?: string | null
          risk_level?: string | null
          score?: number | null
          shortlisted?: boolean | null
          shortlisted_at?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          tenant_notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_applications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_holding_deposit_id_fkey"
            columns: ["holding_deposit_id"]
            isOneToOne: false
            referencedRelation: "holding_deposits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_policies: {
        Row: {
          auto_delete: boolean | null
          created_at: string | null
          data_category: string
          description: string
          id: string
          legal_basis: string
          notify_before_delete_days: number | null
          retention_days: number
          updated_at: string | null
        }
        Insert: {
          auto_delete?: boolean | null
          created_at?: string | null
          data_category: string
          description: string
          id?: string
          legal_basis: string
          notify_before_delete_days?: number | null
          retention_days: number
          updated_at?: string | null
        }
        Update: {
          auto_delete?: boolean | null
          created_at?: string | null
          data_category?: string
          description?: string
          id?: string
          legal_basis?: string
          notify_before_delete_days?: number | null
          retention_days?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      sa_public_holidays: {
        Row: {
          created_at: string | null
          holiday_date: string
          holiday_name: string
          id: string
          is_observed: boolean | null
          original_date: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          holiday_date: string
          holiday_name: string
          id?: string
          is_observed?: boolean | null
          original_date?: string | null
          year?: number
        }
        Update: {
          created_at?: string | null
          holiday_date?: string
          holiday_name?: string
          id?: string
          is_observed?: boolean | null
          original_date?: string | null
          year?: number
        }
        Relationships: []
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
          ip_address: unknown
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: unknown
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: unknown
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
          actual_duration_hours: number | null
          auto_renew: boolean | null
          compiled_html: string | null
          compiled_variables: Json | null
          completion_date: string | null
          contract_type: string | null
          contract_value: number | null
          created_at: string | null
          end_date: string | null
          estimated_duration_hours: number | null
          id: string
          maintenance_request_id: string | null
          owner_feedback: string | null
          owner_id: string
          owner_notes: string | null
          owner_rating: number | null
          pdf_sha256: string | null
          pdf_url: string | null
          priority: string | null
          property_id: string
          renewal_date: string | null
          requires_tenant_signature: boolean | null
          sla_hours: number | null
          start_date: string | null
          status: string
          template_id: string | null
          tenant_id: string | null
          termination_notice_days: number | null
          terms: Json | null
          title: string
          updated_at: string | null
          vendor_feedback: string | null
          vendor_id: string
          vendor_notes: string | null
          vendor_rating: number | null
        }
        Insert: {
          actual_duration_hours?: number | null
          auto_renew?: boolean | null
          compiled_html?: string | null
          compiled_variables?: Json | null
          completion_date?: string | null
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          estimated_duration_hours?: number | null
          id?: string
          maintenance_request_id?: string | null
          owner_feedback?: string | null
          owner_id: string
          owner_notes?: string | null
          owner_rating?: number | null
          pdf_sha256?: string | null
          pdf_url?: string | null
          priority?: string | null
          property_id: string
          renewal_date?: string | null
          requires_tenant_signature?: boolean | null
          sla_hours?: number | null
          start_date?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          termination_notice_days?: number | null
          terms?: Json | null
          title: string
          updated_at?: string | null
          vendor_feedback?: string | null
          vendor_id: string
          vendor_notes?: string | null
          vendor_rating?: number | null
        }
        Update: {
          actual_duration_hours?: number | null
          auto_renew?: boolean | null
          compiled_html?: string | null
          compiled_variables?: Json | null
          completion_date?: string | null
          contract_type?: string | null
          contract_value?: number | null
          created_at?: string | null
          end_date?: string | null
          estimated_duration_hours?: number | null
          id?: string
          maintenance_request_id?: string | null
          owner_feedback?: string | null
          owner_id?: string
          owner_notes?: string | null
          owner_rating?: number | null
          pdf_sha256?: string | null
          pdf_url?: string | null
          priority?: string | null
          property_id?: string
          renewal_date?: string | null
          requires_tenant_signature?: boolean | null
          sla_hours?: number | null
          start_date?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string | null
          termination_notice_days?: number | null
          terms?: Json | null
          title?: string
          updated_at?: string | null
          vendor_feedback?: string | null
          vendor_id?: string
          vendor_notes?: string | null
          vendor_rating?: number | null
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
      standard_amenities: {
        Row: {
          category: string
          created_at: string | null
          display_name: string
          icon: string | null
          id: string
          is_common: boolean | null
          name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          display_name: string
          icon?: string | null
          id?: string
          is_common?: boolean | null
          name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          is_common?: boolean | null
          name?: string
        }
        Relationships: []
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
          ip_address: unknown
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent: string | null
        }
        Insert: {
          contract_id: string
          id?: string
          ip_address?: unknown
          signature_image_url: string
          signed_at: string
          signer_id: string
          signer_role: string
          user_agent?: string | null
        }
        Update: {
          contract_id?: string
          id?: string
          ip_address?: unknown
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
      vendor_quote_requests: {
        Row: {
          created_at: string | null
          id: string
          quote_id: string | null
          request_id: string
          responded_at: string | null
          response_deadline: string
          status: string
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          quote_id?: string | null
          request_id: string
          responded_at?: string | null
          response_deadline: string
          status?: string
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          quote_id?: string | null
          request_id?: string
          responded_at?: string | null
          response_deadline?: string
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_quote_requests_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quote_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "maintenance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_quote_requests_vendor_id_fkey"
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
      viewing_cancellations: {
        Row: {
          cancelled_at: string
          cancelled_by: string
          created_at: string | null
          description: string | null
          id: string
          reason: string
          reschedule_requested: boolean | null
          rescheduled_to: string | null
          viewing_request_id: string
        }
        Insert: {
          cancelled_at?: string
          cancelled_by: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason: string
          reschedule_requested?: boolean | null
          rescheduled_to?: string | null
          viewing_request_id: string
        }
        Update: {
          cancelled_at?: string
          cancelled_by?: string
          created_at?: string | null
          description?: string | null
          id?: string
          reason?: string
          reschedule_requested?: boolean | null
          rescheduled_to?: string | null
          viewing_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_cancellations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_cancellations_viewing_request_id_fkey"
            columns: ["viewing_request_id"]
            isOneToOne: false
            referencedRelation: "viewing_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_cancellations_viewing_request_id_fkey"
            columns: ["viewing_request_id"]
            isOneToOne: false
            referencedRelation: "viewing_requests_with_details"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_requests: {
        Row: {
          alternative_times: string[] | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          confirmed_date: string | null
          created_at: string | null
          expired_at: string | null
          expiry_reason: string | null
          id: string
          owner_id: string
          owner_notes: string | null
          owner_notified_at: string | null
          owner_response: string | null
          property_id: string
          reminder_sent_at: string | null
          requested_date: string
          requested_time: string
          status: string
          tenant_attended: boolean | null
          tenant_feedback: string | null
          tenant_id: string
          tenant_notes: string | null
          tenant_notified_at: string | null
          updated_at: string | null
        }
        Insert: {
          alternative_times?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          confirmed_date?: string | null
          created_at?: string | null
          expired_at?: string | null
          expiry_reason?: string | null
          id?: string
          owner_id: string
          owner_notes?: string | null
          owner_notified_at?: string | null
          owner_response?: string | null
          property_id: string
          reminder_sent_at?: string | null
          requested_date: string
          requested_time: string
          status?: string
          tenant_attended?: boolean | null
          tenant_feedback?: string | null
          tenant_id: string
          tenant_notes?: string | null
          tenant_notified_at?: string | null
          updated_at?: string | null
        }
        Update: {
          alternative_times?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          completed_at?: string | null
          confirmed_date?: string | null
          created_at?: string | null
          expired_at?: string | null
          expiry_reason?: string | null
          id?: string
          owner_id?: string
          owner_notes?: string | null
          owner_notified_at?: string | null
          owner_response?: string | null
          property_id?: string
          reminder_sent_at?: string | null
          requested_date?: string
          requested_time?: string
          status?: string
          tenant_attended?: boolean | null
          tenant_feedback?: string | null
          tenant_id?: string
          tenant_notes?: string | null
          tenant_notified_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viewing_requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      rental_applications_with_details: {
        Row: {
          affordability_ratio: number | null
          application_score: number | null
          approved_at: string | null
          approved_by: string | null
          background_check_result: Json | null
          background_check_status: string | null
          co_applicant_count: number | null
          created_at: string | null
          credit_check_result: Json | null
          credit_check_status: string | null
          date_of_birth: string | null
          email: string | null
          employer: string | null
          employer_contact: string | null
          employment_start_date: string | null
          full_name: string | null
          id: string | null
          id_document_url: string | null
          id_number: string | null
          identity_verification_status: string | null
          monthly_income: number | null
          owner_id: string | null
          owner_name: string | null
          owner_notes: string | null
          phone: string | null
          position: string | null
          proof_of_income_urls: string[] | null
          property_address: string | null
          property_id: string | null
          property_rent: number | null
          reference_urls: string[] | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          rental_history: Json | null
          reviewed_at: string | null
          risk_level: string | null
          status: string | null
          submitted_at: string | null
          tenant_id: string | null
          tenant_name: string | null
          tenant_notes: string | null
          total_household_income: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_applications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_applications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_requests_with_details: {
        Row: {
          alternative_times: string[] | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          completed_at: string | null
          confirmed_date: string | null
          created_at: string | null
          id: string | null
          owner_email: string | null
          owner_id: string | null
          owner_name: string | null
          owner_notes: string | null
          owner_notified_at: string | null
          owner_phone: string | null
          owner_response: string | null
          property_address: string | null
          property_bedrooms: number | null
          property_id: string | null
          property_rent: number | null
          reminder_sent_at: string | null
          requested_date: string | null
          requested_time: string | null
          status: string | null
          tenant_attended: boolean | null
          tenant_email: string | null
          tenant_feedback: string | null
          tenant_id: string | null
          tenant_name: string | null
          tenant_notes: string | null
          tenant_notified_at: string | null
          tenant_phone: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viewing_requests_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_quote_and_generate_po: {
        Args: { quote_id: string }
        Returns: string
      }
      auto_expire_viewing_requests: {
        Args: never
        Returns: {
          completed_count: number
          expired_count: number
          message: string
        }[]
      }
      calculate_affordability_ratio: {
        Args: { monthly_income: number; rent_amount: number }
        Returns: number
      }
      calculate_document_delete_after: {
        Args: { p_created_at?: string; p_retention_years: number }
        Returns: string
      }
      can_vendor_start_work: { Args: { request_id: string }; Returns: boolean }
      check_duplicate_id_number: {
        Args: { exclude_user_id?: string; new_id_number: string }
        Returns: boolean
      }
      check_email_exists: { Args: { email_to_check: string }; Returns: boolean }
      check_id_exists: { Args: { id_num: string }; Returns: boolean }
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
      create_contract_notification: {
        Args: {
          p_contract_id: string
          p_message: string
          p_notification_type: string
          p_recipient_id: string
          p_title: string
        }
        Returns: undefined
      }
      get_latest_po_revision: { Args: { p_po_id: string }; Returns: number }
      get_latest_quote_revision: {
        Args: { p_quote_id: string }
        Returns: number
      }
      get_owner_maintenance_requests: {
        Args: never
        Returns: {
          acknowledged_at: string | null
          actual_cost: number | null
          category_id: string | null
          closure_approved_at: string | null
          closure_requested_at: string | null
          completed_date: string | null
          created_at: string | null
          description: string
          estimated_cost: number | null
          id: string
          images: string[] | null
          mms_status: string | null
          owner_id: string | null
          po_id: string | null
          priority: string | null
          property_id: string | null
          quote_deadline: string | null
          scheduled_date: string | null
          selected_quote_id: string | null
          selected_vendor_id: string | null
          status: Database["public"]["Enums"]["maintenance_status"] | null
          tenant_id: string | null
          title: string
          vendor_id: string | null
          vendor_routed_at: string | null
          visibility: string | null
          work_can_start: boolean | null
          work_started_at: string | null
          work_started_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "maintenance_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_profile_for_vendor: {
        Args: { p_profile_id: string; p_vendor_id: string }
        Returns: {
          email: string
          full_name: string
          id: string
          phone: string
        }[]
      }
      get_profile_minimal: {
        Args: { uid: string }
        Returns: {
          email: string
          full_name: string
          id: string
        }[]
      }
      get_profiles_by_id_and_role: {
        Args: { id_num: string; user_role: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          id_number: string
          role: string
        }[]
      }
      get_profiles_by_id_number: {
        Args: { id_num: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          id_number: string
          role: string
        }[]
      }
      get_property_for_vendor: {
        Args: { p_property_id: string; p_vendor_id: string }
        Returns: {
          address: string
          city: string
          id: string
          postal_code: string
          province: string
          title: string
        }[]
      }
      get_vendor_contract_summary: {
        Args: { p_vendor_id: string }
        Returns: {
          active_contracts: number
          avg_rating: number
          completed_contracts: number
          pending_contracts: number
          this_month_earnings: number
          total_contracts: number
          total_value: number
        }[]
      }
      log_contract_event: {
        Args: {
          p_actor_id?: string
          p_contract_id: string
          p_event: string
          p_new_values?: Json
          p_old_values?: Json
        }
        Returns: undefined
      }
      log_document_access: {
        Args: {
          p_document_id: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_service_contract_event: {
        Args: { p_contract_id: string; p_data?: Json; p_event: string }
        Returns: undefined
      }
      log_tenancy_contract_event: {
        Args: { p_contract_id: string; p_data?: Json; p_event: string }
        Returns: undefined
      }
      migrate_property_amenities: {
        Args: never
        Returns: {
          migrated_count: number
          properties_processed: number
        }[]
      }
      route_maintenance_request_to_vendors: {
        Args: { p_quote_deadline_hours?: number; p_request_id: string }
        Returns: undefined
      }
      search_tenants_by_name: {
        Args: { q: string }
        Returns: {
          full_name: string
          id: string
        }[]
      }
      search_vendors_minimal: {
        Args: { p_limit?: number; p_term: string }
        Returns: {
          email: string
          full_name: string
          id: string
          phone: string
        }[]
      }
      validate_email_format: { Args: { email: string }; Returns: boolean }
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
      property_status:
        | "available"
        | "occupied"
        | "maintenance"
        | "vacant"
        | "rented"
        | "archived"
        | "draft"
        | "viewing_active"
        | "applications_open"
        | "holding_deposit"
        | "lease_pending"
        | "delisted"
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
      property_status: [
        "available",
        "occupied",
        "maintenance",
        "vacant",
        "rented",
        "archived",
        "draft",
        "viewing_active",
        "applications_open",
        "holding_deposit",
        "lease_pending",
        "delisted",
      ],
      user_role: ["tenant", "owner", "vendor", "admin"],
    },
  },
} as const
