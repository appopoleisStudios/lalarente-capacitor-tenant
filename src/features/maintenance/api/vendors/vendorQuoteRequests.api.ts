/**
 * Vendor Quote Requests API
 * Manage vendor quote requests (invitations)
 */

import { supabase } from '@/src/lib/supabase';
import type { QuoteRequestStatus, VendorQuoteRequest } from '../types/vendor.types';

/**
 * Create quote requests for multiple vendors
 * 
 * @param requestId - The maintenance request ID
 * @param vendorIds - Array of vendor IDs to invite
 */
export async function createQuoteRequests(
  requestId: string,
  vendorIds: string[]
): Promise<void> {
  const quoteRequests = vendorIds.map(vendorId => ({
    request_id: requestId,
    vendor_id: vendorId,
    status: 'pending' as QuoteRequestStatus,
    response_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }));

  const { error } = await supabase
    .from('vendor_quote_requests')
    .insert(quoteRequests);

  if (error) throw error;
}

/**
 * Get quote requests for a vendor
 * 
 * @param vendorId - The vendor's user ID
 * @returns Array of quote requests
 */
export async function getQuoteRequestsForVendor(
  vendorId: string
): Promise<VendorQuoteRequest[]> {
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
  const { error } = await (supabase
    .from('vendor_quote_requests') as any)
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq('request_id', requestId)
    .eq('vendor_id', vendorId);

  if (error) throw error;
}
