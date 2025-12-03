import { supabase } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database.types';

// Type aliases
type RentalApplication = Database['public']['Tables']['rental_applications']['Row'];
type RentalApplicationInsert = Database['public']['Tables']['rental_applications']['Insert'];
type RentalApplicationUpdate = Database['public']['Tables']['rental_applications']['Update'];

// Extended application with relations
export interface ApplicationWithRelations extends RentalApplication {
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    rent_amount: number;
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
export interface CreateApplicationInput {
  property_id: string;
  tenant_id: string;
  owner_id: string;
  
  // Personal Information
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  date_of_birth: string;
  
  // Employment Information
  employer?: string;
  position?: string;
  monthly_income?: number;
  employment_start_date?: string;
  employer_contact?: string;
  
  // Documents
  id_document_url?: string;
  proof_of_income_urls?: string[];
  reference_urls?: string[];
}

export interface UpdateApplicationInput {
  // Personal Information
  full_name?: string;
  email?: string;
  phone?: string;
  id_number?: string;
  date_of_birth?: string;
  
  // Employment Information
  employer?: string;
  position?: string;
  monthly_income?: number;
  employment_start_date?: string;
  employer_contact?: string;
  
  // Documents
  id_document_url?: string;
  proof_of_income_urls?: string[];
  reference_urls?: string[];
  
  // Screening
  background_check_status?: 'pending' | 'completed' | 'failed';
  background_check_result?: any;
  credit_check_status?: 'pending' | 'completed' | 'failed';
  credit_check_result?: any;
  identity_verification_status?: 'pending' | 'verified' | 'failed';
  affordability_ratio?: number;
}

export const applicationsApi = {
  /**
   * Create a new rental application (draft)
   */
  async createApplication(input: CreateApplicationInput): Promise<RentalApplication> {
    // Calculate affordability ratio if income provided
    let affordabilityRatio: number | null = null;
    if (input.monthly_income) {
      // Get property rent amount
      const { data: property } = await supabase
        .from('properties')
        .select('rent_amount')
        .eq('id', input.property_id)
        .single();
      
      if (property) {
        affordabilityRatio = property.rent_amount / input.monthly_income;
      }
    }

    const { data, error } = await supabase
      .from('rental_applications')
      .insert({
        property_id: input.property_id,
        tenant_id: input.tenant_id,
        owner_id: input.owner_id,
        status: 'draft',
        
        // Personal info
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
        id_number: input.id_number,
        date_of_birth: input.date_of_birth,
        
        // Employment
        employer: input.employer || null,
        position: input.position || null,
        monthly_income: input.monthly_income || null,
        employment_start_date: input.employment_start_date || null,
        employer_contact: input.employer_contact || null,
        
        // Documents
        id_document_url: input.id_document_url || null,
        proof_of_income_urls: input.proof_of_income_urls || null,
        reference_urls: input.reference_urls || null,
        
        // Screening
        affordability_ratio: affordabilityRatio,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating application:', error);
      throw new Error(`Failed to create application: ${error.message}`);
    }

    return data;
  },

  /**
   * Update an existing application
   */
  async updateApplication(
    id: string,
    input: UpdateApplicationInput
  ): Promise<RentalApplication> {
    const { data, error } = await supabase
      .from('rental_applications')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating application:', error);
      throw new Error(`Failed to update application: ${error.message}`);
    }

    return data;
  },

  /**
   * Submit an application (change status from draft to submitted)
   */
  async submitApplication(id: string): Promise<RentalApplication> {
    const { data, error } = await supabase
      .from('rental_applications')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error submitting application:', error);
      throw new Error(`Failed to submit application: ${error.message}`);
    }

    // TODO: Send notification to owner

    return data;
  },

  /**
   * Get a single application by ID with relations
   */
  async getApplication(id: string): Promise<ApplicationWithRelations> {
    const { data, error } = await supabase
      .from('rental_applications')
      .select(`
        *,
        property:properties!property_id(id, title, address, city, rent_amount),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching application:', error);
      throw new Error(`Failed to fetch application: ${error.message}`);
    }

    return data as ApplicationWithRelations;
  },

  /**
   * Get all applications for a tenant
   */
  async getTenantApplications(tenantId: string): Promise<ApplicationWithRelations[]> {
    const { data, error } = await supabase
      .from('rental_applications')
      .select(`
        *,
        property:properties!property_id(id, title, address, city, rent_amount),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tenant applications:', error);
      throw new Error(`Failed to fetch tenant applications: ${error.message}`);
    }

    return data as ApplicationWithRelations[];
  },

