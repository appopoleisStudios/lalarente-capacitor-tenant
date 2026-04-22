/**
 * Tenant Verification API
 * Industry-standard tenant verification workflow following BuildingLink/AppFolio patterns
 *
 * Key Features:
 * - Mandatory tenant verification before closure
 * - Conflict resolution via mediation
 * - 72-hour timeout auto-approval
 * - Owner override for emergencies
 * - Full audit trail
 */

import { supabase } from '@/src/lib/supabase';
import type {
  ClosureReport,
  MaintenanceRequest,
} from '../types/maintenance.types';

type TenantVerificationStatus = 'pending' | 'approved' | 'rejected' | 'timeout_approved';
type SenderRole = 'owner' | 'tenant';
interface MediationMessage {
  id: string;
  closure_report_id: string;
  sender_id: string;
  sender_role: SenderRole;
  message: string;
  created_at: string;
}

/**
 * Forward closure to tenant for verification (Owner action)
 * After owner reviews vendor's closure request, forward to tenant for final verification
 *
 * @param requestId - Maintenance request ID
 * @param ownerId - Owner's user ID
 * @returns Updated closure report with tenant verification pending
 *
 * @example
 * ```typescript
 * const report = await forwardClosureToTenant(requestId, ownerId);
 * // Tenant receives notification to verify work
 * ```
 */
export async function forwardClosureToTenant(
  requestId: string,
  ownerId: string
): Promise<ClosureReport> {
  console.log('📤 Forwarding closure to tenant for verification:', { requestId });

  // Verify ownership
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('owner_id, tenant_id')
    .eq('id', requestId)
    .single();

  if ((request as any)?.owner_id !== ownerId) {
    throw new Error('Unauthorized: You are not the owner of this request');
  }

  if (!(request as any)?.tenant_id) {
    throw new Error('No tenant associated with this maintenance request');
  }

  // Calculate auto-approval timestamp (72 hours from now)
  const autoApproveAt = new Date();
  autoApproveAt.setHours(autoApproveAt.getHours() + 72);

  // Update closure report
  const { data, error } = await (supabase
    .from('closure_reports') as any)
    .update({
      tenant_verification_status: 'pending_tenant',
      forwarded_to_tenant_at: new Date().toISOString(),
      auto_approve_at: autoApproveAt.toISOString(),
    })
    .eq('maintenance_request_id', requestId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error forwarding to tenant:', error);
    throw error;
  }

  console.log('✅ Closure forwarded to tenant. Auto-approve at:', autoApproveAt);

  // TODO: Send notification to tenant (TENANT_VERIFICATION_REQUIRED)

  return data as ClosureReport;
}

/**
 * Tenant approves completed work
 * Tenant verifies work is satisfactory, allowing owner to close the request
 *
 * @param requestId - Maintenance request ID
 * @param tenantId - Tenant's user ID
 * @param notes - Optional feedback notes from tenant
 * @returns Updated closure report with tenant approval
 *
 * @example
 * ```typescript
 * const report = await tenantApproveCompletion(
 *   requestId,
 *   tenantId,
 *   'Work looks great, thank you!'
 * );
 * ```
 */
export async function tenantApproveCompletion(
  requestId: string,
  tenantId: string,
  notes?: string
): Promise<ClosureReport> {
  console.log('✅ Tenant approving work completion:', { requestId });

  // Verify tenant ownership
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('tenant_id')
    .eq('id', requestId)
    .single();

  if ((request as any)?.tenant_id !== tenantId) {
    throw new Error('Unauthorized: You are not the tenant of this request');
  }

  // Update closure report
  const { data, error } = await (supabase
    .from('closure_reports') as any)
    .update({
      tenant_verification_status: 'tenant_approved',
      tenant_ack_at: new Date().toISOString(),
      tenant_notes: notes || null,
    })
    .eq('maintenance_request_id', requestId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error approving completion:', error);
    throw error;
  }

  console.log('✅ Tenant approved work completion');

  // TODO: Send notification to owner and vendor (TENANT_APPROVED_WORK)

  return data as ClosureReport;
}

/**
 * Tenant rejects completed work
 * Tenant reports issues with completed work, requiring vendor to fix
 *
 * @param requestId - Maintenance request ID
 * @param tenantId - Tenant's user ID
 * @param reason - Reason for rejection (min 10 chars)
 * @param rejectionPhotos - Photo URLs showing issues (min 1 photo)
 * @returns Updated closure report with rejection
 *
 * @example
 * ```typescript
 * const report = await tenantRejectCompletion(
 *   requestId,
 *   tenantId,
 *   'Leak still present under sink',
 *   ['photo1.jpg', 'photo2.jpg']
 * );
 * ```
 */
