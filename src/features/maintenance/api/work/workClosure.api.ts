/**
 * Work Closure API
 * Request and manage job closure
 */

import { supabase } from '@/src/lib/supabase';
import { notificationsApi } from '@/src/features/notifications/api/notificationsApi';
import { triggerWorkOrderReport } from './workOrderReport.api';
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

  // Verify vendor is assigned and work is in progress.
  // Predicate mirrors migration 050's closure_reports RLS policy:
  // accept either selected_vendor_id (MMS quote-select flow, canonical)
  // or vendor_id (dedicated-vendor column).
  const { data: request, error: fetchError } = await supabase
    .from('maintenance_requests')
    .select('id, selected_vendor_id, vendor_id, status')
    .eq('id', requestId)
    .single();

  if (fetchError) throw fetchError;

  const typedRequest = request as any;

  const isAssignedVendor =
    typedRequest.selected_vendor_id === vendorId || typedRequest.vendor_id === vendorId;

  if (!isAssignedVendor) {
    throw new Error('You are not assigned to this job');
  }

  if (typedRequest.status !== 'in_progress') {
    throw new Error('Work must be in progress to request closure');
  }

  // Create closure report
  const { data: closureReport, error: closureError } = await (
    supabase.from('closure_reports') as any
  )
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
  const { error: updateError } = await (supabase.from('maintenance_requests') as any)
    .update({
      closure_requested_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('❌ Error updating maintenance request:', updateError);
    throw updateError;
  }

  // Notify owner that closure was requested
  const { data: reqWithOwner } = await supabase
    .from('maintenance_requests')
    .select('owner_id')
    .eq('id', requestId)
    .single();

  if (reqWithOwner && (reqWithOwner as any).owner_id) {
    notificationsApi
      .sendNotification({
        user_id: (reqWithOwner as any).owner_id,
        type: 'maintenance_updated',
        data: {
          customTitle: 'Job Closure Requested',
          customBody: 'The vendor has requested job closure. Review and approve.',
          newStatus: 'closure_pending',
        },
      })
      .catch((e) => console.error('Failed to send closure requested notification:', e));
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
  // Prefer the ACTIVE row. Migration 050's partial unique index
  // (uq_closure_reports_maintenance_request_active, WHERE status <> 'rejected')
  // deliberately lets a legacy rejected row coexist with the active row, so a
  // bare maybeSingle() can throw (multiple rows) or return the stale rejected
  // row. Order so the active row wins:
  //   1. status ascending  -> 'approved' < 'pending' < 'rejected', so a
  //      rejected row sorts last.
  //   2. vendor_confirmed_at desc, nulls last -> the two-sided flow's row
  //      (vendor confirmed) beats a legacy pending row on the same request.
  //   3. id ascending -> deterministic tiebreak.
  const { data, error } = await supabase
    .from('closure_reports')
    .select('*')
    .eq('maintenance_request_id', requestId)
    .order('status', { ascending: true, nullsFirst: false })
    .order('vendor_confirmed_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: true })
    .limit(1)
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
  await (supabase.from('closure_reports') as any)
    .update({ status: 'approved' })
    .eq('maintenance_request_id', requestId);

  // Update maintenance request
  const { data, error } = await (supabase.from('maintenance_requests') as any)
    .update({
      status: 'completed',
      completed_date: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  // Notify vendor that closure was approved
  const { data: approvedReq } = await supabase
    .from('maintenance_requests')
    .select('selected_vendor_id, tenant_id')
    .eq('id', requestId)
    .single();

  const reqData = approvedReq as any;
  if (reqData?.selected_vendor_id) {
    notificationsApi
      .sendNotification({
        user_id: reqData.selected_vendor_id,
        type: 'maintenance_completed',
        data: {
          customTitle: 'Closure Approved',
          customBody: 'The owner has approved the job closure.',
          newStatus: 'completed',
        },
      })
      .catch((e) => console.error('Failed to send closure approved to vendor:', e));
  }
  if (reqData?.tenant_id) {
    notificationsApi
      .sendNotification({
        user_id: reqData.tenant_id,
        type: 'maintenance_completed',
        data: {
          customTitle: 'Maintenance Completed',
          customBody: 'A maintenance job has been completed at your property.',
          newStatus: 'completed',
        },
      })
      .catch((e) => console.error('Failed to send closure approved to tenant:', e));
  }

  // Plane #68 — generate + email the Work Order completion report.
  triggerWorkOrderReport(requestId);

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
/**
 * Vendor requests closure with after-work photos (Tenant→Vendor flow, migration 047)
 * Vendor uploads photos of completed work + notes, setting vendor_confirmed_at.
 * Reuses the existing closure_reports row — does NOT create a parallel table.
 *
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID
 * @param afterPhotos - Array of after-work photo URLs (min 2)
 * @param notes - Optional closure notes
 * @returns Updated closure report
 *
 * @example
 * ```typescript
 * const report = await vendorRequestClosureWithPhotos(
 *   requestId, vendorId, ['after1.jpg', 'after2.jpg'], 'Work completed'
 * );
 * ```
 */
export async function vendorRequestClosureWithPhotos(
  requestId: string,
  vendorId: string,
  afterPhotos: string[],
  notes?: string
): Promise<ClosureReport> {
  console.log('📸 Vendor requesting closure with photos:', { requestId, vendorId });

  if (!afterPhotos || afterPhotos.length < 2) {
    throw new Error('Please upload at least 2 after-work photos');
  }

  // Verify vendor is assigned and work is in progress.
  // Predicate must mirror migration 050's closure_reports RLS policy:
  // accept either selected_vendor_id (MMS quote-select flow, canonical)
  // or vendor_id (dedicated-vendor column). Kept in sync so the client
  // auth check can never pass while RLS silently filters the write.
  const { data: request, error: fetchError } = await supabase
    .from('maintenance_requests')
    .select('id, selected_vendor_id, vendor_id, status')
    .eq('id', requestId)
    .single();

  if (fetchError) throw fetchError;

  const typedRequest = request as any;

  const isAssignedVendor =
    typedRequest.selected_vendor_id === vendorId || typedRequest.vendor_id === vendorId;

  if (!isAssignedVendor) {
    throw new Error('You are not assigned to this job');
  }

  if (typedRequest.status !== 'in_progress') {
    throw new Error('Work must be in progress to request closure');
  }

  // Create-or-update the closure report with the vendor-side confirmation.
  // We do NOT rely on upsert(..., { onConflict }) here: the unique constraint
  // on closure_reports.maintenance_request_id is not guaranteed in the live
  // DB, and upsert with onConflict throws at runtime if it is missing.
  const existing = await getClosureReport(requestId);
  const payload = {
    maintenance_request_id: requestId,
    vendor_after_photos: afterPhotos,
    vendor_closure_notes: notes || null,
    vendor_confirmed_at: new Date().toISOString(),
    status: 'pending',
    // Reset stale tenant-verification state from a previous rejection so the
    // vendor's fresh confirmation starts clean.
    tenant_verification_status: 'pending_owner',
  };

  let data: any;
  let error: { message: string } | null = null;

  if (existing) {
    const res = await (supabase.from('closure_reports') as any)
      .update(payload)
      .eq('id', existing.id)
      .select()
      .single();
    data = res.data;
    error = res.error;
  } else {
    const res = await (supabase.from('closure_reports') as any).insert(payload).select().single();
    data = res.data;
    error = res.error;
  }

  if (error) {
    console.error('❌ Error saving closure with photos:', error);
    throw error;
  }

  // Update maintenance request
  const { error: updateError } = await (supabase.from('maintenance_requests') as any)
    .update({ closure_requested_at: new Date().toISOString() })
    .eq('id', requestId);

  if (updateError) {
    console.error('❌ Error updating maintenance request:', updateError);
    throw updateError;
  }

  // Notify owner and tenant that closure was requested
  const { data: reqWithParties } = await supabase
    .from('maintenance_requests')
    .select('owner_id, tenant_id')
    .eq('id', requestId)
    .single();

  const parties = (reqWithParties || {}) as any;
  if (parties.owner_id) {
    notificationsApi
      .sendNotification({
        user_id: parties.owner_id,
        type: 'maintenance_updated',
        data: {
          customTitle: 'Job Closure Requested',
          customBody: 'The vendor has submitted after-work photos. Review and confirm.',
          newStatus: 'closure_pending',
        },
      })
      .catch((e) => console.error('Failed to send closure requested notification:', e));
  }
  if (parties.tenant_id) {
    notificationsApi
      .sendNotification({
        user_id: parties.tenant_id,
        type: 'maintenance_updated',
        data: {
          customTitle: 'Closure Awaiting Confirmation',
          customBody: 'The vendor has completed the job. Confirm the work with photos.',
          newStatus: 'closure_pending',
        },
      })
      .catch((e) => console.error('Failed to send closure confirmation notification:', e));
  }

  console.log('✅ Closure requested with photos successfully');
  return data as ClosureReport;
}

/**
 * Tenant confirms closure with confirmation photos (Tenant→Vendor flow, migration 047)
 * Tenant uploads their own confirmation photos of the completed work.
 * Requires the vendor to have already confirmed closure (vendor_confirmed_at set).
 *
 * @param requestId - The maintenance request ID
 * @param tenantId - The tenant's user ID
 * @param confirmationPhotos - Array of confirmation photo URLs (min 2)
 * @param notes - Optional notes from the tenant
 * @returns Updated closure report
 *
 * @example
 * ```typescript
 * const report = await tenantConfirmClosureWithPhotos(
 *   requestId, tenantId, ['confirm1.jpg', 'confirm2.jpg'], 'Looks great'
 * );
 * ```
 */
export async function tenantConfirmClosureWithPhotos(
  requestId: string,
  tenantId: string,
  confirmationPhotos: string[],
  notes?: string
): Promise<ClosureReport> {
  console.log('✅ Tenant confirming closure with photos:', { requestId, tenantId });

  if (!confirmationPhotos || confirmationPhotos.length < 2) {
    throw new Error('Please upload at least 2 confirmation photos');
  }

  // Verify tenant ownership
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('tenant_id')
    .eq('id', requestId)
    .single();

  if ((request as any)?.tenant_id !== tenantId) {
    throw new Error('Unauthorized: You are not the tenant of this request');
  }

  // Verify vendor already confirmed closure. Order so the row carrying the
  // vendor confirmation is found first: migration 050's partial unique index
  // (WHERE status <> 'rejected') lets a legacy rejected row coexist with the
  // active row, and a bare maybeSingle could return the stale rejected one.
  const { data: existing } = await (supabase.from('closure_reports') as any)
    .select('id, vendor_confirmed_at')
    .eq('maintenance_request_id', requestId)
    .order('vendor_confirmed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!existing || !(existing as any)?.vendor_confirmed_at) {
    throw new Error('Vendor has not yet confirmed closure with after-work photos');
  }

  // Update the closure report with the tenant-side confirmation.
  // Target by row id (not maintenance_request_id) so the UPDATE can never
  // touch both a rejected legacy row and the active row simultaneously.
  const { data, error } = await (supabase.from('closure_reports') as any)
    .update({
      tenant_confirmation_photos: confirmationPhotos,
      tenant_verification_status: 'tenant_approved',
      tenant_ack_at: new Date().toISOString(),
      tenant_notes: notes || null,
    })
    .eq('id', (existing as any).id)
    .select()
    .single();

  if (error) {
    console.error('❌ Error confirming closure with photos:', error);
    throw error;
  }

  // Notify vendor and owner that tenant confirmed
  const { data: reqWithParties } = await supabase
    .from('maintenance_requests')
    .select('owner_id, selected_vendor_id')
    .eq('id', requestId)
    .single();

  const parties = (reqWithParties || {}) as any;
  if (parties.selected_vendor_id) {
    notificationsApi
      .sendNotification({
        user_id: parties.selected_vendor_id,
        type: 'maintenance_updated',
        data: {
          customTitle: 'Closure Confirmed',
          customBody: 'The tenant has confirmed the completed work with photos.',
          newStatus: 'tenant_approved',
        },
      })
      .catch((e) => console.error('Failed to send closure confirmed to vendor:', e));
  }
  if (parties.owner_id) {
    notificationsApi
      .sendNotification({
        user_id: parties.owner_id,
        type: 'maintenance_updated',
        data: {
          customTitle: 'Closure Confirmed by Tenant',
          customBody: 'The tenant confirmed the job with photos. Proceed to invoice.',
          newStatus: 'tenant_approved',
        },
      })
      .catch((e) => console.error('Failed to send closure confirmed to owner:', e));
  }

  // Plane #68 — generate + email the Work Order completion report.
  triggerWorkOrderReport(requestId);

  console.log('✅ Tenant confirmed closure with photos');
  return data as ClosureReport;
}

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
  const { data, error } = await (supabase.from('closure_reports') as any)
    .update({
      status: 'rejected',
      rejection_reason: reason,
    })
    .eq('maintenance_request_id', requestId)
    .select()
    .single();

  if (error) throw error;

  // Reset closure_requested_at on maintenance request
  await (supabase.from('maintenance_requests') as any)
    .update({ closure_requested_at: null })
    .eq('id', requestId);

  // Notify vendor that closure was rejected
  const { data: rejectedReq } = await supabase
    .from('maintenance_requests')
    .select('selected_vendor_id')
    .eq('id', requestId)
    .single();

  if (rejectedReq && (rejectedReq as any).selected_vendor_id) {
    notificationsApi
      .sendNotification({
        user_id: (rejectedReq as any).selected_vendor_id,
        type: 'maintenance_updated',
        data: {
          customTitle: 'Closure Changes Requested',
          customBody: 'The owner has requested changes to the closure report.',
          newStatus: 'rejected',
          rejectionReason: reason,
        },
      })
      .catch((e) => console.error('Failed to send closure rejected notification:', e));
  }

  return data as ClosureReport;
}
