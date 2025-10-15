import { supabase } from '@/src/lib/supabase';
import { getMockMaintenanceRequests, MOCK_USERS } from '@/src/lib/mockData';
import type { 
  MaintenanceRequest, 
  MaintenanceRequestInsert,
  MaintenanceRequestWithRelations,
  ServiceCategory 
} from '@/src/types/database.types';

// Feature flag for mock mode
const USE_MOCK_DATA = true;

export interface CreateMaintenanceRequestInput {
  property_id: string;
  owner_id: string;  // REQUIRED
  tenant_id: string; // Who reported it
  category_id?: string;
  priority?: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  images?: string[]; // Array of URLs
}

export const maintenanceApi = {
  // Fetch maintenance requests for owner
  async getMaintenanceRequests(userId: string) {
    // Use mock data for now
    if (USE_MOCK_DATA) {
      // Determine role from userId
      const role = userId === MOCK_USERS.owner.id ? 'owner' 
                 : userId === MOCK_USERS.tenant.id ? 'tenant'
                 : userId === MOCK_USERS.vendor.id ? 'vendor'
                 : 'owner';
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return getMockMaintenanceRequests(userId, role);
    }

    const { data, error } = await supabase
      .from('maintenance_requests')
      .select(`
        *,
        property:properties(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, avatar_url, email, phone),
        category:service_categories(id, name, description)
      `)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
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

  // Create maintenance request (Tenant reports issue)
  async createMaintenanceRequest(input: CreateMaintenanceRequestInput) {
    const { data, error } = await supabase
      .from('maintenance_requests')
      .insert({
        ...input,
        status: 'open',
        mms_status: 'notification',
        priority: input.priority || 'medium',
        visibility: 'invited',
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
};
