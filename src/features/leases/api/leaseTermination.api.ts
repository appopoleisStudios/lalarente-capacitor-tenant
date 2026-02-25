/**
 * Lease Termination API
 *
 * Handles early termination, penalty calculation, and notice periods.
 * CPA s14: Early termination penalty capped at reasonable amount.
 */

import { supabase } from '../../../lib/supabase';
import { addBusinessDays, toDateString } from '../../../shared/utils/businessDayCalculator';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TerminationRequest {
  leaseId: string;
  requestedBy: string;
  reason: string;
  requestedEffectiveDate: string;
}

export interface TerminationEstimate {
  leaseId: string;
  monthlyRent: number;
  remainingMonths: number;
  penaltyAmount: number;
  noticePeriodDays: number;
  effectiveDate: string;
  depositRefundEstimate: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const leaseTerminationApi = {
  /**
   * Calculate early termination penalty.
   *
   * Common SA lease practice:
   * - Penalty = max 2 months rent (CPA reasonable penalty)
   * - Plus remaining notice period rent
   * - Minus deposit (if applicable)
   */
  async calculateTerminationPenalty(leaseId: string): Promise<TerminationEstimate> {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (error || !lease) {
      throw new Error('Lease not found');
    }

    const today = new Date();
    const endDate = new Date(lease.end_date);
    const remainingMonths = Math.max(
      0,
      Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30))
    );

    // Penalty calculation: capped at 2 months rent (CPA reasonable penalty)
    const penaltyMonths = Math.min(2, remainingMonths);
    const penaltyAmount = penaltyMonths * lease.monthly_rent;

    // Notice period: minimum 1 calendar month (default 30 days)
    const noticeDays = lease.early_termination_notice_period_days || 30;
    const effectiveDate = addBusinessDays(today, noticeDays);

    // Deposit refund estimate (full deposit minus any deductions)
    const depositRefund = lease.deposit_amount || 0;

    return {
      leaseId,
      monthlyRent: lease.monthly_rent,
      remainingMonths,
      penaltyAmount,
      noticePeriodDays: noticeDays,
      effectiveDate: toDateString(effectiveDate),
      depositRefundEstimate: depositRefund,
    };
  },

  /**
   * Request early termination of a lease (TENANT action).
   *
   * Records the termination request fields on the lease but does NOT change
   * the lease status — the lease remains 'active' until the owner explicitly
   * accepts via acceptTermination(). The owner reviews via getPendingTerminations().
   */
  async requestTermination(input: TerminationRequest): Promise<void> {
    const estimate = await this.calculateTerminationPenalty(input.leaseId);

    const { error } = await supabase
      .from('leases')
      .update({
        early_termination_requested_at: new Date().toISOString(),
        early_termination_requested_by: input.requestedBy,
        early_termination_reason: input.reason,
        early_termination_penalty: estimate.penaltyAmount,
        early_termination_effective_date: input.requestedEffectiveDate || estimate.effectiveDate,
        // NOTE: status intentionally left unchanged ('active') until owner accepts
      })
      .eq('id', input.leaseId);

    if (error) {
      console.error('Error requesting termination:', error);
      throw new Error(`Failed to request termination: ${error.message}`);
    }
  },

  /**
   * Fetch all leases awaiting owner review of a termination request.
   * These are active leases where the tenant has submitted a request.
   */
  async getPendingTerminations(ownerId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        id,
        status,
        monthly_rent,
        early_termination_requested_at,
        early_termination_requested_by,
        early_termination_reason,
        early_termination_penalty,
        early_termination_effective_date,
        property:properties!property_id(id, title, address),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .not('early_termination_requested_at', 'is', null)
      .order('early_termination_requested_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch pending terminations: ${error.message}`);
    return data || [];
  },

  /**
   * Accept a tenant's termination request (OWNER action).
   * Sets lease status to 'early_terminated' and records the accepted date.
   */
  async acceptTermination(leaseId: string): Promise<void> {
    // Get the recorded effective date first
    const { data: lease, error: fetchError } = await supabase
      .from('leases')
      .select('early_termination_effective_date, early_termination_penalty')
      .eq('id', leaseId)
      .single();

    if (fetchError || !lease) throw new Error('Lease not found');

    const { error } = await supabase
      .from('leases')
      .update({
        status: 'early_terminated',
        terminated_at: lease.early_termination_effective_date || new Date().toISOString(),
      })
      .eq('id', leaseId);

    if (error) throw new Error(`Failed to accept termination: ${error.message}`);
  },

  /**
   * Decline a tenant's termination request (OWNER action).
   * Clears the pending request fields so the lease remains active normally.
   */
  async declineTermination(leaseId: string, declineReason?: string): Promise<void> {
    const { error } = await supabase
      .from('leases')
      .update({
        early_termination_requested_at: null,
        early_termination_requested_by: null,
        early_termination_reason: declineReason
          ? `DECLINED: ${declineReason}`
          : null,
        early_termination_penalty: null,
        early_termination_effective_date: null,
      })
      .eq('id', leaseId);

    if (error) throw new Error(`Failed to decline termination: ${error.message}`);
  },

  /**
   * Get termination details for a lease.
   */
  async getTerminationDetails(leaseId: string): Promise<{
    requestedAt: string | null;
    requestedBy: string | null;
    reason: string | null;
    penalty: number | null;
    effectiveDate: string | null;
  }> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        early_termination_requested_at,
        early_termination_requested_by,
        early_termination_reason,
        early_termination_penalty,
        early_termination_effective_date
      `)
      .eq('id', leaseId)
      .single();

    if (error) {
      console.error('Error fetching termination details:', error);
      throw new Error(`Failed to fetch termination: ${error.message}`);
    }

    return {
      requestedAt: data.early_termination_requested_at,
      requestedBy: data.early_termination_requested_by,
      reason: data.early_termination_reason,
      penalty: data.early_termination_penalty,
      effectiveDate: data.early_termination_effective_date,
    };
  },

  /**
   * Get all terminated leases for an owner (for reporting).
   */
  async getTerminatedLeases(ownerId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(id, title, address),
        tenant:profiles!tenant_id(id, full_name, email)
      `)
      .eq('owner_id', ownerId)
      .in('status', ['terminated', 'early_terminated'])
      .order('terminated_at', { ascending: false });

    if (error) {
      console.error('Error fetching terminated leases:', error);
      throw new Error(`Failed to fetch terminated leases: ${error.message}`);
    }

    return data || [];
  },
};
