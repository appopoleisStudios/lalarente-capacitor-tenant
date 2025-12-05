import { supabase } from '@/src/lib/supabase';
import { getMockMaintenanceRequests, MOCK_USERS } from '@/src/lib/mockData';
import type {
  MaintenanceRequest,
  MaintenanceRequestInsert,
  MaintenanceRequestWithRelations,
  ServiceCategory
} from '@/src/types/maintenance.types';

// Feature flag for mock mode
const USE_MOCK_DATA = false; // ✅ Changed to false - using real data now

export interface CreateMaintenanceRequestInput {
  property_id: string;
  owner_id: string;  // REQUIRED
  tenant_id: string; // Who reported it
  category_id?: string;
  priority?: 'low' | 'medium' | 'high';
  visibility?: 'public' | 'invited' | 'private';
  title: string;
  description: string;
  images?: string[]; // Array of URLs
}

export const maintenanceApi = {
  // Fetch maintenance requests with role-based filtering
  async getMaintenanceRequests(userId: string, role?: 'owner' | 'tenant' | 'vendor') {
    // Build query based on role
    let query = supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, avatar_url, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone),
        category:service_categories(id, name, description),
        selected_vendor:profiles!selected_vendor_id(id, full_name, phone)
      `);

    // Apply role-based filter
    if (role === 'owner') {
      query = query.eq('owner_id', userId);
    } else if (role === 'tenant') {
      query = query.eq('tenant_id', userId);
    } else if (role === 'vendor') {
      query = query.eq('selected_vendor_id', userId);
    } else {
      // Default to owner if role not specified
      query = query.eq('owner_id', userId);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  // Fetch single request with all relations
  async getMaintenanceRequestById(id: string) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address, city, owner_id),
        tenant:profiles!tenant_id(id, full_name, avatar_url, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone),
        category:service_categories(id, name, description),
        selected_vendor:profiles!selected_vendor_id(id, full_name, phone),
        quotes!request_id(
          id, 
          vendor_id,
          total_amount,
          status,
          created_at,
          vendor:profiles!vendor_id(full_name, phone)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create maintenance request
  async createMaintenanceRequest(input: CreateMaintenanceRequestInput) {
    // If tenant is creating, get owner_id from property
    let ownerId = input.owner_id;
    if (!ownerId && input.property_id) {
      ownerId = await this.getPropertyOwner(input.property_id);
    }

    if (!ownerId) {
      throw new Error('Owner ID is required');
    }

    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert({
        property_id: input.property_id,
        owner_id: ownerId,
        tenant_id: input.tenant_id || null,
        category_id: input.category_id || null,
        title: input.title,
        description: input.description,
        priority: input.priority || 'medium',
        status: 'open',
        mms_status: 'notification',
        visibility: input.visibility || 'invited',
        images: input.images || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Update status
  async updateStatus(
    id: string,
    status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'
  ) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Update MMS status (workflow tracking)
  async updateMmsStatus(
    id: string,
    mmsStatus: 'notification' | 'acknowledged' | 'vendor_routed' | 'quote_received' | 'po_issued' | 'in_progress' | 'completed'
  ) {
    const updates: any = { mms_status: mmsStatus };

    if (mmsStatus === 'acknowledged') {
      updates.acknowledged_at = new Date().toISOString();
    } else if (mmsStatus === 'vendor_routed') {
      updates.vendor_routed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Update priority
  async updatePriority(id: string, priority: 'low' | 'medium' | 'high') {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update({ priority })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Acknowledge request (Owner reviews)
  async acknowledgeRequest(id: string) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update({
        mms_status: 'acknowledged',
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Filter by status
  async filterByStatus(
    ownerId: string,
    statuses: Array<'open' | 'assigned' | 'in_progress' | 'completed' | 'closed'>
  ) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address),
        category:service_categories(id, name)
      `)
      .eq('owner_id', ownerId)
      .in('status', statuses)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Filter by priority
  async filterByPriority(
    ownerId: string,
    priorities: Array<'low' | 'medium' | 'high'>
  ) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address),
        category:service_categories(id, name)
      `)
      .eq('owner_id', ownerId)
      .in('priority', priorities)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get service categories (Plumbing, Electrical, etc.)
  async getServiceCategories() {
    const { data, error } = await supabase
      .from('service_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data as ServiceCategory[];
  },

  // Get owner's properties
  async getOwnerProperties(ownerId: string) {
    const { data, error } = await supabase
      .from('properties')
      .select('id, title, address, city')
      .eq('owner_id', ownerId)
      .order('title');

    if (error) throw error;
    return data;
  },

  // Get property owner (for tenant-created requests)
  async getPropertyOwner(propertyId: string) {
    const { data, error } = await supabase
      .from('properties')
      .select('owner_id')
      .eq('id', propertyId)
      .single();

    if (error) throw error;
    return data?.owner_id;
  },

  // Update maintenance request (full update)
  async updateMaintenanceRequest(
    id: string,
    updates: {
      title?: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high';
      category_id?: string;
      images?: string[];
    }
  ) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Delete maintenance request
  async deleteMaintenanceRequest(id: string) {
    const { error } = await supabase
      .from('maintenance_requests')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return { success: true };
  },

  // Close request (mark as closed)
  async closeRequest(id: string) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update({
        status: 'closed',
        completed_date: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Real-time subscription
  subscribeToMaintenanceRequests(
    ownerId: string,
    callback: (payload: any) => void
  ) {
    const subscription = supabase
      .channel('maintenance_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'maintenance_requests',
          filter: `owner_id=eq.${ownerId}`,
        },
        callback
      )
      .subscribe();

    return subscription;
  },

  // Unsubscribe
  unsubscribe(subscription: any) {
    subscription.unsubscribe();
  },

  // ============================================
  // VENDOR FILTERING BY CATEGORY (Phase 2)
  // ============================================

  // Get vendors by category (for Open Market requests)
  async getVendorsByCategory(categoryId: string) {
    const { data, error } = await supabase
      .from('vendor_services')
      .select(`
        vendor_id,
        vendor:profiles!vendor_id(
          id,
          full_name,
          email,
          phone,
          avatar_url,
          business_name,
          rating
        )
      `)
      .eq('category_id', categoryId)
      .eq('is_active', true);

    if (error) throw error;

    // Extract unique vendors (a vendor might have multiple services in same category)
    const uniqueVendors = Array.from(
      new Map(data?.map(item => [item.vendor_id, item.vendor]) || []).values()
    );

    return uniqueVendors;
  },

  // Get dedicated vendors for a property (for Invite Only requests)
  async getDedicatedVendors(propertyId: string, categoryId?: string) {
    let query = supabase
      .from('dedicated_vendors')
      .select(`
        vendor_id,
        category_id,
        priority,
        vendor:profiles!vendor_id(
          id,
          full_name,
          email,
          phone,
          avatar_url,
          business_name,
          rating
        )
      `)
      .eq('property_id', propertyId)
      .eq('is_active', true);

    // If category specified, filter by it (or get vendors with NULL category = handles all)
    if (categoryId) {
      query = query.or(`category_id.eq.${categoryId},category_id.is.null`);
    }

    query = query.order('priority', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    return data?.map(item => item.vendor) || [];
  },

  // Get vendors for a maintenance request (based on visibility and category)
  async getVendorsForRequest(requestId: string) {
    // First get the request details
    const request = await this.getMaintenanceRequestById(requestId);

    if (!request) {
      throw new Error('Request not found');
    }

    // If visibility is 'public' (Open Market), get all vendors in category
    if (request.visibility === 'public' && request.category_id) {
      return this.getVendorsByCategory(request.category_id);
    }

    // If visibility is 'invited' (Invite Only), get dedicated vendors
    if (request.visibility === 'invited' && request.property_id) {
      return this.getDedicatedVendors(request.property_id, request.category_id || undefined);
    }

    // Default: return empty array
    return [];
  },

  // ============================================
  // VENDOR LOOKUP BY EMAIL (Phase 2 - Email Invite)
  // ============================================

  // Search vendor by email
  async searchVendorByEmail(email: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        full_name,
        email,
        phone,
        avatar_url,
        business_name,
        rating,
        role
      `)
      .eq('email', email.toLowerCase().trim())
      .eq('role', 'vendor')
      .single();

    if (error) {
      // If not found, return null (not an error)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data;
  },

  // Get vendor's service categories
  async getVendorCategories(vendorId: string) {
    const { data, error } = await supabase
      .from('vendor_services')
      .select(`
        category_id,
        category:service_categories!category_id(
          id,
          name,
          description
        )
      `)
      .eq('vendor_id', vendorId)
      .eq('is_active', true);

    if (error) throw error;

    // Extract unique categories
    const uniqueCategories = Array.from(
      new Map(data?.map(item => [item.category_id, item.category]) || []).values()
    );

    return uniqueCategories;
  },

  // Invite vendor by email (if not registered yet)
  async inviteVendorByEmail(email: string, requestId: string, ownerName: string) {
    // This would typically send an email/SMS invitation
    // For now, we'll just create a pending invitation record

    // TODO: Implement invitation system
    // - Send email with registration link
    // - Include request details
    // - Track invitation status

    console.log(`Invitation sent to ${email} for request ${requestId} by ${ownerName}`);

    return {
      success: true,
      message: 'Invitation sent',
      email,
    };
  },

  // ============================================
  // PUSH TO VENDORS (Route request to vendors)
  // ============================================

  // Push request to open market (public visibility)
  async pushToOpenMarket(requestId: string) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update({
        visibility: 'public',
        vendor_routed_at: new Date().toISOString(),
        mms_status: 'vendor_routed',
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return data as MaintenanceRequest;
  },

  // Push request to dedicated vendors (invited visibility)
  async pushToDedicatedVendors(requestId: string) {
    // Get the request details
    const request = await this.getMaintenanceRequestById(requestId);

    if (!request || !request.property_id) {
      throw new Error('Request or property not found');
    }

    // Get dedicated vendors for this property
    const vendors = await this.getDedicatedVendors(
      request.property_id,
      request.category_id || undefined
    );

    if (vendors.length === 0) {
      throw new Error('No dedicated vendors found for this property');
    }

    // Create vendor_quote_requests for each dedicated vendor
    const quoteRequests = vendors.map(vendor => ({
      request_id: requestId,
      vendor_id: vendor.id,
      status: 'pending',
      response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    }));

    const { error: insertError } = await supabase
      .from('vendor_quote_requests')
      .insert(quoteRequests);

    if (insertError) throw insertError;

    // Update request visibility and routing timestamp
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update({
        visibility: 'invited',
        vendor_routed_at: new Date().toISOString(),
        mms_status: 'vendor_routed',
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    // TODO: Send notifications to vendors
    // - Push notifications
    // - SMS notifications
    // - Email notifications

    return {
      request: data as MaintenanceRequest,
      vendorsNotified: vendors.length,
    };
  },

  // Push request to specific vendors (custom selection)
  async pushToSelectedVendors(requestId: string, vendorIds: string[]) {
    if (vendorIds.length === 0) {
      throw new Error('No vendors selected');
    }

    // Create vendor_quote_requests for selected vendors
    const quoteRequests = vendorIds.map(vendorId => ({
      request_id: requestId,
      vendor_id: vendorId,
      status: 'pending',
      response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    }));

    const { error: insertError } = await supabase
      .from('vendor_quote_requests')
      .insert(quoteRequests);

    if (insertError) throw insertError;

    // Update request visibility and routing timestamp
    const { data, error } = await supabase
      .from('maintenance_requests')
      .update({
        visibility: 'invited',
        vendor_routed_at: new Date().toISOString(),
        mms_status: 'vendor_routed',
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    // TODO: Send notifications to selected vendors

    return {
      request: data as MaintenanceRequest,
      vendorsNotified: vendorIds.length,
    };
  },

  /**
   * Start work on a maintenance request (Vendor action)
   * Updates status to 'in_progress' and records work start time
   * 
   * @param requestId - The maintenance request ID
   * @param vendorId - The vendor's user ID
   * @returns Updated maintenance request
   */
  async startWork(requestId: string, vendorId: string) {
    console.log('🚀 Starting work:', { requestId, vendorId });

    // Verify vendor is assigned to this job
    const { data: request, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('id, selected_vendor_id, status, work_can_start')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;

    const typedRequest = request as any;

    if (typedRequest.selected_vendor_id !== vendorId) {
      throw new Error('You are not assigned to this job');
    }

    if (typedRequest.status !== 'assigned') {
      throw new Error('Job is not in assigned status');
    }

    if (!typedRequest.work_can_start) {
      throw new Error('Work cannot be started yet. Please wait for owner approval.');
    }

    // Update maintenance request
    const { data, error } = await (supabase
      .from('maintenance_requests') as any)
      .update({
        status: 'in_progress',
        work_started_at: new Date().toISOString(),
        work_started_by: vendorId,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error starting work:', error);
      throw error;
    }

    console.log('✅ Work started successfully');
    return data;
  },

  /**
   * Submit daily progress update (Vendor action)
   * 
   * @param requestId - The maintenance request ID
   * @param vendorId - The vendor's user ID
   * @param notes - Progress notes
   * @param photos - Array of photo URLs
   * @returns Created progress update
   */
  async submitProgressUpdate(
    requestId: string,
    vendorId: string,
    notes: string,
    photos: string[]
  ) {
    console.log('📸 Submitting progress update:', { requestId, vendorId });

    // Verify vendor is assigned and work is in progress
    const { data: request, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('id, selected_vendor_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;

    const typedRequest = request as any;

    if (typedRequest.selected_vendor_id !== vendorId) {
      throw new Error('You are not assigned to this job');
    }

    if (typedRequest.status !== 'in_progress') {
      throw new Error('Work must be in progress to submit updates');
    }

    // Create progress update
    const { data, error } = await (supabase
      .from('job_progress_updates') as any)
      .insert({
        maintenance_request_id: requestId,
        vendor_id: vendorId,
        update_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        notes: notes,
        photos: photos,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error submitting progress update:', error);
      throw error;
    }

    console.log('✅ Progress update submitted');
    return data;
  },

  /**
   * Get progress updates for a maintenance request
   * 
   * @param requestId - The maintenance request ID
   * @returns Array of progress updates
   */
  async getProgressUpdates(requestId: string) {
    const { data, error } = await supabase
      .from('job_progress_updates')
      .select('*')
      .eq('maintenance_request_id', requestId)
      .order('update_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Request job closure (Vendor action)
   * 
   * @param requestId - The maintenance request ID
   * @param vendorId - The vendor's user ID
   * @param completionNotes - Notes about the completed work
   * @param completionPhotos - Array of completion photo URLs (minimum 2)
   * @returns Created closure report
   */
  async requestClosure(
    requestId: string,
    vendorId: string,
    completionNotes: string,
    completionPhotos: string[]
  ) {
    console.log('🏁 Requesting job closure:', { requestId, vendorId });

    if (completionPhotos.length < 2) {
      throw new Error('Please upload at least 2 completion photos');
    }

    // Verify vendor is assigned and work is in progress
    const { data: request, error: fetchError } = await supabase
      .from('maintenance_requests')
      .select('id, selected_vendor_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;

    const typedRequest = request as any;

    if (typedRequest.selected_vendor_id !== vendorId) {
      throw new Error('You are not assigned to this job');
    }

    if (typedRequest.status !== 'in_progress') {
      throw new Error('Work must be in progress to request closure');
    }

    // Create closure report
    const { data: closureReport, error: closureError } = await (supabase
      .from('closure_reports') as any)
      .insert({
        maintenance_request_id: requestId,
        completion_notes: completionNotes,
        completion_photos: completionPhotos,
        status: 'pending',
      })
      .select()
      .single();

    if (closureError) {
      console.error('❌ Error creating closure report:', closureError);
      throw closureError;
    }

    // Update maintenance request
    const { error: updateError } = await (supabase
      .from('maintenance_requests') as any)
      .update({
        closure_requested_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Error updating maintenance request:', updateError);
      throw updateError;
    }

    console.log('✅ Closure requested successfully');
    return closureReport;
  },

  /**
   * Get closure report for a maintenance request
   * 
   * @param requestId - The maintenance request ID
   * @returns Closure report or null
   */
  async getClosureReport(requestId: string) {
    const { data, error } = await supabase
      .from('closure_reports')
      .select('*')
      .eq('maintenance_request_id', requestId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};


// ============================================
// VENDOR-SPECIFIC METHODS
// ============================================

/**
 * Vendor-specific maintenance request with additional vendor context
 */
export interface VendorMaintenanceRequest extends MaintenanceRequest {
  property?: {
    id: string;
    title: string;
    address: string;
    city: string;
    province: string;
  };
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  owner?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  tenant?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  };
  // Vendor-specific fields
  my_quote?: {
    id: string;
    status: string;
    total_amount: number | null;
    created_at: string;
    revision_reason?: string | null;
  };
  has_quote_request?: boolean;
  can_quote?: boolean; // Whether vendor has matching category to submit quote
}

export interface VendorMaintenanceFilters {
  status?: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed';
  category?: string;
  hasQuote?: boolean;
}

export interface JobStatusUpdate {
  status: 'in_progress' | 'completed';
  completion_notes?: string;
  completion_photos?: string[];
}

export interface QuoteSubmission {
  request_id: string;
  subtotal: number;
  vat_amount: number;
  discount_amount?: number;
  total_amount: number;
  notes?: string;
  validity_days?: number;
}

export const vendorMaintenanceApi = {
  /**
   * Get available maintenance requests for a vendor
   * Returns requests where:
   * - visibility = 'public' (Open Market) - ALL vendors can see
   * - vendor has a quote_request (Invited)
   * - vendor is a dedicated vendor for the property
   * 
   * @param vendorId - The vendor's user ID
   * @param filters - Optional filters for status, category, quote status
   * @returns Array of maintenance requests accessible to the vendor
   */
  async getAvailableRequests(
    vendorId: string,
    filters?: VendorMaintenanceFilters
  ): Promise<VendorMaintenanceRequest[]> {
    // Build the base query
    let query = supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address, city, province),
        category:service_categories(id, name),
        owner:profiles!owner_id(id, full_name, email, phone),
        tenant:profiles!tenant_id(id, full_name, phone)
      `);

    // Apply status filter if provided
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    // Apply category filter if provided
    if (filters?.category) {
      query = query.eq('category_id', filters.category);
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data: requests, error } = await query;

    if (error) throw error;

    if (!requests) return [];

    // Type assertion for the query result
    const typedRequests = requests as any[];

    // Now filter based on vendor access rules
    // We need to check:
    // 1. Public requests (ALL vendors can see)
    // 2. Invited requests (vendor has quote_request)
    // 3. Dedicated vendor relationships

    // Get vendor's service categories
    const { data: vendorServices, error: servicesError } = await supabase
      .from('vendor_services')
      .select('category_id')
      .eq('vendor_id', vendorId)
      .eq('is_active', true);

    if (servicesError) throw servicesError;

    const vendorCategoryIds = (vendorServices as any[])?.map((vs: any) => vs.category_id) || [];

    // Get vendor's quote requests
    const { data: quoteRequests, error: quoteRequestsError } = await supabase
      .from('vendor_quote_requests')
      .select('request_id, quote_id, status')
      .eq('vendor_id', vendorId);

    if (quoteRequestsError) throw quoteRequestsError;

    const quoteRequestMap = new Map(
      (quoteRequests as any[])?.map((qr: any) => [qr.request_id, qr]) || []
    );

    // Get vendor's quotes
    const { data: vendorQuotes, error: quotesError } = await supabase
      .from('quotes')
      .select('id, request_id, status, total_amount, created_at')
      .eq('vendor_id', vendorId);

    if (quotesError) throw quotesError;

    const quotesByRequest = new Map(
      (vendorQuotes as any[])?.map((q: any) => [q.request_id, q]) || []
    );

    // Get dedicated vendor relationships
    const { data: dedicatedVendorRels, error: dedicatedError } = await supabase
      .from('dedicated_vendors')
      .select('property_id, category_id')
      .eq('vendor_id', vendorId)
      .eq('is_active', true);

    if (dedicatedError) throw dedicatedError;

    const typedDedicatedVendors = dedicatedVendorRels as any[];
    const dedicatedPropertyIds = new Set(
      typedDedicatedVendors?.map((dv: any) => dv.property_id) || []
    );

    // Filter requests based on access rules
    const accessibleRequests = typedRequests.filter(request => {
      // Check if vendor has a quote for this request
      const hasQuote = quotesByRequest.has(request.id);

      // Apply hasQuote filter if specified
      if (filters?.hasQuote !== undefined) {
        if (filters.hasQuote && !hasQuote) return false;
        if (!filters.hasQuote && hasQuote) return false;
      }

      // Rule 1: ALL public requests are visible to ALL vendors (Open Market)
      // Vendors can see them but can only quote if they have matching category
      if (request.visibility === 'public') {
        return true;
      }

      // Rule 2: Invited requests (vendor has quote_request)
      if (request.visibility === 'invited') {
        if (quoteRequestMap.has(request.id)) {
          return true;
        }
      }

      // Rule 3: Dedicated vendor for property
      if (request.property_id && dedicatedPropertyIds.has(request.property_id)) {
        // If dedicated vendor has no category restriction, or matches the request category
        const dedicatedRel = typedDedicatedVendors?.find(
          (dv: any) => dv.property_id === request.property_id
        );
        if (!dedicatedRel?.category_id || dedicatedRel.category_id === request.category_id) {
          return true;
        }
      }

      // Rule 4: Vendor is selected for this request
      if (request.selected_vendor_id === vendorId) {
        return true;
      }

      return false;
    });

    // Enrich with vendor-specific data
    const enrichedRequests: VendorMaintenanceRequest[] = accessibleRequests.map(request => {
      const quote = quotesByRequest.get(request.id);
      const hasQuoteRequest = quoteRequestMap.has(request.id);

      // Check if vendor can quote (has matching category or is invited/dedicated)
      const canQuote =
        hasQuoteRequest || // Invited vendors can always quote
        request.selected_vendor_id === vendorId || // Selected vendor can quote
        (request.category_id && vendorCategoryIds.includes(request.category_id)) || // Category match
        (request.property_id && dedicatedPropertyIds.has(request.property_id)); // Dedicated vendor

      return {
        ...request,
        my_quote: quote ? {
          id: quote.id,
          status: quote.status,
          total_amount: quote.total_amount,
          created_at: quote.created_at,
        } : undefined,
        has_quote_request: hasQuoteRequest,
        can_quote: canQuote,
      };
    });

    return enrichedRequests;
  },

  /**
   * Get full details of a maintenance request
   * Includes all related data and vendor-specific context
   * 
   * @param requestId - The maintenance request ID
   * @param vendorId - The vendor's user ID (for access check)
   * @returns Full maintenance request details
   */
  async getRequestById(
    requestId: string,
    vendorId: string
  ): Promise<VendorMaintenanceRequest> {
    const { data: request, error } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address, city, province),
        category:service_categories(id, name),
        owner:profiles!owner_id(id, full_name, email, phone),
        tenant:profiles!tenant_id(id, full_name, phone)
      `)
      .eq('id', requestId)
      .single();

    if (error) throw error;

    const typedRequest = request as any;

    // Get vendor's quote for this request
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, status, total_amount, created_at, revision_reason')
      .eq('request_id', requestId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    const typedQuote = quote as any;

    // Check if vendor has a quote request
    const { data: quoteRequest } = await supabase
      .from('vendor_quote_requests')
      .select('id')
      .eq('request_id', requestId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    // Get vendor's service categories to check if they can quote
    const { data: vendorServices } = await supabase
      .from('vendor_services')
      .select('category_id')
      .eq('vendor_id', vendorId)
      .eq('is_active', true);

    const vendorCategoryIds = (vendorServices as any[])?.map((vs: any) => vs.category_id) || [];

    // Check if vendor is a dedicated vendor for this property
    const { data: dedicatedVendor } = await supabase
      .from('dedicated_vendors')
      .select('id')
      .eq('vendor_id', vendorId)
      .eq('property_id', typedRequest.property_id)
      .eq('is_active', true)
      .maybeSingle();

    // Determine if vendor can quote
    const canQuote =
      !!quoteRequest || // Invited vendors can always quote
      typedRequest.selected_vendor_id === vendorId || // Selected vendor can quote
      (typedRequest.category_id && vendorCategoryIds.includes(typedRequest.category_id)) || // Category match
      !!dedicatedVendor; // Dedicated vendor

    return {
      ...typedRequest,
      my_quote: typedQuote ? {
        id: typedQuote.id,
        status: typedQuote.status,
        total_amount: typedQuote.total_amount,
        created_at: typedQuote.created_at,
        revision_reason: typedQuote.revision_reason,
      } : undefined,
      has_quote_request: !!quoteRequest,
      can_quote: canQuote,
    };
  },

  /**
   * Get vendor's active jobs (requests where their quote was accepted)
   * 
   * @param vendorId - The vendor's user ID
   * @returns Array of active job requests
   */
  async getMyJobs(vendorId: string): Promise<VendorMaintenanceRequest[]> {
    // Get requests where vendor is selected
    const { data: requests, error } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address, city, province),
        category:service_categories(id, name),
        owner:profiles!owner_id(id, full_name, email, phone),
        tenant:profiles!tenant_id(id, full_name, phone)
      `)
      .eq('selected_vendor_id', vendorId)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests) return [];

    const typedRequests = requests as any[];

    // Get vendor's quotes for these requests
    const requestIds = typedRequests.map((r: any) => r.id);
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, request_id, status, total_amount, created_at')
      .eq('vendor_id', vendorId)
      .in('request_id', requestIds);

    const typedQuotes = quotes as any[];

    const quotesByRequest = new Map(
      typedQuotes?.map((q: any) => [q.request_id, q]) || []
    );

    // Enrich with vendor-specific data
    const enrichedRequests: VendorMaintenanceRequest[] = typedRequests.map((request: any) => {
      const quote = quotesByRequest.get(request.id);

      return {
        ...request,
        my_quote: quote ? {
          id: quote.id,
          status: quote.status,
          total_amount: quote.total_amount,
          created_at: quote.created_at,
        } : undefined,
        can_quote: true, // Selected vendors can always quote
      };
    });

    return enrichedRequests;
  },

  /**
   * Update job status (vendor action)
   * Allows vendor to start work or mark as completed
   * 
   * @param requestId - The maintenance request ID
   * @param vendorId - The vendor's user ID (for access check)
   * @param update - Status update data
   * @returns Updated maintenance request
   */
  async updateJobStatus(
    requestId: string,
    vendorId: string,
    update: JobStatusUpdate
  ): Promise<MaintenanceRequest> {
    // Verify vendor is assigned to this request
    const { data: request } = await supabase
      .from('maintenance_requests')
      .select('selected_vendor_id, status, images')
      .eq('id', requestId)
      .single();

    const typedRequest = request as any;

    if (!typedRequest) {
      throw new Error('Request not found');
    }

    if (typedRequest.selected_vendor_id !== vendorId) {
      throw new Error('You are not assigned to this request');
    }

    // Prepare update data
    const updateData: any = {
      status: update.status,
    };

    // If marking as completed, add completion data
    if (update.status === 'completed') {
      updateData.completed_date = new Date().toISOString();

      if (update.completion_notes) {
        // Store completion notes in a way that makes sense for your schema
        // You might want to add a completion_notes field to maintenance_requests
        updateData.description = `${typedRequest.status}\n\nCompletion Notes: ${update.completion_notes}`;
      }

      // Handle completion photos
      if (update.completion_photos && update.completion_photos.length > 0) {
        const existingImages = (typedRequest.images as string[]) || [];
        updateData.images = [...existingImages, ...update.completion_photos];
      }
    }

    // Update the request
    const { data, error } = await (supabase
      .from('maintenance_requests') as any)
      .update(updateData)
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    return data as MaintenanceRequest;
  },

  /**
   * Submit a quote for a maintenance request
   * Creates a quote and updates the vendor_quote_request status
   * 
   * @param vendorId - The vendor's user ID
   * @param quoteData - Quote submission data
   * @returns Created quote
   */
  async submitQuote(
    vendorId: string,
    quoteData: QuoteSubmission
  ) {
    // Validate that vendor has access to this request
    const request = await this.getRequestById(quoteData.request_id, vendorId);

    if (!request.has_quote_request && request.visibility !== 'public') {
      throw new Error('You do not have permission to quote on this request');
    }

    // Check if vendor can quote (has matching category)
    if (!request.can_quote) {
      throw new Error('You do not have the required service category to quote on this request');
    }

    // Validate quote amounts
    if (quoteData.subtotal <= 0) {
      throw new Error('Subtotal must be greater than 0');
    }

    if (quoteData.total_amount <= 0) {
      throw new Error('Total amount must be greater than 0');
    }

    // Calculate validity date
    const validityDate = new Date();
    validityDate.setDate(validityDate.getDate() + (quoteData.validity_days || 7));

    // Get owner and property info from request
    const ownerId = request.owner_id;
    const propertyId = request.property_id;

    // Create the quote
    const { data: quote, error: quoteError } = await (supabase
      .from('quotes') as any)
      .insert({
        vendor_id: vendorId,
        owner_id: ownerId,
        property_id: propertyId,
        request_id: quoteData.request_id,
        contract_id: null, // Ad-hoc quote, not from contract
        status: 'submitted',
        subtotal: quoteData.subtotal,
        vat_amount: quoteData.vat_amount,
        discount_amount: quoteData.discount_amount || 0,
        total_amount: quoteData.total_amount,
        notes: quoteData.notes,
        revision_number: 1,
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    // Update vendor_quote_request if it exists
    if (request.has_quote_request) {
      const { error: updateError } = await (supabase
        .from('vendor_quote_requests') as any)
        .update({
          status: 'responded',
          responded_at: new Date().toISOString(),
          quote_id: quote.id,
        })
        .eq('request_id', quoteData.request_id)
        .eq('vendor_id', vendorId);

      if (updateError) {
        console.error('Failed to update vendor_quote_request:', updateError);
        // Don't throw - quote was created successfully
      }
    }

    // Update maintenance request status to 'quoting' if still 'open'
    const { error: requestUpdateError } = await (supabase
      .from('maintenance_requests') as any)
      .update({
        mms_status: 'quoting',
      })
      .eq('id', quoteData.request_id)
      .eq('mms_status', 'vendor_routing');

    if (requestUpdateError) {
      console.error('Failed to update maintenance request status:', requestUpdateError);
      // Don't throw - quote was created successfully
    }

    return quote;
  },

  /**
   * Decline a quote request
   * Updates the vendor_quote_request status to declined
   * 
   * @param vendorId - The vendor's user ID
   * @param requestId - The maintenance request ID
   * @param reason - Optional reason for declining
   */
  async declineQuoteRequest(
    vendorId: string,
    requestId: string,
    reason?: string
  ) {
    // Verify vendor has a quote request for this
    const { data: quoteRequest, error: fetchError } = await supabase
      .from('vendor_quote_requests')
      .select('id, status')
      .eq('request_id', requestId)
      .eq('vendor_id', vendorId)
      .maybeSingle();

    if (fetchError) throw fetchError;

    const typedQuoteRequest = quoteRequest as any;

    if (!typedQuoteRequest) {
      throw new Error('No quote request found for this maintenance request');
    }

    if (typedQuoteRequest.status !== 'pending') {
      throw new Error('Quote request has already been responded to');
    }

    // Update the quote request status
    const { error: updateError } = await (supabase
      .from('vendor_quote_requests') as any)
      .update({
        status: 'declined',
        responded_at: new Date().toISOString(),
      })
      .eq('id', typedQuoteRequest.id);

    if (updateError) throw updateError;

    return { success: true, message: 'Quote request declined' };
  },
};

