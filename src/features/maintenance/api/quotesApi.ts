import { supabase } from '@/src/lib/supabase';
import type { Quote } from '@/src/types/database.types';

export interface CreateQuoteInput {
  request_id: string;
  vendor_id: string;
  owner_id: string;          // REQUIRED - who gets the quote
  property_id: string;       // REQUIRED
  subtotal: number;
  vat_amount?: number;
  discount_amount?: number;
  total_amount: number;
  notes?: string;
  validity_date?: string;    // When quote expires
}

export interface VendorQuoteRequestInput {
  request_id: string;
  vendor_id: string;
  response_deadline?: string; // When vendor must respond by
}

export const quotesApi = {
  // ============================================
  // FETCH QUOTES
  // ============================================
  
  // Get all quotes for a maintenance request
  async getQuotesForRequest(requestId: string) {
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
        quote_lines(
          id,
          description,
          quantity,
          unit_price,
          total_price
        )
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // ============================================
  // VENDOR SUBMITS QUOTE
  // ============================================
  
  async createQuote(input: CreateQuoteInput) {
    // Calculate total if not provided
    const total = input.total_amount || (
      input.subtotal + (input.vat_amount || 0) - (input.discount_amount || 0)
    );

    const { data, error } = await supabase
      .from('quotes')
      .insert({
        request_id: input.request_id,
        vendor_id: input.vendor_id,
        owner_id: input.owner_id,
        property_id: input.property_id,
        subtotal: input.subtotal,
        vat_amount: input.vat_amount || 0,
        discount_amount: input.discount_amount || 0,
        total_amount: total,
        notes: input.notes,
        validity_date: input.validity_date,
        status: 'draft', // Default status from schema
      })
      .select(`
        *,
        vendor:profiles!vendor_id(id, full_name, phone)
      `)
      .single();

    if (error) throw error;

    // Update vendor_quote_request status
    await supabase
      .from('vendor_quote_requests')
      .update({ 
        status: 'responded',
        responded_at: new Date().toISOString(),
        quote_id: data.id,
      })
      .eq('request_id', input.request_id)
      .eq('vendor_id', input.vendor_id);

    return data as Quote;
  },

  // ============================================
  // PUSH TO VENDORS
  // ============================================
  
  async sendQuoteRequestToVendors(
    requestId: string,
    vendorIds: string[],
    responseDeadline?: string
  ) {
    const requests = vendorIds.map(vendorId => ({
      request_id: requestId,
      vendor_id: vendorId,
      status: 'pending',
      response_deadline: responseDeadline,
    }));

    const { data, error } = await supabase
      .from('vendor_quote_requests')
      .insert(requests)
      .select(`
        *,
        vendor:profiles!vendor_id(id, full_name, phone, email)
      `);

    if (error) throw error;

    // Update maintenance request status
    await supabase
      .from('maintenance_requests')
      .update({
        mms_status: 'vendor_routing',
        vendor_routed_at: new Date().toISOString(),
        quote_deadline: responseDeadline,
      })
      .eq('id', requestId);

    return data;
  },

  // ============================================
  // ACCEPT QUOTE (OWNER SELECTS VENDOR)
  // ============================================
  
  async acceptQuote(quoteId: string, requestId: string) {
    // 1. Get quote details
    const { data: quote, error: fetchError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (fetchError) throw fetchError;

    // 2. Update quote status
    const { error: quoteError } = await supabase
      .from('quotes')
      .update({ 
        status: 'approved',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (quoteError) throw quoteError;

    // 3. Update maintenance request
    const { error: requestError } = await supabase
      .from('maintenance_requests')
      .update({
        selected_quote_id: quoteId,
        selected_vendor_id: quote.vendor_id,
        mms_status: 'po_issued',
        status: 'assigned',
        estimated_cost: quote.total_amount,
      })
      .eq('id', requestId);

    if (requestError) throw requestError;

    // 4. Reject other quotes
    await supabase
      .from('quotes')
      .update({ 
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
      .eq('request_id', requestId)
      .neq('id', quoteId);

    return quote as Quote;
  },

  // ============================================
  // REJECT QUOTE
  // ============================================
  
  async rejectQuote(quoteId: string) {
    const { data, error } = await supabase
      .from('quotes')
      .update({ 
        status: 'rejected',
        rejected_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;
    return data as Quote;
  },

  // ============================================
  // COMPARE QUOTES (Sorted by price)
  // ============================================
  
  async compareQuotes(requestId: string) {
    const { data, error } = await supabase
      .from('quotes')
      .select(`
        *,
        vendor:profiles!vendor_id(
          id, 
          full_name, 
          phone, 
          email
        ),
        quote_lines(*)
      `)
      .eq('request_id', requestId)
      .in('status', ['draft', 'submitted'])
      .order('total_amount', { ascending: true });

    if (error) throw error;
    return data;
  },

  // ============================================
  // GET VENDOR QUOTE REQUESTS
  // ============================================
  
  async getVendorQuoteRequests(requestId: string) {
    const { data, error } = await supabase
      .from('vendor_quote_requests')
      .select(`
        *,
        vendor:profiles!vendor_id(id, full_name, phone, email),
        quote:quotes(id, total_amount, status, created_at)
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // ============================================
  // REAL-TIME SUBSCRIPTION
  // ============================================
  
  subscribeToQuotes(requestId: string, callback: (payload: any) => void) {
    const subscription = supabase
      .channel(`quotes_${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `request_id=eq.${requestId}`,
        },
        callback
      )
      .subscribe();

    return subscription;
  },

  unsubscribe(subscription: any) {
    subscription.unsubscribe();
  },
};
