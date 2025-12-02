/**
 * Work Progress API
 * Track work progress and notes
 */

import { supabase } from '@/src/lib/supabase';
import type { ProgressEvent, ProgressNote } from '../types/maintenance.types';

/**
 * Get progress timeline for a maintenance request
 * Returns a chronological list of all events (status changes, updates, messages, etc.)
 * 
 * @param requestId - The maintenance request ID
 * @returns Array of progress events
 * 
 * @example
 * ```typescript
 * const timeline = await getProgressTimeline(requestId);
 * ```
 */
export async function getProgressTimeline(
  requestId: string
): Promise<ProgressEvent[]> {
  // This would aggregate data from multiple sources:
  // - maintenance_requests (status changes)
  // - job_progress_updates
  // - messages
  // - quotes
  // - purchase_orders
  
  // For now, return a simplified version
  // TODO: Implement full timeline aggregation
  
  const events: ProgressEvent[] = [];
  
  // Get progress updates
  const { data: updates } = await supabase
    .from('job_progress_updates')
    .select('*')
    .eq('maintenance_request_id', requestId)
    .order('update_date', { ascending: true });

  if (updates) {
    events.push(...updates.map((update: any) => ({
      id: update.id,
      type: 'progress_update' as const,
      timestamp: update.created_at,
      description: update.notes,
    })));
  }

  return events;
}

/**
 * Add a progress note to a maintenance request
 * 
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID
 * @param note - The progress note
 * @returns Created progress note
 * 
 * @example
 * ```typescript
 * const note = await addProgressNote(requestId, vendorId, 'Work is progressing well');
 * ```
 */
export async function addProgressNote(
  requestId: string,
  vendorId: string,
  note: string
): Promise<ProgressNote> {
  // This would create a note in a progress_notes table
  // For now, we'll use the job_progress_updates table
  
  const { data, error } = await (supabase
    .from('job_progress_updates') as any)
    .insert({
      maintenance_request_id: requestId,
      vendor_id: vendorId,
      update_date: new Date().toISOString().split('T')[0],
      notes: note,
      photos: [],
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    maintenance_request_id: requestId,
    vendor_id: vendorId,
    note: note,
    created_at: data.created_at,
  };
}
