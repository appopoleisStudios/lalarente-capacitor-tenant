/**
 * Deposit Interest API
 *
 * RHA s5(3): Security deposit must accrue interest at the prescribed rate.
 * Calculates monthly compound interest on tenant security deposits.
 */

import { supabase } from '../../../lib/supabase';
import { toDateString } from '../../../shared/utils/businessDayCalculator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DepositInterestSummary {
  leaseId: string;
  depositAmount: number;
  annualRate: number;
  totalInterest: number;
  currentBalance: number;
  accruals: Array<{
    periodStart: string;
    periodEnd: string;
    interestEarned: number;
    cumulativeInterest: number;
  }>;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const depositInterestApi = {
  /**
   * Calculate and record monthly interest accrual.
   * Uses monthly compound interest: P × (1 + r/12)^n - P
   */
  async calculateMonthlyInterest(leaseId: string): Promise<number> {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('id, tenant_id, deposit_amount, deposit_interest_rate, deposit_total_interest')
      .eq('id', leaseId)
      .single();

    if (error || !lease) {
      throw new Error('Lease not found');
    }

    if (!lease.deposit_amount || lease.deposit_amount <= 0) {
      return 0;
    }

    // Use the lease-specific rate, or default prescribed rate
    const annualRate = lease.deposit_interest_rate || 0.0525; // 5.25% default
    const monthlyRate = annualRate / 12;

    // Get the current balance (deposit + accumulated interest)
    const currentBalance = lease.deposit_amount + (lease.deposit_total_interest || 0);
    const monthlyInterest = Math.round(currentBalance * monthlyRate * 100) / 100;

    const today = new Date();
    const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const newTotalInterest = (lease.deposit_total_interest || 0) + monthlyInterest;

    // Record the accrual
    const { error: insertErr } = await supabase
      .from('deposit_interest_accruals')
      .insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id!,
        deposit_amount: lease.deposit_amount,
        interest_rate: annualRate,
        accrual_period_start: toDateString(periodStart),
        accrual_period_end: toDateString(periodEnd),
        interest_earned: monthlyInterest,
        cumulative_interest: newTotalInterest,
        balance_after_interest: lease.deposit_amount + newTotalInterest,
      });

    if (insertErr) {
      console.error('Error recording interest accrual:', insertErr);
      throw new Error(`Failed to record interest: ${insertErr.message}`);
    }

    // Update lease total
    await supabase
      .from('leases')
      .update({ deposit_total_interest: newTotalInterest })
      .eq('id', leaseId);

    return monthlyInterest;
  },

  /**
   * Get the full interest history for a deposit.
   */
  async getInterestHistory(leaseId: string): Promise<DepositInterestSummary> {
    const { data: lease } = await supabase
      .from('leases')
      .select('id, deposit_amount, deposit_interest_rate, deposit_total_interest')
      .eq('id', leaseId)
      .single();

    if (!lease) throw new Error('Lease not found');

    const { data: accruals, error } = await supabase
      .from('deposit_interest_accruals')
      .select('*')
      .eq('lease_id', leaseId)
      .order('accrual_period_start', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch interest history: ${error.message}`);
    }

    return {
      leaseId,
      depositAmount: lease.deposit_amount || 0,
      annualRate: lease.deposit_interest_rate || 0.0525,
      totalInterest: lease.deposit_total_interest || 0,
      currentBalance: (lease.deposit_amount || 0) + (lease.deposit_total_interest || 0),
      accruals: (accruals || []).map((a) => ({
        periodStart: a.accrual_period_start,
        periodEnd: a.accrual_period_end,
        interestEarned: a.interest_earned,
        cumulativeInterest: a.cumulative_interest,
      })),
    };
  },

  /**
   * Calculate the total refund amount (deposit + interest - deductions).
   */
  async calculateRefundAmount(leaseId: string): Promise<{
    depositAmount: number;
    totalInterest: number;
    totalDeductions: number;
    refundAmount: number;
  }> {
    const { data: lease } = await supabase
      .from('leases')
      .select('deposit_amount, deposit_total_interest')
      .eq('id', leaseId)
      .single();

    if (!lease) throw new Error('Lease not found');

    // Get finalized deductions
    const { data: deductions } = await supabase
      .from('deposit_deductions')
      .select('amount')
      .eq('lease_id', leaseId)
      .in('status', ['agreed', 'finalized']);

    const totalDeductions = (deductions || []).reduce((sum, d) => sum + d.amount, 0);
    const depositWithInterest = (lease.deposit_amount || 0) + (lease.deposit_total_interest || 0);

    return {
      depositAmount: lease.deposit_amount || 0,
      totalInterest: lease.deposit_total_interest || 0,
      totalDeductions,
      refundAmount: Math.max(0, depositWithInterest - totalDeductions),
    };
  },
};
