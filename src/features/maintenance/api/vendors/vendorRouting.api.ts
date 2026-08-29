/**
 * Vendor Routing API
 * Push requests to vendors and manage routing
 */

import { supabase } from '@/src/lib/supabase';
import { notificationsApi } from '@/src/features/notifications/api/notificationsApi';
import type { MaintenanceRequest } from '../types/maintenance.types';
import { getDedicatedVendors } from './vendorDiscovery.api';
import { createQuoteRequests } from './vendorQuoteRequests.api';

async function notifyVendorsOfJob(requestId: string, vendorIds: string[], title: string) {
  await Promise.all(
    vendorIds.map((vendorId) =>
      notificationsApi
        .sendNotification({
          user_id: vendorId,
          type: 'maintenance_updated',
          data: {
            request_id: requestId,
            customTitle: 'New job to quote',
            customBody: `You have been invited to quote on "${title}".`,
          },
        })
        .catch(() => null)
    )
  );
}

/**
 * Push request to open market (public visibility)
 * Makes the request visible to all vendors
 *
 * @param requestId - The maintenance request ID
 * @returns Updated maintenance request
 */
export async function pushToOpenMarket(requestId: string): Promise<MaintenanceRequest> {
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({
      visibility: 'public',
      vendor_routed_at: new Date().toISOString(),
      mms_status: 'vendor_routed',
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;
  const row = data as unknown as MaintenanceRequest & { title?: string; category_id?: string };
  try {
    let ids: string[] = [];
    if (row.category_id) {
      const { data: vendors } = await supabase
        .from('vendor_services')
        .select('vendor_id')
        .eq('category_id', row.category_id)
        .eq('is_active', true)
        .limit(20);
      ids = [...new Set((vendors || []).map((v: { vendor_id: string }) => v.vendor_id))];
    }
    await notifyVendorsOfJob(requestId, ids, row.title || 'a maintenance job');
  } catch {
    /* non-fatal */
  }
  return row;
}

/**
 * Push request to dedicated vendors (invited visibility)
 * Creates quote requests for property's dedicated vendors
 *
 * @param requestId - The maintenance request ID
 * @returns Object with updated request and vendor count
 */
export async function pushToDedicatedVendors(requestId: string): Promise<{
  request: MaintenanceRequest;
  vendorsNotified: number;
}> {
  // Get the request details
  const { data: request, error: requestError } = await supabase
    .from('maintenance_requests')
    .select('id, property_id, category_id, title')
    .eq('id', requestId)
    .single();

  if (requestError) throw requestError;

  const typedRequest = request as any;

  if (!typedRequest || !typedRequest.property_id) {
    throw new Error('Request or property not found');
  }

  // Get dedicated vendors for this property
  const vendors = await getDedicatedVendors(
    typedRequest.property_id,
    typedRequest.category_id || undefined
  );

  if (vendors.length === 0) {
    throw new Error('No dedicated vendors found for this property');
  }

  await createQuoteRequests(
    requestId,
    vendors.map((vendor) => vendor.id)
  );

  // Update request visibility and routing timestamp
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({
      visibility: 'invited',
      vendor_routed_at: new Date().toISOString(),
      mms_status: 'vendor_routed',
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  await notifyVendorsOfJob(
    requestId,
    vendors.map((vendor) => vendor.id),
    typedRequest.title || 'a maintenance job'
  );

  return {
    request: data as unknown as MaintenanceRequest,
    vendorsNotified: vendors.length,
  };
}

/**
 * Push request to specific vendors (custom selection)
 * Creates quote requests for selected vendors
 *
 * @param requestId - The maintenance request ID
 * @param vendorIds - Array of vendor IDs to invite
 * @returns Object with updated request and vendor count
 */
export async function pushToSelectedVendors(
  requestId: string,
  vendorIds: string[]
): Promise<{
  request: MaintenanceRequest;
  vendorsNotified: number;
}> {
  if (vendorIds.length === 0) {
    throw new Error('No vendors selected');
  }

  const uniqueVendorIds = [...new Set(vendorIds)];
  await createQuoteRequests(requestId, uniqueVendorIds);

  // Update request visibility and routing timestamp
  const { data, error } = await supabase
    .from('maintenance_requests')
    .update({
      visibility: 'invited',
      vendor_routed_at: new Date().toISOString(),
      mms_status: 'vendor_routed',
    })
    .eq('id', requestId)
    .select()
    .single();

  if (error) throw error;

  const title =
    ((data as { title?: string } | null)?.title as string | undefined) || 'a maintenance job';
  await notifyVendorsOfJob(requestId, uniqueVendorIds, title);

  return {
    request: data as unknown as MaintenanceRequest,
    vendorsNotified: uniqueVendorIds.length,
  };
}

/**
 * Invite vendor by email (if not registered yet)
 * Sends an invitation to join the platform
 *
 * @param email - The vendor's email address
 * @param requestId - The maintenance request ID
 * @param ownerName - The owner's name
 * @returns Success indicator
 */
export async function inviteVendorByEmail(
  email: string,
  requestId: string,
  _ownerName: string
): Promise<{
  success: boolean;
  message: string;
  email: string;
  vendor_exists?: boolean;
}> {
  const trimmed = email.trim().toLowerCase();
  const { data, error } = await supabase.functions.invoke('send-vendor-invite-email', {
    body: { email: trimmed, request_id: requestId },
  });

  if (error) {
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    let message = error.message || 'Failed to send invitation';
    try {
      const body = await ctx?.json?.();
      if (body?.error) message = body.error;
    } catch {
      /* keep message */
    }
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  if (data?.vendor_exists) {
    return {
      success: false,
      vendor_exists: true,
      email: trimmed,
      message:
        data.message ||
        'This email is already a LalaRente vendor. Invite them to quote from the directory.',
    };
  }

  if (!data?.success) {
    throw new Error('Invitation was not sent.');
  }

  return {
    success: true,
    email: trimmed,
    message: `Invitation email sent to ${trimmed}.`,
  };
}
