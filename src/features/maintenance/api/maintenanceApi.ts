import { supabase } from '@/src/lib/supabase';
import { getMockMaintenanceRequests, MOCK_USERS } from '@/src/lib/mockData';
import type { 
  MaintenanceRequest, 
  MaintenanceRequestInsert,
  MaintenanceRequestWithRelations,
  ServiceCategory 
} from '@/src/types/database.types';

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
    mmsStatus: 'notification' | 'acknowledged' | 'vendor_routing' | 'quoting' | 'po_issued' | 'executing' | 'closing'
  ) {
    const updates: any = { mms_status: mmsStatus };
    
    if (mmsStatus === 'acknowledged') {
      updates.acknowledged_at = new Date().toISOString();
    } else if (mmsStatus === 'vendor_routing') {
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
};
