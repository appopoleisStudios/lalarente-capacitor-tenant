import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database.types';
import { notificationsApi } from '../../notifications/api/notificationsApi';

// Type aliases
type ViewingRequest = Database['public']['Tables']['viewing_requests']['Row'];
type ViewingRequestInsert = Database['public']['Tables']['viewing_requests']['Insert'];
type ViewingRequestUpdate = Database['public']['Tables']['viewing_requests']['Update'];

// Extended viewing with relations
export interface ViewingWithRelations extends ViewingRequest {
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
export interface RequestViewingInput {
  property_id: string;
  tenant_id: string;
  owner_id: string;
  requested_date: string;
  requested_time: string;
  tenant_notes?: string;
}

export interface ApproveViewingInput {
  viewing_id: string;
  confirmed_date?: string;
  owner_notes?: string;
}

export interface DeclineViewingInput {
  viewing_id: string;
  owner_response: string;
  alternative_times?: string[];
}

export interface ViewingStats {
  total: number;
  pending: number;
  approved: number;
  completed: number;
  cancelled: number;
  declined: number;
}

export const viewingsApi = {
  /**
   * Request a property viewing
   */
  async requestViewing(input: RequestViewingInput): Promise<ViewingRequest> {
    const { data, error } = await supabase
      .from('viewing_requests')
      .insert({
        property_id: input.property_id,
        tenant_id: input.tenant_id,
        owner_id: input.owner_id,
        requested_date: input.requested_date,
        requested_time: input.requested_time,
        tenant_notes: input.tenant_notes || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error requesting viewing:', error);
      throw new Error(`Failed to request viewing: ${error.message}`);
    }

    // Send notification to owner
    try {
      const { data: property } = await supabase
        .from('properties')
        .select('title')
        .eq('id', input.property_id)
        .single();

      const { data: tenant } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', input.tenant_id)
        .single();

      await notificationsApi.sendNotification({
        user_id: input.owner_id,
        type: 'viewing_requested',
        data: {
          viewingId: data.id,
          propertyId: input.property_id,
          propertyTitle: property?.title || 'Your property',
          tenantId: input.tenant_id,
          tenantName: tenant?.full_name || 'A tenant',
          requestedDate: input.requested_date,
          requestedTime: input.requested_time,
        },
      });
    } catch (notifError) {
      console.error('Error sending viewing request notification:', notifError);
      // Don't fail the request if notification fails
    }

    return data;
  },

  /**
   * Approve a viewing request
   */
  async approveViewing(input: ApproveViewingInput): Promise<ViewingRequest> {
    const viewing = await this.getViewing(input.viewing_id);

    if (viewing.status !== 'pending') {
      throw new Error('Only pending viewing requests can be approved');
    }

    const confirmedDate = input.confirmed_date || viewing.requested_date;

    const { data, error } = await supabase
      .from('viewing_requests')
      .update({
        status: 'approved',
        confirmed_date: confirmedDate,
        owner_response: input.owner_notes || 'Viewing approved',
        owner_notes: input.owner_notes || null,
      })
      .eq('id', input.viewing_id)
      .select()
      .single();

    if (error) {
      console.error('Error approving viewing:', error);
      throw new Error(`Failed to approve viewing: ${error.message}`);
    }

    // Send confirmation to tenant
    try {
      const { data: property } = await supabase
        .from('properties')
        .select('title')
        .eq('id', viewing.property_id)
        .single();

      await notificationsApi.sendNotification({
        user_id: viewing.tenant_id,
        type: 'viewing_approved',
        data: {
          viewingId: data.id,
          propertyId: viewing.property_id,
          propertyTitle: property?.title || 'the property',
          confirmedDate: confirmedDate,
          confirmedTime: viewing.requested_time,
          ownerNotes: input.owner_notes,
        },
      });
    } catch (notifError) {
      console.error('Error sending viewing approval notification:', notifError);
      // Don't fail the approval if notification fails
    }

    return data;
  },

  /**
   * Decline a viewing request
   */
  async declineViewing(input: DeclineViewingInput): Promise<ViewingRequest> {
    const viewing = await this.getViewing(input.viewing_id);

    if (viewing.status !== 'pending') {
      throw new Error('Only pending viewing requests can be declined');
    }

    const { data, error } = await supabase
      .from('viewing_requests')
      .update({
        status: 'declined',
        owner_response: input.owner_response,
        alternative_times: input.alternative_times || null,
      })
      .eq('id', input.viewing_id)
      .select()
      .single();

    if (error) {
      console.error('Error declining viewing:', error);
      throw new Error(`Failed to decline viewing: ${error.message}`);
    }

    // Send notification to tenant with alternative times
    try {
      const { data: property } = await supabase
        .from('properties')
        .select('title')
        .eq('id', viewing.property_id)
        .single();

      await notificationsApi.sendNotification({
        user_id: viewing.tenant_id,
        type: 'viewing_declined',
        data: {
          viewingId: data.id,
          propertyId: viewing.property_id,
          propertyTitle: property?.title || 'the property',
          ownerResponse: input.owner_response,
          alternativeTimes: input.alternative_times,
        },
      });
    } catch (notifError) {
      console.error('Error sending viewing decline notification:', notifError);
      // Don't fail the decline if notification fails
    }

    return data;
  },

  /**
   * Cancel a viewing request (by tenant or owner)
   */
  async cancelViewing(viewingId: string, cancelledBy: 'tenant' | 'owner', reason?: string): Promise<ViewingRequest> {
    const viewing = await this.getViewing(viewingId);

    if (viewing.status === 'completed' || viewing.status === 'cancelled') {
      throw new Error('Cannot cancel a completed or already cancelled viewing');
    }

    const { data, error } = await supabase
      .from('viewing_requests')
      .update({
        status: 'cancelled',
        owner_response: reason || `Cancelled by ${cancelledBy}`,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', viewingId)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling viewing:', error);
      throw new Error(`Failed to cancel viewing: ${error.message}`);
    }

    // Send cancellation notification to other party
    try {
      const { data: property } = await supabase
        .from('properties')
        .select('title')
        .eq('id', viewing.property_id)
        .single();

      const recipientId = cancelledBy === 'tenant' ? viewing.owner_id : viewing.tenant_id;

      await notificationsApi.sendNotification({
        user_id: recipientId,
        type: 'viewing_cancelled',
        data: {
          viewingId: data.id,
          propertyId: viewing.property_id,
          propertyTitle: property?.title || 'the property',
          viewingDate: viewing.confirmed_date || viewing.requested_date,
          viewingTime: viewing.requested_time,
          cancelledBy,
          reason,
        },
      });
    } catch (notifError) {
      console.error('Error sending viewing cancellation notification:', notifError);
      // Don't fail the cancellation if notification fails
    }

    return data;
  },

  /**
   * Mark viewing as completed
   */
  async completeViewing(viewingId: string, notes?: string): Promise<ViewingRequest> {
    const viewing = await this.getViewing(viewingId);

    if (viewing.status !== 'approved') {
      throw new Error('Only approved viewings can be marked as completed');
    }

    const { data, error } = await supabase
      .from('viewing_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        owner_notes: notes || viewing.owner_notes,
      })
      .eq('id', viewingId)
      .select()
      .single();

    if (error) {
      console.error('Error completing viewing:', error);
      throw new Error(`Failed to complete viewing: ${error.message}`);
    }

    // Send follow-up to tenant (ask for feedback, prompt to apply)
    try {
      const { data: property } = await supabase
        .from('properties')
        .select('title')
        .eq('id', viewing.property_id)
        .single();

      await notificationsApi.sendNotification({
        user_id: viewing.tenant_id,
        type: 'viewing_completed',
        data: {
          viewingId: data.id,
          propertyId: viewing.property_id,
          propertyTitle: property?.title || 'the property',
          ownerNotes: notes,
        },
      });
    } catch (notifError) {
      console.error('Error sending viewing completion notification:', notifError);
      // Don't fail the completion if notification fails
    }

    return data;
  },

  /**
   * Reschedule a viewing
   */
  async rescheduleViewing(
    viewingId: string,
    newDate: string,
    newTime: string,
    rescheduledBy: 'tenant' | 'owner'
  ): Promise<ViewingRequest> {
    const viewing = await this.getViewing(viewingId);

    if (viewing.status !== 'approved' && viewing.status !== 'pending') {
      throw new Error('Only pending or approved viewings can be rescheduled');
    }

    const updateData: any = {
      requested_date: newDate,
      requested_time: newTime,
    };

    if (rescheduledBy === 'owner') {
      updateData.confirmed_date = newDate;
      updateData.owner_response = 'Viewing rescheduled by owner';
    } else {
      // If tenant reschedules, reset to pending
      updateData.status = 'pending';
      updateData.confirmed_date = null;
    }

    const { data, error } = await supabase
      .from('viewing_requests')
      .update(updateData)
      .eq('id', viewingId)
      .select()
      .single();

    if (error) {
      console.error('Error rescheduling viewing:', error);
      throw new Error(`Failed to reschedule viewing: ${error.message}`);
    }

    // TODO: Send reschedule notification to other party

    return data;
  },

  /**
   * Get a single viewing by ID
   */
  async getViewing(id: string): Promise<ViewingWithRelations> {
    const { data, error } = await supabase
      .from('viewing_requests')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching viewing:', error);
      throw new Error(`Failed to fetch viewing: ${error.message}`);
    }

    return data as ViewingWithRelations;
  },

