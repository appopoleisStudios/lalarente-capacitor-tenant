/**
 * Deposit Refund API
 *
 * RHA s5(7): Deposit + interest must be refunded within:
 * - 7 days if no deductions claimed
 * - 14 days if deductions need inspection
 * - 21 days maximum with Rental Housing Tribunal involvement
 */

import { supabase } from '../../../lib/supabase';
import { addBusinessDays, toDateString } from '../../../shared/utils/businessDayCalculator';
import { depositInterestApi } from './depositInterest.api';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DepositRefundStatus {
  leaseId: string;
  status: string;
  depositAmount: number;
  totalInterest: number;
  deductions: Array<{ type: string; amount: number; status: string }>;
  refundAmount: number;
  refundDeadline: string | null;
  isOverdue: boolean;
}

export interface ProposeDeductionInput {
  leaseId: string;
  ownerId: string;
  tenantId: string;
  deductionType: string;
  description: string;
  amount: number;
  evidenceUrls?: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const depositRefundApi = {
  /**
   * Initiate the deposit refund process after lease termination.
   * Sets the refund deadline per RHA requirements.
   */
  async initiateRefund(leaseId: string): Promise<void> {
    const refundCalc = await depositInterestApi.calculateRefundAmount(leaseId);

    // Default: 7-day deadline (no deductions)
    const deadline = addBusinessDays(new Date(), 7);

    const { error } = await supabase
      .from('leases')
      .update({
        deposit_refund_status: 'pending_inspection',
        deposit_refund_amount: refundCalc.refundAmount,
        deposit_refund_deadline: toDateString(deadline),
      })
      .eq('id', leaseId);

    if (error) {
      console.error('Error initiating refund:', error);
      throw new Error(`Failed to initiate refund: ${error.message}`);
    }
  },

  /**
   * Propose a deduction from the deposit.
   * Extends refund deadline to 14 days.
   */
  async proposeDeduction(input: ProposeDeductionInput): Promise<void> {
    const { error } = await supabase
      .from('deposit_deductions')
      .insert({
        lease_id: input.leaseId,
        owner_id: input.ownerId,
        tenant_id: input.tenantId,
        deduction_type: input.deductionType,
        description: input.description,
        amount: input.amount,
        evidence_urls: input.evidenceUrls || null,
        status: 'proposed',
      });

    if (error) {
      console.error('Error proposing deduction:', error);
      throw new Error(`Failed to propose deduction: ${error.message}`);
    }

    // Extend deadline to 14 days since deductions are being claimed
    const newDeadline = addBusinessDays(new Date(), 14);
    await supabase
      .from('leases')
      .update({
        deposit_refund_status: 'deductions_proposed',
        deposit_refund_deadline: toDateString(newDeadline),
      })
      .eq('id', input.leaseId);
  },

  /**
   * Tenant responds to a proposed deduction.
   */
  async respondToDeduction(
    deductionId: string,
    agreed: boolean,
    disputeReason?: string
  ): Promise<void> {
    const { error } = await supabase
      .from('deposit_deductions')
      .update({
        tenant_agreed: agreed,
        tenant_response_at: new Date().toISOString(),
        tenant_dispute_reason: !agreed ? disputeReason : null,
        status: agreed ? 'agreed' : 'disputed',
      })
      .eq('id', deductionId);

    if (error) {
      console.error('Error responding to deduction:', error);
      throw new Error(`Failed to respond: ${error.message}`);
    }
  },

  /**
   * Process the final refund (after deductions resolved).
   */
  async processRefund(leaseId: string): Promise<number> {
    const refundCalc = await depositInterestApi.calculateRefundAmount(leaseId);

    const { error } = await supabase
      .from('leases')
      .update({
        deposit_refund_status: 'refunded',
        deposit_refund_amount: refundCalc.refundAmount,
        deposit_refunded_at: new Date().toISOString(),
      })
      .eq('id', leaseId);

    if (error) {
      console.error('Error processing refund:', error);
      throw new Error(`Failed to process refund: ${error.message}`);
    }

    return refundCalc.refundAmount;
  },

  /**
   * Get the current refund status for a lease.
   */
  async getRefundStatus(leaseId: string): Promise<DepositRefundStatus> {
    const { data: lease, error: leaseErr } = await supabase
      .from('leases')
      .select('deposit_amount, deposit_total_interest, deposit_refund_status, deposit_refund_amount, deposit_refund_deadline')
      .eq('id', leaseId)
      .single();

    if (leaseErr || !lease) throw new Error('Lease not found');

    const { data: deductions } = await supabase
      .from('deposit_deductions')
      .select('deduction_type, amount, status')
      .eq('lease_id', leaseId);

    const refundCalc = await depositInterestApi.calculateRefundAmount(leaseId);
    const isOverdue = lease.deposit_refund_deadline
      ? new Date() > new Date(lease.deposit_refund_deadline)
      : false;

    return {
      leaseId,
      status: lease.deposit_refund_status || 'not_applicable',
      depositAmount: lease.deposit_amount || 0,
      totalInterest: lease.deposit_total_interest || 0,
      deductions: (deductions || []).map((d) => ({
        type: d.deduction_type,
        amount: d.amount,
        status: d.status,
      })),
      refundAmount: refundCalc.refundAmount,
      refundDeadline: lease.deposit_refund_deadline,
      isOverdue,
    };
  },
};