export async function tenantRejectCompletion(
  requestId: string,
  tenantId: string,
  reason: string,
  rejectionPhotos: string[]
): Promise<ClosureReport> {
  console.log('❌ Tenant rejecting work completion:', { requestId });

  // Validation
  if (!reason || reason.trim().length < 10) {
    throw new Error('Rejection reason must be at least 10 characters');
  }

  if (!rejectionPhotos || rejectionPhotos.length < 1) {
    throw new Error('Please upload at least 1 photo showing the issue');
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

  // Get current closure report to increment rejection count
  const { data: currentClosure } = await (supabase
    .from('closure_reports') as any)
    .select('rejection_count')
    .eq('maintenance_request_id', requestId)
    .single();

  const newRejectionCount = ((currentClosure as any)?.rejection_count || 0) + 1;
  const requiresMediation = newRejectionCount >= 3;

  console.log('📊 Rejection count:', newRejectionCount, 'Mediation:', requiresMediation);

  // Update closure report
  const { data, error } = await (supabase
    .from('closure_reports') as any)
    .update({
      tenant_verification_status: 'tenant_rejected',
      tenant_ack_at: new Date().toISOString(),
      tenant_notes: reason,
      tenant_rejection_photos: rejectionPhotos,
      rejection_count: newRejectionCount,
      mediation_required: requiresMediation,
      mediation_reason: requiresMediation
        ? `Automatic mediation after ${newRejectionCount} rejections`
        : null,
      status: 'rejected', // Mark closure as rejected
    })
    .eq('maintenance_request_id', requestId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error rejecting completion:', error);
    throw error;
  }

  // Reset closure_requested_at on maintenance request (allows vendor to resubmit)
  await (supabase
    .from('maintenance_requests') as any)
    .update({ closure_requested_at: null })
    .eq('id', requestId);

  console.log('✅ Tenant rejected work completion');

  // TODO: Send notification to owner and vendor (TENANT_REJECTED_WORK)
  // TODO: If mediation required, send notification to owner (MEDIATION_REQUIRED)

  return data as ClosureReport;
}

/**
 * Owner overrides tenant verification
 * Used for emergencies, timeouts, or when tenant has moved out
 *
 * @param requestId - Maintenance request ID
 * @param ownerId - Owner's user ID
 * @param reason - Reason for override (required)
 * @returns Updated closure report with owner override
 *
 * @example
 * ```typescript
 * const report = await overrideTenantVerification(
 *   requestId,
 *   ownerId,
 *   'Emergency repair - water main break'
 * );
 * ```
 */
export async function overrideTenantVerification(
  requestId: string,
  ownerId: string,
  reason: string
): Promise<ClosureReport> {
  console.log('⚠️ Owner overriding tenant verification:', { requestId });

  // Validation
  if (!reason || reason.trim().length < 10) {
    throw new Error('Override reason must be at least 10 characters');
  }

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
      tenant_verification_status: 'owner_override',
      owner_override_reason: reason,
      owner_override_at: new Date().toISOString(),
    })
    .eq('maintenance_request_id', requestId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error overriding verification:', error);
    throw error;
  }

  console.log('✅ Owner overrode tenant verification');

  // TODO: Send notification to tenant and vendor (WORK_OVERRIDE_BY_OWNER)

  return data as ClosureReport;
}

/**
 * Mark repair as emergency (skips tenant verification)
 * Used for safety/health issues that require immediate action
 *
 * @param requestId - Maintenance request ID
 * @param ownerId - Owner's user ID
 * @param emergencyReason - Reason for emergency classification
 * @returns Updated closure report
 *
 * @example
 * ```typescript
 * const report = await markAsEmergencyRepair(
 *   requestId,
 *   ownerId,
 *   'Gas leak - immediate safety hazard'
 * );
 * ```
 */
export async function markAsEmergencyRepair(
  requestId: string,
  ownerId: string,
  emergencyReason: string
): Promise<ClosureReport> {
  console.log('🚨 Marking as emergency repair:', { requestId });

  // Validation
  if (!emergencyReason || emergencyReason.trim().length < 10) {
    throw new Error('Emergency reason must be at least 10 characters');
  }

  // Verify ownership
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('owner_id')
    .eq('id', requestId)
    .single();

  if ((request as any)?.owner_id !== ownerId) {
    throw new Error('Unauthorized: You are not the owner of this request');
  }

  // Update closure report to skip tenant verification
  const { data, error } = await (supabase
    .from('closure_reports') as any)
    .update({
      tenant_verification_status: 'owner_override',
      owner_override_reason: `EMERGENCY: ${emergencyReason}`,
      owner_override_at: new Date().toISOString(),
    })
    .eq('maintenance_request_id', requestId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error marking as emergency:', error);
    throw error;
  }

  console.log('✅ Marked as emergency repair - tenant verification skipped');

  return data as ClosureReport;
}

/**
 * Auto-approve expired closures (Cron job)
 * Automatically approves closures when tenant is unresponsive for 72 hours
 *
 * @returns Array of auto-approved closure reports
 *
 * @example
 * ```typescript
 * // Called by cron job every hour
 * const autoApproved = await autoApproveExpiredClosures();
 * console.log(`Auto-approved ${autoApproved.length} closures`);
 * ```
 */
