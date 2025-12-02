/**
 * Quote Actions API
 * Accept, reject, and request revisions on quotes
 */

import { supabase } from '@/src/lib/supabase';
import type { PurchaseOrder } from '../types/po.types';
import type { Quote } from '../types/quote.types';
import { getQuoteById } from './quotes.api';

/**
 * Accept a quote (Owner action)
 * This will:
 * 1. Update quote status to 'approved'
 * 2. Update maintenance request with selected_vendor_id and selected_quote_id
 * 3. Change maintenance request status to 'assigned'
 * 4. Generate a Purchase Order
 * 
 * @param quoteId - The quote ID to accept
 * @param ownerId - The owner's user ID (for verification)
 * @returns Object with updated quote and generated PO
 */
export async function acceptQuote(
  quoteId: string,
  ownerId: string
): Promise<{
  quote: Quote;
  po: PurchaseOrder;
  message: string;
}> {
  console.log('🎯 Accepting quote:', { quoteId, ownerId });

  // 1. Get the quote details
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();

  if (quoteError) {
    console.error('❌ Error fetching quote:', quoteError);
    throw quoteError;
  }

  const typedQuote = quote as any;

  // Verify owner
  if (typedQuote.owner_id !== ownerId) {
    throw new Error('Unauthorized: You are not the owner of this quote');
  }

  console.log('✅ Quote found and authorized');

  // 2. Update quote status to 'approved'
  const { data: updatedQuote, error: updateQuoteError } = await (supabase
    .from('quotes') as any)
    .update({
      status: 'approved',
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)
    .select()
    .single();

  if (updateQuoteError) {
    console.error('❌ Error updating quote:', updateQuoteError);
    throw updateQuoteError;
  }

  console.log('✅ Quote updated to approved');

  // 3. Update maintenance request
  if (typedQuote.request_id) {
    const { error: updateRequestError } = await (supabase
      .from('maintenance_requests') as any)
      .update({
        selected_quote_id: quoteId,
        selected_vendor_id: typedQuote.vendor_id,
        status: 'assigned',
        mms_status: 'po_issued',
      })
      .eq('id', typedQuote.request_id);

    if (updateRequestError) {
      console.error('❌ Error updating maintenance request:', updateRequestError);
      throw updateRequestError;
    }

    console.log('✅ Maintenance request updated');
  }

  // 4. Generate Purchase Order
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const poNumber = `PO-${date}-${random}`;
  
  const { data: newPO, error: poError } = await (supabase
    .from('purchase_orders') as any)
    .insert([{
      contract_id: typedQuote.contract_id,
      po_number: poNumber,
      currency: 'ZAR',
      subtotal: typedQuote.subtotal,
      vat_amount: typedQuote.vat_amount,
      platform_fee_amount: 0,
      total_amount: typedQuote.total_amount,
      status: 'issued',
      revision_number: 1,
    }])
    .select();

  if (poError) {
    console.error('❌ Error creating PO:', poError);
    if (poError.code === '42501') {
      throw new Error('Permission denied: Unable to create Purchase Order');
    }
    throw poError;
  }

  if (!newPO || newPO.length === 0) {
    throw new Error('Failed to create PO - no data returned');
  }

  const po = newPO[0];
  console.log('✅ PO created');

  // 5. Link PO to maintenance request
  if (typedQuote.request_id) {
    const { error: linkError } = await (supabase
      .from('maintenance_requests') as any)
      .update({ po_id: po.id })
      .eq('id', typedQuote.request_id);

    if (linkError) {
      console.error('❌ Error linking PO to request:', linkError);
      throw linkError;
    }

    console.log('✅ PO linked to maintenance request');
  }

  return {
    quote: updatedQuote as Quote,
    po: po as PurchaseOrder,
    message: 'Quote accepted and PO generated successfully',
  };
}

/**
 * Reject a quote (Owner action)
 * 
 * @param quoteId - The quote ID to reject
 * @param ownerId - The owner's user ID (for verification)
 * @param rejectionReason - Optional reason for rejection
 * @returns Updated quote
 */
export async function rejectQuote(
  quoteId: string,
  ownerId: string,
  rejectionReason?: string
): Promise<Quote> {
  console.log('❌ Rejecting quote:', { quoteId, ownerId, rejectionReason });

  // Get the quote to verify owner
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('owner_id')
    .eq('id', quoteId)
    .single();

  if (quoteError) throw quoteError;

  const typedQuote = quote as any;

  if (typedQuote.owner_id !== ownerId) {
    throw new Error('Unauthorized: You are not the owner of this quote');
  }

  // Update quote status
  const { data, error } = await (supabase
    .from('quotes') as any)
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
      revision_reason: rejectionReason || null,
    })
    .eq('id', quoteId)
    .select()
    .single();

  if (error) throw error;

  console.log('✅ Quote rejected');

  return data as Quote;
}

