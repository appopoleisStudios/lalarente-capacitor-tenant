/**
 * Payment Processing API
 *
 * Handles partial payments, overpayments, and split payments.
 * Replaces illegal flat-fee late charges with legal interest calculations.
 */

import { supabase } from '../../../lib/supabase';
import { calculateLegalInterest } from '../../../shared/utils/businessDayCalculator';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentVariant = 'full' | 'partial' | 'overpayment' | 'split';

export interface ProcessPartialPaymentInput {
  paymentId: string;
  amountPaid: number;
  paymentMethod: string;
  transactionId?: string;
  notes?: string;
}

export interface ProcessOverpaymentInput {
  paymentId: string;
  amountPaid: number;
  paymentMethod: string;
  applyExcessToNextMonth: boolean;
  transactionId?: string;
}

export interface SplitPaymentInput {
  paymentId: string;
  splitAmounts: number[];
  splitDueDates: string[];
}

export interface PaymentSummary {
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
  totalCredit: number;
  totalInterest: number;
  overdueCount: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const paymentProcessingApi = {
  /**
   * Process a partial payment (tenant pays less than full amount).
   * Records the payment and tracks the outstanding balance.
   */
  async processPartialPayment(input: ProcessPartialPaymentInput): Promise<void> {
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', input.paymentId)
      .single();

    if (fetchErr || !payment) {
      throw new Error('Payment not found');
    }

    const outstanding = payment.amount - input.amountPaid;

    if (outstanding <= 0) {
      throw new Error('Amount paid exceeds amount due. Use processOverpayment() instead.');
    }

    const { error } = await supabase
      .from('payments')
      .update({
        payment_variant: 'partial',
        amount_paid: input.amountPaid,
        amount_outstanding: outstanding,
        original_amount: payment.amount,
        status: 'completed',
        paid_date: new Date().toISOString(),
        payment_method: input.paymentMethod,
        transaction_id: input.transactionId || null,
        notes: input.notes || null,
      })
      .eq('id', input.paymentId);

    if (error) {
      console.error('Error processing partial payment:', error);
      throw new Error(`Failed to process partial payment: ${error.message}`);
    }
  },

  /**
   * Process an overpayment (tenant pays more than amount due).
   * Optionally applies excess as credit to next month.
   */
  async processOverpayment(input: ProcessOverpaymentInput): Promise<void> {
    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', input.paymentId)
      .single();

    if (fetchErr || !payment) {
      throw new Error('Payment not found');
    }

    const excess = input.amountPaid - payment.amount;

    if (excess < 0) {
      throw new Error('Amount paid is less than due. Use processPartialPayment() instead.');
    }

    // Update this payment
    const { error } = await supabase
      .from('payments')
      .update({
        payment_variant: 'overpayment',
        amount_paid: input.amountPaid,
        credit_balance: excess,
        original_amount: payment.amount,
        status: 'completed',
        paid_date: new Date().toISOString(),
        payment_method: input.paymentMethod,
        transaction_id: input.transactionId || null,
      })
      .eq('id', input.paymentId);

    if (error) {
      console.error('Error processing overpayment:', error);
      throw new Error(`Failed to process overpayment: ${error.message}`);
    }

    // Apply credit to next pending payment if requested
    if (input.applyExcessToNextMonth && excess > 0 && payment.lease_id) {
      const { data: nextPayment } = await supabase
        .from('payments')
        .select('id, amount')
        .eq('lease_id', payment.lease_id)
        .eq('status', 'pending')
        .gt('due_date', payment.due_date)
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextPayment) {
        const newAmount = Math.max(0, nextPayment.amount - excess);
        await supabase
          .from('payments')
          .update({
            amount: newAmount,
            credit_balance: excess,
            notes: `R${excess.toFixed(2)} credit applied from overpayment on ${payment.due_date}`,
          })
          .eq('id', nextPayment.id);
      }
    }
  },