  /**
   * Get all applications for an owner (across all properties)
   */
  async getOwnerApplications(ownerId: string): Promise<ApplicationWithRelations[]> {
    const { data, error } = await supabase
      .from('rental_applications')
      .select(`
        *,
        property:properties!property_id(id, title, address, city, rent_amount),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching owner applications:', error);
      throw new Error(`Failed to fetch owner applications: ${error.message}`);
    }

    return data as ApplicationWithRelations[];
  },

  /**
   * Get all applications for a specific property
   */
  async getPropertyApplications(propertyId: string): Promise<ApplicationWithRelations[]> {
    const { data, error } = await supabase
      .from('rental_applications')
      .select(`
        *,
        property:properties!property_id(id, title, address, city, rent_amount),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false});

    if (error) {
      console.error('Error fetching property applications:', error);
      throw new Error(`Failed to fetch property applications: ${error.message}`);
    }

    return data as ApplicationWithRelations[];
  },

  /**
   * Approve an application
   */
  async approveApplication(id: string): Promise<RentalApplication> {
    const { data, error } = await supabase
      .from('rental_applications')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error approving application:', error);
      throw new Error(`Failed to approve application: ${error.message}`);
    }

    // TODO: Send notification to tenant
    // TODO: Reject other pending applications for the same property

    return data;
  },

  /**
   * Reject an application with reason
   */
  async rejectApplication(id: string, reason?: string): Promise<RentalApplication> {
    const { data, error } = await supabase
      .from('rental_applications')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        // Note: rejection_reason field would need to be added to schema
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error rejecting application:', error);
      throw new Error(`Failed to reject application: ${error.message}`);
    }

    // TODO: Send notification to tenant with reason

    return data;
  },

  /**
   * Request additional documents from applicant
   */
  async requestAdditionalDocuments(
    id: string,
    documents: string[]
  ): Promise<void> {
    // TODO: Implement notification system to request documents
    // For now, just update status to under_review
    await supabase
      .from('rental_applications')
      .update({ status: 'under_review' })
      .eq('id', id);

    // TODO: Send notification to tenant listing required documents
    console.log(`Requesting additional documents for application ${id}:`, documents);
  },

  /**
   * Initiate background check
   */
  async initiateBackgroundCheck(id: string): Promise<void> {
    const { error } = await supabase
      .from('rental_applications')
      .update({
        background_check_status: 'pending',
      })
      .eq('id', id);

    if (error) {
      console.error('Error initiating background check:', error);
      throw new Error(`Failed to initiate background check: ${error.message}`);
    }

    // TODO: Integrate with background check service
    console.log(`Background check initiated for application ${id}`);
  },

  /**
   * Initiate credit check
   */
  async initiateCreditCheck(id: string): Promise<void> {
    const { error } = await supabase
      .from('rental_applications')
      .update({
        credit_check_status: 'pending',
      })
      .eq('id', id);

    if (error) {
      console.error('Error initiating credit check:', error);
      throw new Error(`Failed to initiate credit check: ${error.message}`);
    }

    // TODO: Integrate with TransUnion or other credit check service
    console.log(`Credit check initiated for application ${id}`);
  },

  /**
   * Verify identity
   */
  async verifyIdentity(id: string): Promise<void> {
    const { error } = await supabase
      .from('rental_applications')
      .update({
        identity_verification_status: 'pending',
      })
      .eq('id', id);

    if (error) {
      console.error('Error initiating identity verification:', error);
      throw new Error(`Failed to initiate identity verification: ${error.message}`);
    }

    // TODO: Integrate with Onfido or Smile Identity
    console.log(`Identity verification initiated for application ${id}`);
  },

  /**
   * Calculate affordability ratio
   * Rent should be <= 30% of monthly income
   */
  calculateAffordability(income: number, rent: number): number {
    if (income <= 0) return 1; // 100% - unaffordable
    return rent / income;
  },

  /**
   * Check if applicant is affordable
   */
  isAffordable(income: number, rent: number, threshold: number = 0.30): boolean {
    const ratio = this.calculateAffordability(income, rent);
    return ratio <= threshold;
  },

  /**
   * Get application statistics for owner dashboard
   */
  async getApplicationStats(ownerId: string) {
    const { data: applications, error } = await supabase
      .from('rental_applications')
      .select('id, status')
      .eq('owner_id', ownerId);

    if (error) {
      console.error('Error fetching application stats:', error);
      throw new Error(`Failed to fetch application stats: ${error.message}`);
    }

    const total = applications?.length || 0;
    const pending = applications?.filter(a => a.status === 'submitted' || a.status === 'under_review').length || 0;
    const approved = applications?.filter(a => a.status === 'approved').length || 0;
    const rejected = applications?.filter(a => a.status === 'rejected').length || 0;

    return {
      total,
      pending,
      approved,
      rejected,
      approvalRate: total > 0 ? (approved / total) * 100 : 0,
    };
  },
};
