/**
 * Work Closure API
 * Request and manage job closure
 */

import { supabase } from '@/src/lib/supabase';
import type { ClosureReport, MaintenanceRequest } from '../types/maintenance.types';

/**
 * Request job closure (Vendor action)
 * Vendor submits completion notes and photos to request closure
 * 
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID
 * @param completionNotes - Notes about the completed work
 * @param completionPhotos - Array of completion photo URLs (minimum 2)
 * @returns Created closure report
 * 
 * @example
 * ```typescript
 * const report = await requestClosure(
 *   requestId,
 *   vendorId,
 *   'Work completed successfully',
 *   ['photo1.jpg', 'photo2.jpg']
 * );
 * ```
 */
export async function requestClosure(
  requestId: string,
  vendorId: string,
  completionNotes: string,
  completionPhotos: string[]
): Promise<ClosureReport> {
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
  return closureReport as ClosureReport;
}

/**
 * Get closure report for a maintenance request
 * 
 * @param requestId - The maintenance request ID
 * @returns Closure report or null if not found
 * 
 * @example
 * ```typescript
 * const report = await getClosureReport(requestId);
 * ```
 */
export async function getClosureReport(requestId: string): Promise<ClosureReport | null> {
  const { data, error } = await supabase
    .from('closure_reports')
    .select('*')
    .eq('maintenance_request_id', requestId)
    .maybeSingle();

  if (error) throw error;
  return data as ClosureReport | null;
}

/**
 * Approve closure report (Owner action)
 * Marks the job as completed
 * 
 * @param requestId - The maintenance request ID
 * @param ownerId - The owner's user ID
 * @returns Updated maintenance request
 * 
 * @example
 * ```typescript
 * const completed = await approveClosureReport(requestId, ownerId);
 * ```
 */
export async function approveClosureReport(
  requestId: string,
  ownerId: string
): Promise<MaintenanceRequest> {
  // Verify ownership
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('owner_id')
    .eq('id', requestId)
    .single();

  if ((request as any)?.owner_id !== ownerId) {
    throw new Error('Unauthorized: You are not the owner of this request');
  }

  // Update closure report
  await (supabase
    .from('closure_reports') as any)
    .update({ status: 'approved' })
    .eq('maintenance_request_id', requestId);

  // Update maintenance request
  const { data, error } = await (supabase
    .from('maintenance_requests') as any)
    .update({
      status: 'completed',
      completed_date: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  return data as MaintenanceRequest;
}

/**
 * Reject closure report (Owner action)
 * Sends the job back to in_progress with rejection reason
 * 
 * @param requestId - The maintenance request ID
 * @param ownerId - The owner's user ID
 * @param reason - Reason for rejection
 * @returns Updated closure report
 * 
 * @example
 * ```typescript
 * const report = await rejectClosureReport(requestId, ownerId, 'Work incomplete');
 * ```
 */
export async function rejectClosureReport(
  requestId: string,
  ownerId: string,
  reason: string
): Promise<ClosureReport> {
  // Verify ownership
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('owner_id')
    .eq('id', requestId)
    .single();

  if ((request as any)?.owner_id !== ownerId) {
    throw new Error('Unauthorized: You are not the owner of this request');
  }

  // Update closure report
  const { data, error } = await (supabase
    .from('closure_reports') as any)
    .update({
      status: 'rejected',
      rejection_reason: reason,
    })
    .eq('maintenance_request_id', requestId)
    .select()
    .single();

  if (error) throw error;

  // Reset closure_requested_at on maintenance request
  await (supabase
    .from('maintenance_requests') as any)
    .update({ closure_requested_at: null })
    .eq('id', requestId);

  return data as ClosureReport;
}
