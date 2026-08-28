/**
 * Quote Actions API
 * Accept, reject, and request revisions on quotes
 */

import { supabase } from '@/src/lib/supabase';
import type { PurchaseOrder } from '../types/po.types';
import type { Quote } from '../types/quote.types';
import { getQuoteById } from './quotes.api';

/**
 * Accept a quote (job owner or job tenant).
 * Edge `accept-maintenance-quote` issues the PO with sent_to_vendor_at and
 * work_can_start so the vendor can start immediately.
 *
 * @param quoteId - The quote ID to accept
 * @param _actorId - Caller user id (JWT is the authority; kept for call-site compat)
 */
export async function acceptQuote(
  quoteId: string,
  _actorId: string
): Promise<{
  quote: Quote;
  po: PurchaseOrder;
  message: string;
}> {
  const { data, error } = await supabase.functions.invoke('accept-maintenance-quote', {
    body: { quote_id: quoteId },
  });

  if (error) {
    let message = error.message || 'Failed to accept quote';
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
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

  if (!data?.quote || !data?.po) {
    throw new Error('Quote accept did not return a PO');
  }

  return {
    quote: data.quote as Quote,
    po: data.po as PurchaseOrder,
    message: data.message || 'Quote accepted and PO issued',
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
  const { data, error } = await (supabase.from('quotes') as any)
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
  const { data, error } = await (supabase.from('quotes') as any)
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
  const quote = approvedQuote || (await getQuoteById(quoteId));

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
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
  const poNumber = `PO-${date}-${random}`;

  // Create PO
  const { data, error } = await (supabase.from('purchase_orders') as any)
    .insert([
      {
        contract_id: quote.contract_id,
        po_number: poNumber,
        currency: 'ZAR',
        subtotal: quote.subtotal,
        vat_amount: quote.vat_amount,
        platform_fee_amount: 0,
        total_amount: quote.total_amount,
        status: 'issued',
        revision_number: 1,
      },
    ])
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
    const { error: updateError } = await (supabase.from('maintenance_requests') as any)
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

/**
 * Tenant asks the owner to accept a submitted quote (optional; tenant can also
 * accept via acceptQuote / accept-maintenance-quote).
 */
export async function requestOwnerToAcceptQuote(
  quoteId: string,
  tenantId: string
): Promise<{ success: true }> {
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, status, owner_id, request_id, total_amount, vendor_id')
    .eq('id', quoteId)
    .single();
  if (quoteError || !quote) {
    throw new Error('Quote not found');
  }
  const row = quote as {
    id: string;
    status: string;
    owner_id: string;
    request_id: string | null;
    total_amount?: number;
  };
  if (!row.request_id) {
    throw new Error('Quote is not linked to a maintenance job');
  }
  const { data: request, error: reqError } = await supabase
    .from('maintenance_requests')
    .select('id, title, tenant_id, owner_id')
    .eq('id', row.request_id)
    .single();
  if (reqError || !request) {
    throw new Error('Job not found');
  }
  const job = request as { tenant_id: string; owner_id: string; title: string };
  if (job.tenant_id !== tenantId) {
    throw new Error('Only the tenant on this job can ask the owner to accept a quote');
  }
  if (row.status !== 'submitted') {
    throw new Error(`This quote is ${row.status}, not waiting for acceptance`);
  }

  const amount = Number(row.total_amount || 0);
  const amountLabel = `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
  const { error: nErr } = await (supabase as any).from('notifications').insert({
    user_id: job.owner_id,
    type: 'maintenance_updated',
    title: 'Tenant asked you to accept a quote',
    body: `Your tenant asked you to accept a ${amountLabel} quote on "${job.title}". Only you can issue the purchase order.`,
    data: {
      request_id: row.request_id,
      quote_id: quoteId,
    },
    channels: ['in_app'],
    priority: 'high',
    status: 'pending',
  } as any);
  if (nErr) {
    throw new Error(nErr.message || 'Could not notify the owner');
  }
  return { success: true };
}
