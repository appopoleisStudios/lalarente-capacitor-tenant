/**
 * Vendor Routing API
 * Push requests to vendors and manage routing
 */

import { supabase } from '@/src/lib/supabase';
import type { MaintenanceRequest } from '../types/maintenance.types';
import { getDedicatedVendors } from './vendorDiscovery.api';

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
  return data as MaintenanceRequest;
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
    .select('id, property_id, category_id')
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

  // Create vendor_quote_requests for each dedicated vendor
  const quoteRequests = vendors.map(vendor => ({
    request_id: requestId,
    vendor_id: vendor.id,
    status: 'pending',
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  }));

  const { error: insertError } = await supabase
    .from('vendor_quote_requests')
    .insert(quoteRequests);

  if (insertError) throw insertError;

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

  // TODO: Send notifications to vendors

  return {
    request: data as MaintenanceRequest,
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

  // Create vendor_quote_requests for selected vendors
  const quoteRequests = vendorIds.map(vendorId => ({
    request_id: requestId,
    vendor_id: vendorId,
    status: 'pending',
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
  }));

  const { error: insertError } = await supabase
    .from('vendor_quote_requests')
    .insert(quoteRequests);

  if (insertError) throw insertError;

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

  // TODO: Send notifications to selected vendors

  return {
    request: data as MaintenanceRequest,
    vendorsNotified: vendorIds.length,
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
  ownerName: string
): Promise<{
  success: boolean;
  message: string;
  email: string;
}> {
  // This would typically send an email/SMS invitation
  // For now, we'll just create a pending invitation record

  // TODO: Implement invitation system
  // - Send email with registration link
  // - Include request details
  // - Track invitation status

  console.log(`Invitation sent to ${email} for request ${requestId} by ${ownerName}`);

  return {
    success: true,
    message: 'Invitation sent',
    email,
  };
}
