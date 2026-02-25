/**
 * Payment Disputes API
 *
 * Handles payment disputes and payment arrangement proposals
 * between tenants and owners.
 */

import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DisputeReason =
  | 'incorrect_amount'
  | 'already_paid'
  | 'unauthorized_charge'
  | 'service_issue'
  | 'calculation_error'
  | 'other';

export type DisputeStatus = 'open' | 'under_review' | 'mediation' | 'resolved' | 'rejected' | 'escalated';

export interface PaymentDispute {
  id: string;
  payment_id: string;
  raised_by: string;
  lease_id: string;
  reason: DisputeReason;
  description: string;
  disputed_amount: number;
  evidence_urls: string[] | null;
  status: DisputeStatus;
  resolution_notes: string | null;
  resolution_amount: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RaiseDisputeInput {
  paymentId: string;
  leaseId: string;
  reason: DisputeReason;
  description: string;
  disputedAmount: number;
  evidenceUrls?: string[];
}

export interface PaymentArrangement {
  id: string;
  lease_id: string;
  tenant_id: string;
  owner_id: string;
  total_owed: number;
  monthly_instalment: number;
  number_of_instalments: number;
  start_date: string;
  end_date: string;
  status: string;
  amount_paid: number;
  instalments_paid: number;
  next_due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposeArrangementInput {
  leaseId: string;
  tenantId: string;
  ownerId: string;
  totalOwed: number;
  monthlyInstalment: number;
  numberOfInstalments: number;
  startDate: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const paymentDisputesApi = {
  /**
   * Raise a new payment dispute.
   */
  async raiseDispute(userId: string, input: RaiseDisputeInput): Promise<PaymentDispute> {
    const { data, error } = await supabase
      .from('payment_disputes')
      .insert({
        payment_id: input.paymentId,
        raised_by: userId,
        lease_id: input.leaseId,
        reason: input.reason,
        description: input.description,
        disputed_amount: input.disputedAmount,
        evidence_urls: input.evidenceUrls || null,
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      console.error('Error raising dispute:', error);
      throw new Error(`Failed to raise dispute: ${error.message}`);
    }

    return data as PaymentDispute;
  },

  /**
   * Get disputes for a payment.
   */
  async getPaymentDisputes(paymentId: string): Promise<PaymentDispute[]> {
    const { data, error } = await supabase
      .from('payment_disputes')
      .select('*')
      .eq('payment_id', paymentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment disputes:', error);
      throw new Error(`Failed to fetch disputes: ${error.message}`);
    }

    return data as PaymentDispute[];
  },

  /**
   * Get all disputes visible to a user (as tenant or owner).
   */
  async getUserDisputes(userId: string): Promise<PaymentDispute[]> {
    const { data, error } = await supabase
      .from('payment_disputes')
      .select(`
        *,
        payment:payments!payment_id(amount, due_date, type),
        lease:leases!lease_id(
          property:properties!property_id(title, address)
        )
      `)
      .or(`raised_by.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user disputes:', error);
      throw new Error(`Failed to fetch disputes: ${error.message}`);
    }

    return data as PaymentDispute[];
  },

  /**
   * Update dispute status (owner reviewing, resolving, etc.).
   */
  async updateDisputeStatus(
    disputeId: string,
    status: DisputeStatus,
    notes?: string,
    resolutionAmount?: number
  ): Promise<PaymentDispute> {
    const updateData: Record<string, unknown> = { status };

    if (notes) updateData.resolution_notes = notes;
    if (resolutionAmount !== undefined) updateData.resolution_amount = resolutionAmount;
    if (status === 'resolved' || status === 'rejected') {
      updateData.resolved_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('payment_disputes')
      .update(updateData)
      .eq('id', disputeId)
      .select()
      .single();

    if (error) {
      console.error('Error updating dispute:', error);
      throw new Error(`Failed to update dispute: ${error.message}`);
    }

    return data as PaymentDispute;
  },

  // ── Payment Arrangements ──────────────────────────────────────────────────

  /**
   * Propose a payment arrangement (instalment plan).
   */
  async proposeArrangement(
    proposedBy: string,
    input: ProposeArrangementInput
  ): Promise<PaymentArrangement> {
    const endDate = new Date(input.startDate);
    endDate.setMonth(endDate.getMonth() + input.numberOfInstalments);

    const { data, error } = await supabase
      .from('payment_arrangements')
      .insert({
        lease_id: input.leaseId,
        tenant_id: input.tenantId,
        owner_id: input.ownerId,
        total_owed: input.totalOwed,
        monthly_instalment: input.monthlyInstalment,
        number_of_instalments: input.numberOfInstalments,
        start_date: input.startDate,
        end_date: endDate.toISOString().split('T')[0],
        next_due_date: input.startDate,
        status: 'proposed',
        proposed_by: proposedBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error proposing arrangement:', error);
      throw new Error(`Failed to propose arrangement: ${error.message}`);
    }

    return data as PaymentArrangement;
  },

  /**
   * Accept a payment arrangement.
   */
  async acceptArrangement(arrangementId: string, acceptedBy: string): Promise<PaymentArrangement> {
    const { data, error } = await supabase
      .from('payment_arrangements')
      .update({
        status: 'accepted',
        accepted_by: acceptedBy,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', arrangementId)
      .select()
      .single();

    if (error) {
      console.error('Error accepting arrangement:', error);
      throw new Error(`Failed to accept arrangement: ${error.message}`);
    }

    return data as PaymentArrangement;
  },

  /**
   * Get all disputes for an owner's leases (owner-side view).
   * Joins property + tenant info for display.
   */
  async getOwnerDisputes(ownerId: string): Promise<PaymentDispute[]> {
    // Supabase JS doesn't support dynamic subquery in .in(), fetch IDs first
    const { data: leases, error: leasesErr } = await supabase
      .from('leases')
      .select('id')
      .eq('owner_id', ownerId);

    if (leasesErr) throw new Error(`Failed to fetch leases: ${leasesErr.message}`);
    const leaseIds = (leases || []).map((l: { id: string }) => l.id);
    if (leaseIds.length === 0) return [];

    const { data, error } = await supabase
      .from('payment_disputes')
      .select(`
        *,
        payment:payments!payment_id(amount, due_date, type),
        lease:leases!lease_id(property:properties!property_id(title, address)),
        tenant:profiles!raised_by(full_name, email, phone)
      `)
      .in('lease_id', leaseIds)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch owner disputes: ${error.message}`);
    return data as PaymentDispute[];
  },

  /**
   * Get arrangements for a lease.
   */
  async getLeaseArrangements(leaseId: string): Promise<PaymentArrangement[]> {
    const { data, error } = await supabase
      .from('payment_arrangements')
      .select('*')
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching arrangements:', error);
      throw new Error(`Failed to fetch arrangements: ${error.message}`);
    }

    return data as PaymentArrangement[];
  },
};
