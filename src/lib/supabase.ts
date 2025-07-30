import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/supabase'

// Extend the Database type to include the exec_sql RPC function and migrations table
type ExtendedDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      migrations: {
        Row: {
          id: number
          migration_id: string
          name: string
          executed_at: string
          success: boolean
          error_message: string | null
          execution_time_ms: number | null
        }
        Insert: {
          id?: number
          migration_id: string
          name: string
          executed_at?: string
          success?: boolean
          error_message?: string | null
          execution_time_ms?: number | null
        }
        Update: {
          id?: number
          migration_id?: string
          name?: string
          executed_at?: string
          success?: boolean
          error_message?: string | null
          execution_time_ms?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      exec_sql: {
        Args: {
          sql: string
        }
        Returns: {
          error?: string
          count?: number
        }
      }
    }
  }
}

export const supabase = createClientComponentClient<ExtendedDatabase>()

// Export helper types for easier use
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Specific type aliases for your Lala Rente app
export type Profile = Tables<'profiles'>
export type Property = Tables<'properties'>
export type Payment = Tables<'payments'>
export type MaintenanceRequest = Tables<'maintenance_requests'>
export type Inspection = Tables<'inspections'>
export type Lease = Tables<'leases'>
export type Message = Tables<'messages'>
export type PropertyAssignment = Tables<'property_assignments'>

export type UserRole = Enums<'user_role'>
export type PropertyStatus = Enums<'property_status'>
export type PaymentStatus = Enums<'payment_status'>
export type MaintenanceStatus = Enums<'maintenance_status'>
export type InspectionType = Enums<'inspection_type'>