  /**
   * Get all viewings for a tenant
   */
  async getTenantViewings(tenantId: string, status?: string): Promise<ViewingWithRelations[]> {
    let query = supabase
      .from('viewing_requests')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('requested_date', { ascending: false });

    if (error) {
      console.error('Error fetching tenant viewings:', error);
      throw new Error(`Failed to fetch tenant viewings: ${error.message}`);
    }

    return data as ViewingWithRelations[];
  },

  /**
   * Get all viewings for an owner
   */
  async getOwnerViewings(ownerId: string, status?: string): Promise<ViewingWithRelations[]> {
    let query = supabase
      .from('viewing_requests')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('requested_date', { ascending: false });

    if (error) {
      console.error('Error fetching owner viewings:', error);
      throw new Error(`Failed to fetch owner viewings: ${error.message}`);
    }

    return data as ViewingWithRelations[];
  },

  /**
   * Get viewings for a specific property
   */
  async getPropertyViewings(propertyId: string, status?: string): Promise<ViewingWithRelations[]> {
    let query = supabase
      .from('viewing_requests')
      .select(`
        *,
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('requested_date', { ascending: false });

    if (error) {
      console.error('Error fetching property viewings:', error);
      throw new Error(`Failed to fetch property viewings: ${error.message}`);
    }

    return data as ViewingWithRelations[];
  },

  /**
   * Get upcoming viewings (approved viewings in the future)
   */
  async getUpcomingViewings(userId: string, userType: 'tenant' | 'owner'): Promise<ViewingWithRelations[]> {
    const today = new Date().toISOString();

    let query = supabase
      .from('viewing_requests')
      .select(`
        *,
        property:properties!property_id(id, title, address, city),
        tenant:profiles!tenant_id(id, full_name, email, phone),
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('status', 'approved')
      .gte('confirmed_date', today);

    if (userType === 'tenant') {
      query = query.eq('tenant_id', userId);
    } else {
      query = query.eq('owner_id', userId);
    }

    const { data, error } = await query.order('confirmed_date', { ascending: true });

    if (error) {
      console.error('Error fetching upcoming viewings:', error);
      throw new Error(`Failed to fetch upcoming viewings: ${error.message}`);
    }

    return data as ViewingWithRelations[];
  },

  /**
   * Get viewing statistics for owner
   */
  async getViewingStats(ownerId: string): Promise<ViewingStats> {
    const { data: viewings, error } = await supabase
      .from('viewing_requests')
      .select('id, status')
      .eq('owner_id', ownerId);

    if (error) {
      console.error('Error fetching viewing stats:', error);
      throw new Error(`Failed to fetch viewing stats: ${error.message}`);
    }

    return {
      total: viewings?.length || 0,
      pending: viewings?.filter(v => v.status === 'pending').length || 0,
      approved: viewings?.filter(v => v.status === 'approved').length || 0,
      completed: viewings?.filter(v => v.status === 'completed').length || 0,
      cancelled: viewings?.filter(v => v.status === 'cancelled').length || 0,
      declined: viewings?.filter(v => v.status === 'declined').length || 0,
    };
  },

  /**
   * Check if viewing is in the past
   */
  isPast(viewing: ViewingRequest): boolean {
    const viewingDate = new Date(viewing.confirmed_date || viewing.requested_date);
    const today = new Date();
    return viewingDate < today;
  },

  /**
   * Check if viewing is today
   */
  isToday(viewing: ViewingRequest): boolean {
    const viewingDate = new Date(viewing.confirmed_date || viewing.requested_date);
    const today = new Date();
    return (
      viewingDate.getDate() === today.getDate() &&
      viewingDate.getMonth() === today.getMonth() &&
      viewingDate.getFullYear() === today.getFullYear()
    );
  },
};
