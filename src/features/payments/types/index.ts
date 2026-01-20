import type { Database } from '../../../types/database.types';

// Base types from database
export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
export type PaymentUpdate = Database['public']['Tables']['payments']['Update'];
export type PaymentSchedule = Database['public']['Tables']['payment_schedules']['Row'];

// Payment status enum
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

// Payment type enum
export type PaymentType = 'rent' | 'deposit' | 'application_fee' | 'late_fee' | 'utility' | 'other';

// Payment method enum
export type PaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'eft' | 'debit_order';

// Payment gateway enum
export type PaymentGateway = 'payfast' | 'yoco' | 'manual';

// Extended payment with relations
export interface PaymentWithRelations extends Payment {
  lease?: {
    id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
  };
  property?: {
    id: string;
    title: string;
    address: string;
    city?: string;
  };
  tenant?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  owner?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
}

// Payment summary for dashboard
export interface PaymentSummary {
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  overdueCount: number;
  onTimePercentage: number;
  monthlyRent: number;
  nextDueDate: string | null;
}

// Payment filter options
export interface PaymentFilters {
  status?: PaymentStatus | 'all';
  type?: PaymentType | 'all';
  dateFrom?: string;
  dateTo?: string;
  propertyId?: string;
  leaseId?: string;
}

// Payment receipt
export interface PaymentReceipt {
  paymentId: string;
  receiptNumber: string;
  amount: number;
  paidDate: string;
  paymentMethod: PaymentMethod;
  propertyTitle: string;
  propertyAddress: string;
  tenantName: string;
  ownerName: string;
  transactionId?: string;
}
