/**
 * Work Execution API
 * Start and manage work execution
 */

import { supabase } from '@/src/lib/supabase';
import type { MaintenanceRequest, ProgressUpdate } from '../types/maintenance.types';

/**
 * Start work on a maintenance request (Vendor action)
 * Updates status to 'in_progress' and records work start time
 * 
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const request = await startWork(requestId, vendorId);
 * ```
 */
export async function startWork(
  requestId: string,
  vendorId: string
): Promise<MaintenanceRequest> {
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
  return data as MaintenanceRequest;
}

/**
 * Submit daily progress update (Vendor action)
 * 
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID
 * @param notes - Progress notes
 * @param photos - Array of photo URLs
 * @returns Created progress update
 * 
 * @example
 * ```typescript
 * const update = await submitProgressUpdate(
 *   requestId,
 *   vendorId,
 *   'Completed 50% of work',
 *   ['photo1.jpg', 'photo2.jpg']
 * );
 * ```
 */
export async function submitProgressUpdate(
  requestId: string,
  vendorId: string,
  notes: string,
  photos: string[]
): Promise<ProgressUpdate> {
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
  return data as ProgressUpdate;
}

/**
 * Get progress updates for a maintenance request
 * 
 * @param requestId - The maintenance request ID
 * @returns Array of progress updates
 * 
 * @example
 * ```typescript
 * const updates = await getProgressUpdates(requestId);
 * ```
 */
export async function getProgressUpdates(requestId: string): Promise<ProgressUpdate[]> {
  const { data, error } = await supabase
    .from('job_progress_updates')
    .select('*')
    .eq('maintenance_request_id', requestId)
    .order('update_date', { ascending: false });

  if (error) throw error;
  return (data || []) as ProgressUpdate[];
}
