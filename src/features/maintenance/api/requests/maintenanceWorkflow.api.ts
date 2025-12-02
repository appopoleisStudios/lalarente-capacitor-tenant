/**
 * Maintenance Workflow API
 * Status updates and workflow management
 */

import { supabase } from '@/src/lib/supabase';
import type { MaintenanceRequest, MaintenanceStatus, MmsStatus, Priority } from '../types/maintenance.types';

/**
 * Update maintenance request status
 * 
 * @param id - The maintenance request ID
 * @param status - The new status
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const updated = await updateStatus(requestId, 'in_progress');
 * ```
 */
export async function updateStatus(
  id: string,
  status: MaintenanceStatus
): Promise<MaintenanceRequest> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MaintenanceRequest;
}

/**
 * Update MMS (Maintenance Management System) status
 * This tracks the workflow state of the request
 * 
 * @param id - The maintenance request ID
 * @param mmsStatus - The new MMS status
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const updated = await updateMmsStatus(requestId, 'vendor_routed');
 * ```
 */
export async function updateMmsStatus(
  id: string,
  mmsStatus: MmsStatus
): Promise<MaintenanceRequest> {
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
}

/**
 * Update maintenance request priority
 * 
 * @param id - The maintenance request ID
 * @param priority - The new priority level
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const updated = await updatePriority(requestId, 'high');
 * ```
 */
export async function updatePriority(
  id: string,
  priority: Priority
): Promise<MaintenanceRequest> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({ priority })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as MaintenanceRequest;
}

/**
 * Acknowledge a maintenance request (Owner action)
 * Marks the request as reviewed by the owner
 * 
 * @param id - The maintenance request ID
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const acknowledged = await acknowledgeRequest(requestId);
 * ```
 */
export async function acknowledgeRequest(id: string): Promise<MaintenanceRequest> {
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
}

/**
 * Close a maintenance request
 * Marks the request as closed and sets completion date
 * 
 * @param id - The maintenance request ID
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const closed = await closeRequest(requestId);
 * ```
 */
export async function closeRequest(id: string): Promise<MaintenanceRequest> {
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
}
