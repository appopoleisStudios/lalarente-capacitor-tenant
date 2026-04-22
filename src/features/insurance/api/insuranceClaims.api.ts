/**
 * Insurance Claims API
 *
 * Manages insurance policies and claims for rental properties.
 * Links claims to maintenance requests for damage-related incidents.
 */

import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClaimType =
  | 'fire_damage' | 'water_damage' | 'storm_damage' | 'theft'
  | 'vandalism' | 'structural_damage' | 'electrical_damage'
  | 'plumbing' | 'natural_disaster' | 'other';

export type ClaimStatus =
  | 'draft' | 'submitted' | 'acknowledged' | 'assessment'
  | 'approved' | 'partially_approved' | 'rejected' | 'paid_out' | 'closed';

export interface InsurancePolicy {
  id: string;
  property_id: string;
  owner_id: string;
  policy_number: string;
  insurer_name: string;
  insurer_contact: string | null;
  policy_type: string;
  premium_amount: number | null;
  excess_amount: number | null;
  cover_amount: number | null;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

export interface InsuranceClaim {
  id: string;
  policy_id: string;
  property_id: string;
  owner_id: string;
  maintenance_request_id: string | null;
  claim_number: string | null;
  claim_type: ClaimType;
  description: string;
  incident_date: string;
  estimated_cost: number;
  claimed_amount: number | null;
  approved_amount: number | null;
  payout_received: number | null;
  status: ClaimStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateClaimInput {
  policyId: string;
  propertyId: string;
  maintenanceRequestId?: string;
  claimType: ClaimType;
  description: string;
  incidentDate: string;
  estimatedCost: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const insuranceClaimsApi = {
  // ── Policies ──────────────────────────────────────────────────────────────

  async getOwnerPolicies(ownerId: string): Promise<InsurancePolicy[]> {
    const { data, error } = await supabase
      .from('insurance_policies')
      .select(`
        *,
        property:properties!property_id(id, title, address)
      `)
      .eq('owner_id', ownerId)
      .order('end_date', { ascending: false });

    if (error) {
      console.error('Error fetching policies:', error);
      throw new Error(`Failed to fetch policies: ${error.message}`);
    }

    return data as InsurancePolicy[];
  },

  async getPropertyPolicies(propertyId: string): Promise<InsurancePolicy[]> {
    const { data, error } = await supabase
      .from('insurance_policies')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .order('end_date', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch property policies: ${error.message}`);
    }

    return data as InsurancePolicy[];
  },

  async createPolicy(ownerId: string, policy: Omit<InsurancePolicy, 'id' | 'owner_id' | 'created_at'>): Promise<InsurancePolicy> {
    const { data, error } = await supabase
      .from('insurance_policies')
      .insert({ ...policy, owner_id: ownerId })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create policy: ${error.message}`);
    }

    return data as InsurancePolicy;
  },

  // ── Claims ────────────────────────────────────────────────────────────────

  async createClaim(ownerId: string, input: CreateClaimInput): Promise<InsuranceClaim> {
    const { data, error } = await supabase
      .from('insurance_claims')
      .insert({
        policy_id: input.policyId,
        property_id: input.propertyId,
        owner_id: ownerId,
        maintenance_request_id: input.maintenanceRequestId || null,
        claim_type: input.claimType,
        description: input.description,
        incident_date: input.incidentDate,
        estimated_cost: input.estimatedCost,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating claim:', error);
      throw new Error(`Failed to create claim: ${error.message}`);
    }

    return data as InsuranceClaim;
  },

  async submitClaim(claimId: string, claimedAmount: number): Promise<InsuranceClaim> {
    const { data, error } = await supabase
      .from('insurance_claims')
      .update({
        status: 'submitted',
        claimed_amount: claimedAmount,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', claimId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to submit claim: ${error.message}`);
    }

    return data as InsuranceClaim;
  },

  async updateClaimStatus(
    claimId: string,
    status: ClaimStatus,
    updates?: Partial<{
      claimNumber: string;
      approvedAmount: number;
      payoutReceived: number;
      rejectionReason: string;
      assessorName: string;
      assessmentDate: string;
      notes: string;
    }>
  ): Promise<InsuranceClaim> {
    const updateData: Record<string, unknown> = { status };

    if (updates?.claimNumber) updateData.claim_number = updates.claimNumber;
    if (updates?.approvedAmount !== undefined) updateData.approved_amount = updates.approvedAmount;
    if (updates?.payoutReceived !== undefined) updateData.payout_received = updates.payoutReceived;
    if (updates?.rejectionReason) updateData.rejection_reason = updates.rejectionReason;
    if (updates?.assessorName) updateData.assessor_name = updates.assessorName;
    if (updates?.assessmentDate) updateData.assessment_date = updates.assessmentDate;
    if (updates?.notes) updateData.notes = updates.notes;

    // Set timestamp for the status
    const timestampMap: Partial<Record<ClaimStatus, string>> = {
      acknowledged: 'acknowledged_at',
      approved: 'approved_at',
      partially_approved: 'approved_at',
      paid_out: 'paid_out_at',
      closed: 'closed_at',
    };
    if (timestampMap[status]) {
      updateData[timestampMap[status]!] = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('insurance_claims')
      .update(updateData)
      .eq('id', claimId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update claim: ${error.message}`);
    }

    return data as InsuranceClaim;
  },

  async getOwnerClaims(ownerId: string): Promise<InsuranceClaim[]> {
    const { data, error } = await supabase
      .from('insurance_claims')
      .select(`
        *,
        policy:insurance_policies!policy_id(policy_number, insurer_name),
        property:properties!property_id(id, title, address)
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch claims: ${error.message}`);
    }

    return data as InsuranceClaim[];
  },

  async getClaimDocuments(claimId: string): Promise<Array<{
    id: string;
    document_type: string;
    title: string;
    file_url: string;
    created_at: string;
  }>> {
    const { data, error } = await supabase
      .from('insurance_claim_documents')
      .select('id, document_type, title, file_url, created_at')
      .eq('claim_id', claimId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data as any;
  },

  async addClaimDocument(
    claimId: string,
    uploadedBy: string,
    documentType: string,
    title: string,
    fileUrl: string
  ): Promise<void> {
    const { error } = await supabase
      .from('insurance_claim_documents')
      .insert({
        claim_id: claimId,
        uploaded_by: uploadedBy,
        document_type: documentType,
        title,
        file_url: fileUrl,
      });

    if (error) {
      throw new Error(`Failed to add document: ${error.message}`);
    }
  },

  /**
   * Get claims summary stats for an owner.
   */
  async getClaimsSummary(ownerId: string): Promise<{
    totalClaims: number;
    activeClaims: number;
    totalClaimed: number;
    totalPaidOut: number;
    pendingAmount: number;
  }> {
    const claims = await this.getOwnerClaims(ownerId);

    const activeClaims = claims.filter((c) =>
      !['closed', 'rejected', 'paid_out'].includes(c.status)
    );

    return {
      totalClaims: claims.length,
      activeClaims: activeClaims.length,
      totalClaimed: claims.reduce((sum, c) => sum + (c.claimed_amount || 0), 0),
      totalPaidOut: claims.reduce((sum, c) => sum + (c.payout_received || 0), 0),
      pendingAmount: activeClaims.reduce((sum, c) => sum + (c.claimed_amount || c.estimated_cost || 0), 0),
    };
  },
};
