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
      inspections: {
        Row: {
          completed_date: string | null
          created_at: string | null
          id: string
          images: string[] | null
          inspection_type: Database["public"]["Enums"]["inspection_type"]
          inspector_id: string | null
          inspector_signature: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
