import { supabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database.types';

// Type aliases
type Lease = Database['public']['Tables']['leases']['Row'];
type LeaseInsert = Database['public']['Tables']['leases']['Insert'];
type LeaseUpdate = Database['public']['Tables']['leases']['Update'];

// Extended lease with relations
export interface LeaseWithRelations extends Lease {
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
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
export interface CreateLeaseInput {
  property_id: string;
  owner_id: string;
  tenant_id: string;
  application_id?: string;
  
  // Lease Period
  start_date: string;
  end_date: string;
  lease_type: 'fixed' | 'month_to_month';
  
  // Financial
  monthly_rent: number;
  deposit_amount: number;
  
  // Payment Terms
  payment_due_day: number; // 1-31
  late_fee_amount?: number;
  late_fee_grace_days?: number;
  
  // Rent Escalation
  rent_escalation_type?: 'fixed_percentage' | 'fixed_amount' | 'cpi_linked';
  rent_escalation_value?: number;
  rent_escalation_frequency_months?: number;
  
  // Document
  document_url?: string;
  document_template_id?: string;
}

export interface UpdateLeaseInput {
  start_date?: string;
  end_date?: string;
  monthly_rent?: number;
  deposit_amount?: number;
  payment_due_day?: number;
  late_fee_amount?: number;
  late_fee_grace_days?: number;
  rent_escalation_type?: 'fixed_percentage' | 'fixed_amount' | 'cpi_linked';
  rent_escalation_value?: number;
  rent_escalation_frequency_months?: number;
  document_url?: string;
  status?: 'draft' | 'pending_signatures' | 'active' | 'expired' | 'terminated';
}

export interface SignatureData {
  signature_url: string;
  role: 'owner' | 'tenant';
}

export const leasesApi = {
  /**
   * Create a new lease (draft)
   */
  async createLease(input: CreateLeaseInput): Promise<Lease> {
    const { data, error } = await supabase
      .from('leases')
      .insert({
        property_id: input.property_id,
        owner_id: input.owner_id,
        tenant_id: input.tenant_id,
        application_id: input.application_id || null,
        
        // Lease period
        start_date: input.start_date,
        end_date: input.end_date,
        lease_type: input.lease_type,
        
        // Financial
        monthly_rent: input.monthly_rent,
        deposit_amount: input.deposit_amount,
        
        // Payment terms
        payment_due_day: input.payment_due_day,
        late_fee_amount: input.late_fee_amount || null,
        late_fee_grace_days: input.late_fee_grace_days || 0,
        
        // Rent escalation
        rent_escalation_type: input.rent_escalation_type || null,
        rent_escalation_value: input.rent_escalation_value || null,
        rent_escalation_frequency_months: input.rent_escalation_frequency_months || null,
        
        // Document
        document_url: input.document_url || null,
        document_template_id: input.document_template_id || null,
        
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating lease:', error);
      throw new Error(`Failed to create lease: ${error.message}`);
    }

    return data;
  },

  /**
   * Update an existing lease
   */
  async updateLease(id: string, input: UpdateLeaseInput): Promise<Lease> {
    const { data, error } = await supabase
      .from('leases')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating lease:', error);
      throw new Error(`Failed to update lease: ${error.message}`);
    }

    return data;
  },

  /**
   * Get a single lease by ID with relations
   */
  async getLease(id: string): Promise<LeaseWithRelations> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching lease:', error);
      throw new Error(`Failed to fetch lease: ${error.message}`);
    }

    return data as LeaseWithRelations;
  },

  /**
   * Get all leases for a tenant
   */
  async getTenantLeases(tenantId: string): Promise<LeaseWithRelations[]> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenant leases:', error);
      throw new Error(`Failed to fetch tenant leases: ${error.message}`);
    }

    return data as LeaseWithRelations[];
  },

  /**
   * Get all leases for an owner
   */
  async getOwnerLeases(ownerId: string): Promise<LeaseWithRelations[]> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching owner leases:', error);
      throw new Error(`Failed to fetch owner leases: ${error.message}`);
    }

    return data as LeaseWithRelations[];
  },

  /**
   * Get active lease for a property
   */
  async getActiveLease(propertyId: string): Promise<LeaseWithRelations | null> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No active lease found
        return null;
      }
      console.error('Error fetching active lease:', error);
      throw new Error(`Failed to fetch active lease: ${error.message}`);
    }

    return data as LeaseWithRelations;
  },

  /**
   * Get lease history for a property
   */
  async getLeaseHistory(propertyId: string): Promise<LeaseWithRelations[]> {
    const { data, error } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lease history:', error);
      throw new Error(`Failed to fetch lease history: ${error.message}`);
    }

    return data as LeaseWithRelations[];
  },

  /**
   * Sign a lease (owner or tenant)
   */
  async signLease(id: string, signatureData: SignatureData): Promise<Lease> {
    const updateData: any = {};
    
    if (signatureData.role === 'owner') {
      updateData.owner_signed_at = new Date().toISOString();
      updateData.owner_signature_url = signatureData.signature_url;
    } else {
      updateData.tenant_signed_at = new Date().toISOString();
      updateData.tenant_signature_url = signatureData.signature_url;
    }

    // Check if both parties have now signed
    const lease = await this.getLease(id);
    const bothSigned = 
      (signatureData.role === 'owner' && lease.tenant_signed_at) ||
      (signatureData.role === 'tenant' && lease.owner_signed_at);

    if (bothSigned) {
      updateData.status = 'active';
      updateData.executed_at = new Date().toISOString();
    } else {
      updateData.status = 'pending_signatures';
    }

    const { data, error } = await supabase
      .from('leases')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error signing lease:', error);
      throw new Error(`Failed to sign lease: ${error.message}`);
    }

    // If lease is now active, update property status
    if (bothSigned && lease.property_id) {
      await supabase
        .from('properties')
        .update({ status: 'rented' })
        .eq('id', lease.property_id);
      
      // TODO: Send notification to both parties
    }

    return data;
  },

  /**
   * Execute a lease (mark as active after both parties sign)
   */
  async executeLease(id: string): Promise<Lease> {
    const lease = await this.getLease(id);

    // Verify both parties have signed
    if (!lease.owner_signed_at || !lease.tenant_signed_at) {
      throw new Error('Both parties must sign before lease can be executed');
    }

    const { data, error } = await supabase
      .from('leases')
      .update({
        status: 'active',
        executed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error executing lease:', error);
      throw new Error(`Failed to execute lease: ${error.message}`);
    }

    // Update property status to rented
    if (lease.property_id) {
      await supabase
        .from('properties')
        .update({ status: 'rented' })
        .eq('id', lease.property_id);
    }

    // TODO: Send confirmation to both parties
    // TODO: Create initial payment schedule

    return data;
  },

  /**
   * Terminate a lease
   */
  async terminateLease(id: string, reason: string): Promise<Lease> {
    const lease = await this.getLease(id);

    const { data, error } = await supabase
      .from('leases')
      .update({
        status: 'terminated',
        terminated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error terminating lease:', error);
      throw new Error(`Failed to terminate lease: ${error.message}`);
    }

    // Update property status to available
    if (lease.property_id) {
      await supabase
        .from('properties')
        .update({ status: 'available' })
        .eq('id', lease.property_id);
    }

    // TODO: Send notification to both parties
    // TODO: Initiate move-out process

    return data;
  },

  /**
   * Check if lease is expiring soon (within 90 days)
   */
  isExpiringSoon(lease: Lease, daysThreshold: number = 90): boolean {
    const endDate = new Date(lease.end_date);
    const today = new Date();
    const daysUntilExpiry = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
  },

  /**
   * Check if lease is expired
   */
  isExpired(lease: Lease): boolean {
    const endDate = new Date(lease.end_date);
    const today = new Date();
    
    return endDate < today;
  },

  /**
   * Get expiring leases for an owner (within 90 days)
   */
  async getExpiringLeases(ownerId: string, daysThreshold: number = 90): Promise<LeaseWithRelations[]> {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

    const { data, error } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .lte('end_date', thresholdDate.toISOString())
      .gte('end_date', new Date().toISOString())
      .order('end_date', { ascending: true });

    if (error) {
      console.error('Error fetching expiring leases:', error);
      throw new Error(`Failed to fetch expiring leases: ${error.message}`);
    }

    return data as LeaseWithRelations[];
  },

  /**
   * Generate lease document (placeholder - would integrate with PDF generation)
   */
  async generateLeaseDocument(id: string): Promise<string> {
    const lease = await this.getLease(id);
    
    // TODO: Integrate with PDF generation service
    // For now, return a placeholder URL
    const documentUrl = `https://example.com/leases/${id}/document.pdf`;
    
    await this.updateLease(id, { document_url: documentUrl });
    
    return documentUrl;
  },

  /**
   * Get lease statistics for owner dashboard
   */
  async getLeaseStats(ownerId: string) {
    const { data: leases, error } = await supabase
      .from('leases')
      .select('id, status, end_date')
      .eq('owner_id', ownerId);

    if (error) {
      console.error('Error fetching lease stats:', error);
      throw new Error(`Failed to fetch lease stats: ${error.message}`);
    }

    const total = leases?.length || 0;
    const active = leases?.filter(l => l.status === 'active').length || 0;
    const expiring = leases?.filter(l => {
      if (l.status !== 'active') return false;
      const endDate = new Date(l.end_date);
      const today = new Date();
      const daysUntilExpiry = Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
    }).length || 0;

    return {
      total,
      active,
      expiring,
      expired: leases?.filter(l => l.status === 'expired').length || 0,
      terminated: leases?.filter(l => l.status === 'terminated').length || 0,
    };
  },
};
