import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database.types';

// Type aliases
type Payment = Database['public']['Tables']['payments']['Row'];
type PaymentInsert = Database['public']['Tables']['payments']['Insert'];
type PaymentUpdate = Database['public']['Tables']['payments']['Update'];

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

// Input types
export interface CreatePaymentInput {
  lease_id: string;
  tenant_id: string;
  owner_id: string;
  property_id: string;
  
  type: 'rent' | 'deposit' | 'application_fee' | 'late_fee' | 'utility' | 'other';
  amount: number;
  due_date: string;
  
  payment_method?: 'bank_transfer' | 'card' | 'cash' | 'eft' | 'debit_order';
}

export interface ProcessPaymentInput {
  payment_id: string;
  payment_method: 'bank_transfer' | 'card' | 'cash' | 'eft' | 'debit_order';
  payment_gateway?: 'payfast' | 'yoco' | 'manual';
  transaction_id?: string;
  payment_reference?: string;
}

export interface PaymentStats {
  total_collected: number;
  total_pending: number;
  total_overdue: number;
  overdue_count: number;
  on_time_percentage: number;
}

export const paymentsApi = {
  /**
   * Create a new payment record
   */
  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        lease_id: input.lease_id,
        tenant_id: input.tenant_id,
        owner_id: input.owner_id,
        property_id: input.property_id,
        type: input.type,
        amount: input.amount,
        due_date: input.due_date,
        payment_method: input.payment_method || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating payment:', error);
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return data;
  },

  /**
   * Process a payment
   */
  async processPayment(input: ProcessPaymentInput): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'processing',
        payment_method: input.payment_method,
        payment_gateway: input.payment_gateway || null,
        transaction_id: input.transaction_id || null,
        payment_reference: input.payment_reference || null,
      })
      .eq('id', input.payment_id)
      .select()
      .single();

    if (error) {
      console.error('Error processing payment:', error);
      throw new Error(`Failed to process payment: ${error.message}`);
    }

    return data;
  },

  /**
   * Mark payment as completed
   */
  async completePayment(paymentId: string, transactionId?: string): Promise<Payment> {
    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_date: new Date().toISOString(),
        transaction_id: transactionId || null,
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error completing payment:', error);
      throw new Error(`Failed to complete payment: ${error.message}`);
    }

    // TODO: Send payment confirmation to tenant and owner
    // TODO: Generate receipt

    return data;
  },

  /**
   * Mark payment as failed
   */
  async failPayment(paymentId: string, failureReason: string): Promise<Payment> {
    const payment = await this.getPayment(paymentId);
    const retryCount = (payment.retry_count || 0) + 1;

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'failed',
        failure_reason: failureReason,
        retry_count: retryCount,
        last_retry_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error failing payment:', error);
      throw new Error(`Failed to update payment: ${error.message}`);
    }

    // TODO: Send failure notification to tenant
    // TODO: Schedule retry if retry_count < 3

    return data;
  },

  /**
   * Retry a failed payment
   */
  async retryPayment(paymentId: string): Promise<Payment> {
    const payment = await this.getPayment(paymentId);

    if (payment.status !== 'failed') {
      throw new Error('Only failed payments can be retried');
    }

    if ((payment.retry_count || 0) >= 3) {
      throw new Error('Maximum retry attempts reached');
    }

    const { data, error } = await supabase
      .from('payments')
      .update({
        status: 'pending',
        failure_reason: null,
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('Error retrying payment:', error);
      throw new Error(`Failed to retry payment: ${error.message}`);
    }

    return data;
  },

  /**
   * Get a single payment by ID
   */
  async getPayment(id: string): Promise<PaymentWithRelations> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        lease:leases!lease_id(id, start_date, end_date, monthly_rent),
        property:properties!property_id(id, title, address),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching payment:', error);
      throw new Error(`Failed to fetch payment: ${error.message}`);
    }

    return data as PaymentWithRelations;
  },

  /**
   * Get all payments for a tenant
   */
  async getTenantPayments(tenantId: string): Promise<PaymentWithRelations[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        lease:leases!lease_id(id, start_date, end_date, monthly_rent),
        property:properties!property_id(id, title, address),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error('Error fetching tenant payments:', error);
      throw new Error(`Failed to fetch tenant payments: ${error.message}`);
    }

    return data as PaymentWithRelations[];
  },

  /**
   * Get all payments for an owner
   */
  async getOwnerPayments(ownerId: string): Promise<PaymentWithRelations[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        lease:leases!lease_id(id, start_date, end_date, monthly_rent),
        property:properties!property_id(id, title, address),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error('Error fetching owner payments:', error);
      throw new Error(`Failed to fetch owner payments: ${error.message}`);
    }

    return data as PaymentWithRelations[];
  },

  /**
   * Get payments for a specific lease
   */
  async getLeasePayments(leaseId: string): Promise<PaymentWithRelations[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        property:properties!property_id(id, title, address),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('lease_id', leaseId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching lease payments:', error);
      throw new Error(`Failed to fetch lease payments: ${error.message}`);
    }

    return data as PaymentWithRelations[];
  },

  /**
   * Get upcoming payments (due within next 30 days)
   */
  async getUpcomingPayments(tenantId: string, daysAhead: number = 30): Promise<PaymentWithRelations[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        lease:leases!lease_id(id, start_date, end_date, monthly_rent),
        property:properties!property_id(id, title, address),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .gte('due_date', today.toISOString())
      .lte('due_date', futureDate.toISOString())
      .order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming payments:', error);
      throw new Error(`Failed to fetch upcoming payments: ${error.message}`);
    }

    return data as PaymentWithRelations[];
  },

  /**
   * Get overdue payments
   */
  async getOverduePayments(tenantId?: string, ownerId?: string): Promise<PaymentWithRelations[]> {
    const today = new Date().toISOString();

    let query = supabase
      .from('payments')
      .select(`
        *,
        lease:leases!lease_id(id, start_date, end_date, monthly_rent),
        property:properties!property_id(id, title, address),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('status', 'pending')
      .lt('due_date', today);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query.order('due_date', { ascending: true });

    if (error) {
      console.error('Error fetching overdue payments:', error);
      throw new Error(`Failed to fetch overdue payments: ${error.message}`);
    }

    return data as PaymentWithRelations[];
  },

  /**
   * Get payment history for a property
   */
  async getPropertyPaymentHistory(propertyId: string): Promise<PaymentWithRelations[]> {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        lease:leases!lease_id(id, start_date, end_date, monthly_rent),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId)
      .order('due_date', { ascending: false });

    if (error) {
      console.error('Error fetching property payment history:', error);
      throw new Error(`Failed to fetch property payment history: ${error.message}`);
    }

    return data as PaymentWithRelations[];
  },

  /**
   * Calculate payment statistics for owner
   */
  async getPaymentStats(ownerId: string): Promise<PaymentStats> {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('id, amount, status, due_date, paid_date')
      .eq('owner_id', ownerId);

    if (error) {
      console.error('Error fetching payment stats:', error);
      throw new Error(`Failed to fetch payment stats: ${error.message}`);
    }

    const today = new Date();
    
    const totalCollected = payments
      ?.filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    const totalPending = payments
      ?.filter(p => p.status === 'pending' && new Date(p.due_date) >= today)
      .reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    const overduePayments = payments
      ?.filter(p => p.status === 'pending' && new Date(p.due_date) < today) || [];

    const totalOverdue = overduePayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const completedPayments = payments?.filter(p => p.status === 'completed') || [];
    const onTimePayments = completedPayments.filter(p => {
      if (!p.paid_date) return false;
      return new Date(p.paid_date) <= new Date(p.due_date);
    });

    const onTimePercentage = completedPayments.length > 0
      ? (onTimePayments.length / completedPayments.length) * 100
      : 0;

    return {
      total_collected: totalCollected,
      total_pending: totalPending,
      total_overdue: totalOverdue,
      overdue_count: overduePayments.length,
      on_time_percentage: Math.round(onTimePercentage),
    };
  },

  /**
   * Generate recurring rent payments for a lease
   */
  async generateRecurringPayments(leaseId: string): Promise<Payment[]> {
    // Get lease details
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (leaseError || !lease) {
      throw new Error('Lease not found');
    }

    if (!lease.tenant_id || !lease.owner_id || !lease.property_id) {
      throw new Error('Lease is missing required tenant, owner, or property information');
    }

    const startDate = new Date(lease.start_date);
    const endDate = new Date(lease.end_date);
    const paymentDueDay = lease.payment_due_day || 1;

    const payments: PaymentInsert[] = [];
    let currentDate = new Date(startDate);

    // Generate monthly payments
    while (currentDate <= endDate) {
      const dueDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), paymentDueDay);
      
      // Skip if due date is before lease start
      if (dueDate >= startDate && dueDate <= endDate) {
        payments.push({
          lease_id: leaseId,
          tenant_id: lease.tenant_id,
          owner_id: lease.owner_id,
          property_id: lease.property_id,
          type: 'rent',
          amount: lease.monthly_rent,
          due_date: dueDate.toISOString(),
          status: 'pending',
        });
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    // Insert all payments
    const { data, error } = await supabase
      .from('payments')
      .insert(payments)
      .select();

    if (error) {
      console.error('Error generating recurring payments:', error);
      throw new Error(`Failed to generate recurring payments: ${error.message}`);
    }

    return data;
  },

  /**
   * Check if payment is overdue
   */
  isOverdue(payment: Payment): boolean {
    if (payment.status !== 'pending') return false;
    const dueDate = new Date(payment.due_date);
    const today = new Date();
    return dueDate < today;
  },

  /**
   * Calculate days overdue
   */
  getDaysOverdue(payment: Payment): number {
    if (!this.isOverdue(payment)) return 0;
    const dueDate = new Date(payment.due_date);
    const today = new Date();
    return Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
  },

  /**
   * Calculate late fee for overdue payment
   */
  calculateLateFee(payment: Payment, lateFeeAmount: number, graceDays: number = 0): number {
    const daysOverdue = this.getDaysOverdue(payment);
    if (daysOverdue <= graceDays) return 0;
    return lateFeeAmount;
  },
};