  /**
   * Split a payment into multiple instalments.
   * Creates child payment records linked to the original.
   */
  async splitPayment(input: SplitPaymentInput): Promise<void> {
    if (input.splitAmounts.length !== input.splitDueDates.length) {
      throw new Error('Split amounts and due dates must have equal length');
    }

    const { data: payment, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', input.paymentId)
      .single();

    if (fetchErr || !payment) {
      throw new Error('Payment not found');
    }

    const totalSplit = input.splitAmounts.reduce((sum, a) => sum + a, 0);
    if (Math.abs(totalSplit - payment.amount) > 0.01) {
      throw new Error(`Split amounts (R${totalSplit}) must equal original amount (R${payment.amount})`);
    }

    // Mark original as split
    await supabase
      .from('payments')
      .update({
        payment_variant: 'split',
        status: 'completed',
        notes: `Split into ${input.splitAmounts.length} instalments`,
      })
      .eq('id', input.paymentId);

    // Create child payments
    const childPayments = input.splitAmounts.map((amount, i) => ({
      lease_id: payment.lease_id,
      tenant_id: payment.tenant_id,
      owner_id: payment.owner_id,
      property_id: payment.property_id,
      type: payment.type,
      amount,
      due_date: input.splitDueDates[i],
      status: 'pending' as const,
      payment_variant: 'split' as const,
      parent_payment_id: input.paymentId,
      original_amount: payment.amount,
      notes: `Instalment ${i + 1} of ${input.splitAmounts.length}`,
    }));

    const { error } = await supabase.from('payments').insert(childPayments);

    if (error) {
      console.error('Error creating split payments:', error);
      throw new Error(`Failed to split payment: ${error.message}`);
    }
  },

  /**
   * Calculate and update interest on all overdue payments for a lease.
   */
  async calculateInterestForLease(leaseId: string): Promise<number> {
    // Get the lease interest rate
    const { data: lease } = await supabase
      .from('leases')
      .select('interest_on_arrears_rate')
      .eq('id', leaseId)
      .single();

    const rate = lease?.interest_on_arrears_rate ?? 2.0;

    // Get all overdue payments
    const today = new Date().toISOString();
    const { data: overduePayments } = await supabase
      .from('payments')
      .select('id, amount, due_date')
      .eq('lease_id', leaseId)
      .eq('status', 'pending')
      .lt('due_date', today);

    if (!overduePayments || overduePayments.length === 0) return 0;

    let totalInterest = 0;

    for (const payment of overduePayments) {
      const daysOverdue = Math.floor(
        (Date.now() - new Date(payment.due_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      const interest = calculateLegalInterest(payment.amount, rate, daysOverdue);
      totalInterest += interest;

      await supabase
        .from('payments')
        .update({
          interest_amount: interest,
          days_overdue: daysOverdue,
          interest_calculated_at: new Date().toISOString(),
        })
        .eq('id', payment.id);
    }

    return totalInterest;
  },

  /**
   * Get payment summary for a tenant across all their leases.
   */
  async getTenantPaymentSummary(tenantId: string): Promise<PaymentSummary> {
    const { data: payments, error } = await supabase
      .from('payments')
      .select('amount, amount_paid, amount_outstanding, credit_balance, interest_amount, status, due_date')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('Error fetching payment summary:', error);
      throw new Error(`Failed to fetch payment summary: ${error.message}`);
    }

    const today = new Date();

    return {
      totalDue: payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0,
      totalPaid: payments
        ?.filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + (p.amount_paid || p.amount || 0), 0) || 0,
      totalOutstanding: payments
        ?.filter((p) => p.status === 'pending')
        .reduce((sum, p) => sum + (p.amount_outstanding || p.amount || 0), 0) || 0,
      totalCredit: payments?.reduce((sum, p) => sum + (p.credit_balance || 0), 0) || 0,
      totalInterest: payments?.reduce((sum, p) => sum + (p.interest_amount || 0), 0) || 0,
      overdueCount: payments?.filter(
        (p) => p.status === 'pending' && new Date(p.due_date) < today
      ).length || 0,
    };
  },
};
