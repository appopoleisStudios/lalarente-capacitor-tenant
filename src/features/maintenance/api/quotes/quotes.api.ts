/**
 * Quotes API
 * Core quote CRUD operations
 */

import { supabase } from '@/src/lib/supabase';
import type { Quote, QuoteSubmissionData, QuoteUpdateData } from '../types/quote.types';
import { createQuoteRevision } from './quoteRevisions.api';

/**
 * Get quotes for a maintenance request
 * Includes optional contract information when contract_id is present
 * 
 * @param requestId - The maintenance request ID
 * @returns Array of quotes with vendor and optional contract information
 */
export async function getQuotesByRequest(requestId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      vendor:profiles!vendor_id(
        id,
        full_name,
        phone,
        email,
        avatar_url
      ),
      contract:service_contracts(
        id,
        status
      )
    `)
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Quote[];
}

/**
 * Get single quote by ID
 * 
 * @param quoteId - The quote ID
 * @returns Quote with vendor information
 */
export async function getQuoteById(quoteId: string): Promise<Quote> {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      vendor:profiles!vendor_id(
        id,
        full_name,
        phone,
        email,
        avatar_url
      )
    `)
    .eq('id', quoteId)
    .single();

  if (error) throw error;
  return data as Quote;
}

/**
 * Get approved quote for a request
 * 
 * @param requestId - The maintenance request ID
 * @returns Approved quote or null if none found
 */
export async function getApprovedQuote(requestId: string): Promise<Quote | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select(`
      *,
      vendor:profiles!vendor_id(
        id,
        full_name,
        phone,
        email,
        avatar_url
      )
    `)
    .eq('request_id', requestId)
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Quote | null;
}

/**
 * Submit a new quote with line items (vendor action)
 * 
 * @param quoteData - Quote submission data including line items
 * @returns Created quote
 */
export async function submitQuote(quoteData: QuoteSubmissionData): Promise<Quote> {
  try {
    // Create the quote
    const { data: quote, error: quoteError } = await (supabase
      .from('quotes') as any)
      .insert({
        request_id: quoteData.request_id,
        vendor_id: quoteData.vendor_id,
        owner_id: quoteData.owner_id,
        property_id: quoteData.property_id,
        contract_id: quoteData.contract_id || null,
        status: 'submitted',
        subtotal: quoteData.subtotal,
        vat_amount: quoteData.vat_amount,
        discount_amount: quoteData.discount_amount,
        total_amount: quoteData.total_amount,
        notes: quoteData.notes || null,
        revision_number: 1,
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    // Create quote line items
    const lineItemsToInsert = quoteData.line_items.map(item => ({
      quote_id: quote.id,
      description: item.name,
      qty: item.quantity,
      unit_price: item.unit_price,
      unit: 'unit',
      tax_rate: 0.15,
    }));

    const { error: linesError } = await (supabase
      .from('quote_lines') as any)
      .insert(lineItemsToInsert);

    if (linesError) throw linesError;

    // Update vendor_quote_requests if it exists
    await (supabase
      .from('vendor_quote_requests') as any)
      .update({
        quote_id: quote.id,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
      })
      .eq('request_id', quoteData.request_id)
      .eq('vendor_id', quoteData.vendor_id);

    return quote as Quote;
  } catch (error) {
    console.error('Error submitting quote:', error);
    throw error;
  }
}

/**
 * Update quote with revision tracking
 * Creates a revision record before updating the quote
 * 
 * @param quoteId - The quote ID to update
 * @param updateData - The fields to update
 * @param userId - The user making the update (vendor_id or owner_id)
 * @returns Updated quote
 */
export async function updateQuote(
  quoteId: string,
  updateData: QuoteUpdateData,
  userId: string
): Promise<Quote> {
  // First, get the current quote to create revision
  const currentQuote = await getQuoteById(quoteId);
  
  const currentRevision = currentQuote.revision_number || 0;
  const newRevision = currentRevision + 1;

  // Create revision record
  await createQuoteRevision(
    quoteId,
    {
      revision_number: currentRevision,
      subtotal: currentQuote.subtotal || 0,
      vat_amount: currentQuote.vat_amount || 0,
      discount_amount: currentQuote.discount_amount || 0,
      total_amount: currentQuote.total_amount || 0,
      notes: currentQuote.notes,
      revision_reason: updateData.revision_reason,
    },
    userId
  );

  // Update the quote with new data
  const { data, error } = await (supabase
    .from('quotes') as any)
    .update({
      ...updateData,
      revision_number: newRevision,
      status: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', quoteId)
    .select()
    .single();

  if (error) throw error;
  return data as Quote;
}