/**
 * Request revision on a quote (Owner action)
 * 
 * @param quoteId - The quote ID
 * @param ownerId - The owner's user ID (for verification)
 * @param revisionReason - Reason for requesting revision
 * @returns Updated quote
 */
export async function requestQuoteRevision(
  quoteId: string,
  ownerId: string,
  revisionReason: string
): Promise<Quote> {
  console.log('🔄 Requesting quote revision:', { quoteId, ownerId, revisionReason });

  // Get the quote to verify owner
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('owner_id')
    .eq('id', quoteId)
    .single();

  if (quoteError) throw quoteError;

  const typedQuote = quote as any;

  if (typedQuote.owner_id !== ownerId) {
    throw new Error('Unauthorized: You are not the owner of this quote');
  }

  // Update quote status
  const { data, error } = await (supabase
    .from('quotes') as any)
    .update({
      status: 'revision_requested',
      revision_reason: revisionReason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)
    .select()
    .single();

  if (error) throw error;

  console.log('✅ Revision requested');

  return data as Quote;
}

/**
 * Generate PO from approved quote
 * Creates a PO with all quote details
 * 
 * @param quoteId - The approved quote ID
 * @param approvedQuote - Optional pre-fetched quote object to avoid refetching
 * @returns Created purchase order
 */
export async function generatePOFromQuote(
  quoteId: string,
  approvedQuote?: Quote
): Promise<PurchaseOrder> {
  // Use provided quote or fetch it
  const quote = approvedQuote || await getQuoteById(quoteId);

  // Check if PO already exists for this request
  if (quote.request_id) {
    const { data: existingRequest } = await supabase
      .from('maintenance_requests')
      .select('po_id')
      .eq('id', quote.request_id)
      .single();

    if (existingRequest && (existingRequest as any).po_id) {
      throw new Error('A PO has already been generated for this request');
    }
  }

  // Generate PO number
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  const poNumber = `PO-${date}-${random}`;

  // Create PO
  const { data, error } = await (supabase
    .from('purchase_orders') as any)
    .insert([{
      contract_id: quote.contract_id,
      po_number: poNumber,
      currency: 'ZAR',
      subtotal: quote.subtotal,
      vat_amount: quote.vat_amount,
      platform_fee_amount: 0,
      total_amount: quote.total_amount,
      status: 'issued',
      revision_number: 1,
    }])
    .select();

  if (error) {
    console.error('Error creating PO:', error);
    if (error.code === '42501') {
      throw new Error('Permission denied: Unable to create Purchase Order');
    }
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error('Failed to create PO - no data returned');
  }

  const po = data[0];

  // Update maintenance request with po_id and selected_quote_id
  if (quote.request_id) {
    const { error: updateError } = await (supabase
      .from('maintenance_requests') as any)
      .update({ 
        po_id: po.id,
        selected_quote_id: quoteId,
      })
      .eq('id', quote.request_id);

    if (updateError) {
      throw new Error(`Failed to link PO to maintenance request: ${updateError.message}`);
    }
  }

  return po as PurchaseOrder;
}
