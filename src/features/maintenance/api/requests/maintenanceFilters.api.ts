/**
 * Maintenance Filters API
 * Filtering and search operations for maintenance requests
 */

import { supabase } from '@/src/lib/supabase';
import type { MaintenanceRequest, MaintenanceStatus, Priority, ServiceCategory } from '../types/maintenance.types';

/**
 * Filter maintenance requests by status
 * 
 * @param ownerId - The owner's user ID
 * @param statuses - Array of statuses to filter by
 * @returns Filtered maintenance requests
 * 
 * @example
 * ```typescript
 * const openRequests = await filterByStatus(ownerId, ['open', 'assigned']);
 * ```
 */
export async function filterByStatus(
  ownerId: string,
  statuses: MaintenanceStatus[]
): Promise<MaintenanceRequest[]> {
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
  return data as MaintenanceRequest[];
}

/**
 * Filter maintenance requests by priority
 * 
 * @param ownerId - The owner's user ID
 * @param priorities - Array of priorities to filter by
 * @returns Filtered maintenance requests
 * 
 * @example
 * ```typescript
 * const urgentRequests = await filterByPriority(ownerId, ['high']);
 * ```
 */
export async function filterByPriority(
  ownerId: string,
  priorities: Priority[]
): Promise<MaintenanceRequest[]> {
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
  return data as MaintenanceRequest[];
}

/**
 * Get all active service categories
 * Used for category dropdowns and filters
 * 
 * @returns Array of active service categories
 * 
 * @example
 * ```typescript
 * const categories = await getServiceCategories();
 * ```
 */
export async function getServiceCategories(): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from('service_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw error;
  return data as ServiceCategory[];
}