export async function autoApproveExpiredClosures(): Promise<ClosureReport[]> {
  console.log('⏰ Checking for expired closures to auto-approve...');

  const now = new Date().toISOString();

  // Find closures pending tenant verification that have passed auto-approve deadline
  const { data: expiredClosures, error: fetchError } = await (supabase
    .from('closure_reports') as any)
    .select(`
      id,
      maintenance_request_id,
      forwarded_to_tenant_at,
      auto_approve_at,
      maintenance_requests!inner(owner_id, tenant_id)
    `)
    .eq('tenant_verification_status', 'pending_tenant')
    .lte('auto_approve_at', now)
    .limit(50); // Process max 50 at a time

  if (fetchError) {
    console.error('❌ Error fetching expired closures:', fetchError);
    throw fetchError;
  }

  if (!expiredClosures || expiredClosures.length === 0) {
    console.log('✅ No expired closures to auto-approve');
    return [];
  }

  console.log(`📋 Found ${expiredClosures.length} expired closures to auto-approve`);

  // Auto-approve each closure
  const autoApproved: ClosureReport[] = [];

  for (const closure of expiredClosures) {
    const { data: updated, error: updateError } = await (supabase
      .from('closure_reports') as any)
      .update({
        tenant_verification_status: 'auto_approved',
        tenant_ack_at: new Date().toISOString(),
        tenant_notes: 'Auto-approved after 72 hours - tenant unresponsive',
      })
      .eq('id', closure.id)
      .select()
      .single();

    if (updateError) {
      console.error(`❌ Error auto-approving closure ${closure.id}:`, updateError);
      continue;
    }

    autoApproved.push(updated as ClosureReport);

    // TODO: Send notification to owner and tenant (WORK_AUTO_APPROVED_TIMEOUT)
  }

  console.log(`✅ Auto-approved ${autoApproved.length} closures`);
  return autoApproved;
}

/**
 * Add mediation message
 * Add message to dispute resolution thread
 *
 * @param closureReportId - Closure report ID
 * @param senderId - User ID of sender
 * @param senderRole - Role of sender (owner/tenant/vendor)
 * @param message - Message text
 * @param photos - Optional photo URLs
 * @returns Created mediation message
 *
 * @example
 * ```typescript
 * const msg = await addMediationMessage(
 *   closureReportId,
 *   ownerId,
 *   'owner',
 *   'I reviewed the photos - the issue appears to be a separate problem.',
 *   []
 * );
 * ```
 */
export async function addMediationMessage(
  closureReportId: string,
  senderId: string,
  senderRole: SenderRole,
  message: string,
  photos?: string[]
): Promise<MediationMessage> {
  console.log('💬 Adding mediation message:', { closureReportId, senderRole });

  // Validation
  if (!message || message.trim().length < 5) {
    throw new Error('Message must be at least 5 characters');
  }

  if (!['owner', 'tenant', 'vendor'].includes(senderRole)) {
    throw new Error('Invalid sender role');
  }

  // Insert mediation message
  const { data, error } = await (supabase
    .from('closure_mediation_messages') as any)
    .insert({
      closure_report_id: closureReportId,
      sender_id: senderId,
      sender_role: senderRole,
      message: message.trim(),
      photos: photos || [],
    })
    .select(`
      *,
      sender:sender_id(id, full_name, avatar_url, email)
    `)
    .single();

  if (error) {
    console.error('❌ Error adding mediation message:', error);
    throw error;
  }

  console.log('✅ Mediation message added');

  // TODO: Send notification to other parties in the mediation

  return data as MediationMessage;
}

/**
 * Get mediation messages
 * Fetch all mediation messages for a closure report
 *
 * @param closureReportId - Closure report ID
 * @returns Array of mediation messages ordered by time
 *
 * @example
 * ```typescript
 * const messages = await getMediationMessages(closureReportId);
 * ```
 */
export async function getMediationMessages(
  closureReportId: string
): Promise<MediationMessage[]> {
  console.log('📖 Fetching mediation messages:', { closureReportId });

  const { data, error } = await (supabase
    .from('closure_mediation_messages') as any)
    .select(`
      *,
      sender:sender_id(id, full_name, avatar_url, email)
    `)
    .eq('closure_report_id', closureReportId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('❌ Error fetching mediation messages:', error);
    throw error;
  }

  return (data || []) as MediationMessage[];
}

/**
 * Flag for mediation
 * Manually flag a closure for mediation (alternative to automatic 3-rejection trigger)
 *
 * @param closureReportId - Closure report ID
 * @param reason - Reason for mediation
 * @returns Updated closure report
 *
 * @example
 * ```typescript
 * const report = await flagForMediation(
 *   closureReportId,
 *   'Complex dispute requiring owner intervention'
 * );
 * ```
 */
export async function flagForMediation(
  closureReportId: string,
  reason: string
): Promise<ClosureReport> {
  console.log('🚩 Flagging for mediation:', { closureReportId });

  const { data, error } = await (supabase
    .from('closure_reports') as any)
    .update({
      mediation_required: true,
      mediation_reason: reason,
    })
    .eq('id', closureReportId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error flagging for mediation:', error);
    throw error;
  }

  console.log('✅ Flagged for mediation');

  // TODO: Send notification to owner (MEDIATION_REQUIRED)

  return data as ClosureReport;
}
