/**
 * Lease Renewal API
 *
 * Handles the renewal negotiation flow between landlord and tenant.
 * Supports offer, counter-offer, accept, and reject.
 */

import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RenewalNegotiation {
  id: string;
  lease_id: string;
  tenant_id: string;
  owner_id: string;
  round: number;
  initiated_by: string;
  proposed_monthly_rent: number;
  proposed_lease_type: 'fixed' | 'month_to_month';
  proposed_duration_months: number | null;
  proposed_start_date: string;
  proposed_escalation_rate: number | null;
  proposed_terms_notes: string | null;
  status: 'pending' | 'accepted' | 'counter_offer' | 'rejected' | 'expired' | 'withdrawn';
  response_at: string | null;
  response_notes: string | null;
  response_deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposeRenewalInput {
  leaseId: string;
  proposedRent: number;
  leaseType: 'fixed' | 'month_to_month';
  durationMonths?: number;
  startDate: string;
  escalationRate?: number;
  notes?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const leaseRenewalApi = {
  /**
   * Create an initial renewal offer or counter-offer.
   */
  async proposeRenewal(userId: string, input: ProposeRenewalInput): Promise<RenewalNegotiation> {
    // Get lease to find tenant/owner IDs
    const { data: lease, error: leaseErr } = await supabase
      .from('leases')
      .select('id, tenant_id, owner_id')
      .eq('id', input.leaseId)
      .single();

    if (leaseErr || !lease) {
      throw new Error('Lease not found');
    }

    // Get current round
    const { data: existing } = await supabase
      .from('renewal_negotiations')
      .select('round')
      .eq('lease_id', input.leaseId)
      .order('round', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextRound = (existing?.round || 0) + 1;

    // Set response deadline (7 days from now)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);

    const { data, error } = await supabase
      .from('renewal_negotiations')
      .insert({
        lease_id: input.leaseId,
        tenant_id: lease.tenant_id!,
        owner_id: lease.owner_id!,
        round: nextRound,
        initiated_by: userId,
        proposed_monthly_rent: input.proposedRent,
        proposed_lease_type: input.leaseType,
        proposed_duration_months: input.durationMonths || null,
        proposed_start_date: input.startDate,
        proposed_escalation_rate: input.escalationRate || null,
        proposed_terms_notes: input.notes || null,
        status: 'pending',
        response_deadline: deadline.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error proposing renewal:', error);
      throw new Error(`Failed to propose renewal: ${error.message}`);
    }

    // Update lease status
    await supabase
      .from('leases')
      .update({ status: 'renewal_pending' })
      .eq('id', input.leaseId);

    return data as RenewalNegotiation;
  },

  /**
   * Accept a renewal proposal.
   */
  async acceptRenewal(negotiationId: string, userId: string, notes?: string): Promise<RenewalNegotiation> {
    const { data, error } = await supabase
      .from('renewal_negotiations')
      .update({
        status: 'accepted',
        response_at: new Date().toISOString(),
        response_notes: notes || null,
      })
      .eq('id', negotiationId)
      .select()
      .single();

    if (error) {
      console.error('Error accepting renewal:', error);
      throw new Error(`Failed to accept renewal: ${error.message}`);
    }

    return data as RenewalNegotiation;
  },

  /**
   * Reject a renewal proposal.
   */
  async rejectRenewal(negotiationId: string, reason?: string): Promise<RenewalNegotiation> {
    const { data, error } = await supabase
      .from('renewal_negotiations')
      .update({
        status: 'rejected',
        response_at: new Date().toISOString(),
        response_notes: reason || null,
      })
      .eq('id', negotiationId)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting renewal:', error);
      throw new Error(`Failed to reject renewal: ${error.message}`);
    }

    return data as RenewalNegotiation;
  },

  /**
   * Submit a counter-offer.
   */
  async counterOffer(
    negotiationId: string,
    userId: string,
    counterInput: ProposeRenewalInput
  ): Promise<RenewalNegotiation> {
    // Mark current as counter-offered
    await supabase
      .from('renewal_negotiations')
      .update({
        status: 'counter_offer',
        response_at: new Date().toISOString(),
      })
      .eq('id', negotiationId);

    // Create counter as a new round
    return this.proposeRenewal(userId, counterInput);
  },

  /**
   * Get negotiation history for a lease.
   */
  async getNegotiationHistory(leaseId: string): Promise<RenewalNegotiation[]> {
    const { data, error } = await supabase
      .from('renewal_negotiations')
      .select('*')
      .eq('lease_id', leaseId)
      .order('round', { ascending: true });

    if (error) {
      console.error('Error fetching negotiations:', error);
      throw new Error(`Failed to fetch negotiations: ${error.message}`);
    }

    return data as RenewalNegotiation[];
  },

  /**
   * Get the latest negotiation for a lease.
   */
  async getLatestNegotiation(leaseId: string): Promise<RenewalNegotiation | null> {
    const { data, error } = await supabase
      .from('renewal_negotiations')
      .select('*')
      .eq('lease_id', leaseId)
      .order('round', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching latest negotiation:', error);
      throw new Error(`Failed to fetch negotiation: ${error.message}`);
    }

    return data as RenewalNegotiation | null;
  },

  /**
   * Execute an accepted renewal by creating a new lease.
   */
  async executeRenewal(negotiationId: string): Promise<string> {
    const { data: negotiation, error: negErr } = await supabase
      .from('renewal_negotiations')
      .select('*')
      .eq('id', negotiationId)
      .eq('status', 'accepted')
      .single();

    if (negErr || !negotiation) {
      throw new Error('Accepted negotiation not found');
    }

    // Get original lease
    const { data: originalLease, error: leaseErr } = await supabase
      .from('leases')
      .select('*')
      .eq('id', negotiation.lease_id)
      .single();

    if (leaseErr || !originalLease) {
      throw new Error('Original lease not found');
    }

    // Calculate end date
    const startDate = new Date(negotiation.proposed_start_date);
    let endDate: Date;
    if (negotiation.proposed_duration_months) {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + negotiation.proposed_duration_months);
    } else {
      // Month-to-month: set end date 1 month out (renews automatically)
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Mark old lease as expired
    await supabase
      .from('leases')
      .update({ status: 'expired' })
      .eq('id', negotiation.lease_id);

    // Create new lease
    const { data: newLease, error: createErr } = await supabase
      .from('leases')
      .insert({
        property_id: originalLease.property_id,
        owner_id: originalLease.owner_id,
        tenant_id: originalLease.tenant_id,
        start_date: negotiation.proposed_start_date,
        end_date: endDate.toISOString().split('T')[0],
        lease_type: negotiation.proposed_lease_type,
        monthly_rent: negotiation.proposed_monthly_rent,
        deposit_amount: originalLease.deposit_amount,
        payment_due_day: originalLease.payment_due_day,
        interest_on_arrears_rate: originalLease.interest_on_arrears_rate,
        rent_escalation_type: negotiation.proposed_escalation_rate ? 'fixed_percentage' : originalLease.rent_escalation_type,
        rent_escalation_value: negotiation.proposed_escalation_rate || originalLease.rent_escalation_value,
        rent_escalation_frequency_months: originalLease.rent_escalation_frequency_months,
        status: 'pending_signatures',
        original_lease_id: negotiation.lease_id,
        renewal_count: (originalLease.renewal_count || 0) + 1,
      })
      .select('id')
      .single();

    if (createErr || !newLease) {
      console.error('Error creating renewal lease:', createErr);
      throw new Error(`Failed to create renewal lease: ${createErr?.message}`);
    }

    return newLease.id;
  },
};
