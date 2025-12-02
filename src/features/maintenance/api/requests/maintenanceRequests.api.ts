/**
 * Maintenance Requests API
 * Core CRUD operations for maintenance requests
 */

import { supabase } from '@/src/lib/supabase';
import type {
    CreateMaintenanceRequestInput,
    MaintenanceRequest,
    MaintenanceRequestUpdate,
    MaintenanceRequestWithRelations,
    Property,
} from '../types/maintenance.types';

/**
 * Fetch maintenance requests with role-based filtering
 * 
 * @param userId - The user's ID
 * @param role - The user's role (owner, tenant, or vendor)
 * @returns Array of maintenance requests
 * 
 * @example
 * ```typescript
 * const requests = await getMaintenanceRequests(userId, 'owner');
 * ```
 */
export async function getMaintenanceRequests(
  userId: string,
  role?: 'owner' | 'tenant' | 'vendor'
): Promise<MaintenanceRequestWithRelations[]> {
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
  return (data || []) as MaintenanceRequestWithRelations[];
}

/**
 * Fetch single maintenance request with all relations
 * 
 * @param id - The maintenance request ID
 * @returns Maintenance request with all related data
 * 
 * @example
 * ```typescript
 * const request = await getMaintenanceRequestById(requestId);
 * ```
 */
export async function getMaintenanceRequestById(
  id: string
): Promise<MaintenanceRequestWithRelations> {
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
  return data as MaintenanceRequestWithRelations;
}

/**
 * Create a new maintenance request
 * 
 * @param input - The maintenance request data
 * @returns Created maintenance request
 * 
 * @example
 * ```typescript
 * const request = await createMaintenanceRequest({
 *   property_id: 'prop-123',
 *   owner_id: 'owner-123',
 *   tenant_id: 'tenant-123',
 *   title: 'Leaking faucet',
 *   description: 'Kitchen faucet is leaking',
 *   priority: 'medium',
 * });
 * ```
 */
export async function createMaintenanceRequest(
  input: CreateMaintenanceRequestInput
): Promise<MaintenanceRequest> {
  // If tenant is creating, get owner_id from property
  let ownerId = input.owner_id;
  if (!ownerId && input.property_id) {
    ownerId = await getPropertyOwner(input.property_id);
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
}

/**
 * Update a maintenance request
 * 
 * @param id - The maintenance request ID
 * @param updates - The fields to update
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const updated = await updateMaintenanceRequest(requestId, {
 *   title: 'Updated title',
 *   priority: 'high',
 * });
 * ```
 */
export async function updateMaintenanceRequest(
  id: string,
  updates: MaintenanceRequestUpdate
): Promise<MaintenanceRequest> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MaintenanceRequest;
}

/**
 * Delete a maintenance request
 * 
 * @param id - The maintenance request ID
 * @returns Success indicator
 * 
 * @example
 * ```typescript
 * await deleteMaintenanceRequest(requestId);
 * ```
 */
export async function deleteMaintenanceRequest(id: string): Promise<{ success: boolean }> {
  const { error } = await supabase
    .from('maintenance_requests')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return { success: true };
}

/**
 * Get owner's properties
 * Used for property selection when creating requests
 * 
 * @param ownerId - The owner's user ID
 * @returns Array of properties
 * 
 * @example
 * ```typescript
 * const properties = await getOwnerProperties(ownerId);
 * ```
 */
export async function getOwnerProperties(ownerId: string): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('id, title, address, city')
    .eq('owner_id', ownerId)
    .order('title');

  if (error) throw error;
  return data as Property[];
}

/**
 * Get property owner ID
 * Used when tenant creates a request to find the owner
 * 
 * @param propertyId - The property ID
 * @returns Owner's user ID
 * 
 * @example
 * ```typescript
 * const ownerId = await getPropertyOwner(propertyId);
 * ```
 */
export async function getPropertyOwner(propertyId: string): Promise<string> {
  const { data, error } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .single();

  if (error) throw error;
  return data?.owner_id;
}
