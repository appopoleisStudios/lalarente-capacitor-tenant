/**
 * Vendor Quote Requests API
 * Manage vendor quote requests (invitations)
 */

import { supabase } from '@/src/lib/supabase';
import type { QuoteRequestStatus, VendorQuoteRequest } from '../types/vendor.types';

export class VendorAlreadyInvitedError extends Error {
  constructor() {
    super('This vendor has already been invited to quote on this request.');
    this.name = 'VendorAlreadyInvitedError';
  }
}

async function getInviteActor(): Promise<{ id: string; role: 'owner' | 'tenant' }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Sign in again to invite a vendor.');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (profileError) throw profileError;
  if (profile.role !== 'owner' && profile.role !== 'tenant') {
    throw new Error('Only an owner or tenant can invite a vendor.');
  }

  return { id: user.id, role: profile.role };
}

/**
 * Create quote requests for multiple vendors
 *
 * @param requestId - The maintenance request ID
 * @param vendorIds - Array of vendor IDs to invite
 */
export async function createQuoteRequests(requestId: string, vendorIds: string[]): Promise<void> {
  const uniqueVendorIds = [...new Set(vendorIds)];
  if (uniqueVendorIds.length === 0) {
    throw new Error('No vendors selected');
  }

  const actor = await getInviteActor();
  const alreadyInvited = await getInvitedVendorIds(requestId);
  const freshVendorIds = uniqueVendorIds.filter((vendorId) => !alreadyInvited.has(vendorId));
  if (freshVendorIds.length === 0) {
    throw new VendorAlreadyInvitedError();
  }

  const quoteRequests = freshVendorIds.map((vendorId) => ({
    request_id: requestId,
    vendor_id: vendorId,
    status: 'pending' as QuoteRequestStatus,
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    invited_by: actor.id,
    invited_by_role: actor.role,
  }));

  const { error } = await (supabase.from('vendor_quote_requests') as any).insert(quoteRequests);

  if (error?.code === '23505') throw new VendorAlreadyInvitedError();
  if (error) throw error;
}

export async function getInvitedVendorIds(requestId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('vendor_quote_requests')
    .select('vendor_id')
    .eq('request_id', requestId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.vendor_id));
}

export async function getVendorQuoteInvitation(
  requestId: string,
  vendorId: string
): Promise<VendorQuoteRequest | null> {
  const { data, error } = await (supabase.from('vendor_quote_requests') as any)
    .select(
      'id, request_id, vendor_id, status, response_deadline, responded_at, quote_id, created_at, invited_by, invited_by_role'
    )
    .eq('request_id', requestId)
    .eq('vendor_id', vendorId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let inviter_name: string | null = null;
  if (data.invited_by) {
    const { data: inviter, error: inviterError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', data.invited_by)
      .maybeSingle();
    if (inviterError) throw inviterError;
    inviter_name = inviter?.full_name ?? null;
  }

  return { ...data, inviter_name } as VendorQuoteRequest;
}

/**
 * Get quote requests for a vendor
 *
 * @param vendorId - The vendor's user ID
 * @returns Array of quote requests
 */
export async function getQuoteRequestsForVendor(vendorId: string): Promise<VendorQuoteRequest[]> {
  const { data, error } = await supabase
    .from('vendor_quote_requests')
    .select('*')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as VendorQuoteRequest[];
}

/**
 * Update quote request status
 *
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID
 * @param status - The new status
 */
export async function updateQuoteRequestStatus(
  requestId: string,
  vendorId: string,
  status: QuoteRequestStatus
): Promise<void> {
  const { error } = await (supabase.from('vendor_quote_requests') as any)
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('request_id', requestId)
    .eq('vendor_id', vendorId);

  if (error) throw error;
}
