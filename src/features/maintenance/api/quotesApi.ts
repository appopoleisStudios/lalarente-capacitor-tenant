import { supabase } from '@/src/lib/supabase';

export interface Quote {
  id: string;
  vendor_id: string;
  owner_id: string;
  property_id: string;
  request_id?: string;
  /**
   * Optional reference to a service contract.
   * This field is populated when the quote is from a long-term contracted vendor.
   * For ad-hoc or short-term maintenance requests, this will be null.
   * @nullable
   */
  contract_id: string | null;
  status: 'requested' | 'submitted' | 'approved' | 'rejected' | 'revision_requested';
  subtotal?: number;
  vat_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  notes?: string;
  revision_number?: number;
  revision_reason?: string;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    full_name: string;
    phone: string;
    email: string;
    avatar_url?: string;
  };
  /**
   * Optional contract information when contract_id is present.
   * Only populated when the quote is associated with a long-term service contract.
   */
  contract?: {
    id: string;
    status: string | null;
  };
}

export interface QuoteRevision {
  id: string;
  quote_id: string;
  revision_number: number;
  subtotal: number;
  vat_amount: number;
  discount_amount: number;
  total_amount: number;
  notes?: string;
  revised_by: string;
  revision_reason?: string;
  created_at: string;
}

export interface QuoteUpdateData {
  subtotal?: number;
  vat_amount?: number;
  discount_amount?: number;
  total_amount?: number;
  notes?: string;
  revision_reason?: string;
}

export const quotesApi = {
  /**
   * Get quotes for a maintenance request.
   * Includes optional contract information when contract_id is present.
   * 
   * @param requestId - The maintenance request ID
   * @returns Array of quotes with vendor and optional contract information
   */
  async getQuotesByRequest(requestId: string) {
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
    return data as Quote[];
  },

  // Get single quote
  async getQuoteById(quoteId: string) {
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
  },

  // Accept a quote
  async acceptQuote(quoteId: string) {
    const { data, error } = await (supabase
      .from('quotes') as any)
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;
    return data as Quote;
  },

  // Reject a quote
  async rejectQuote(quoteId: string) {
    const { data, error } = await (supabase
      .from('quotes') as any)
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;
    return data as Quote;
  },

  // Get approved quote for a request
  async getApprovedQuote(requestId: string) {
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
  },

  // Subscribe to quote changes
  subscribeToQuotes(requestId: string, callback: (quote: Quote) => void) {
    const subscription = supabase
      .channel(`quotes:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quotes',
          filter: `request_id=eq.${requestId}`,
        },
        async (payload) => {
          // Fetch the complete quote with relations
          const newRecord = payload.new as { id: string };
          const { data } = await supabase
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
            .eq('id', newRecord.id)
            .single();

          if (data) {
            callback(data as Quote);
          }
        }
      )
      .subscribe();

    return subscription;
  },

  // Unsubscribe
  unsubscribe(subscription: any) {
    subscription.unsubscribe();
  },

  /**
   * Update quote with revision tracking
   * Creates a revision record before updating the quote
   * 
   * @param quoteId - The quote ID to update
   * @param updateData - The fields to update
   * @param userId - The user making the update (vendor_id or owner_id)
   * @returns Updated quote
   */
  async updateQuote(quoteId: string, updateData: QuoteUpdateData, userId: string) {
    // First, get the current quote to create revision
    const currentQuote = await quotesApi.getQuoteById(quoteId);
    
    const currentRevision = currentQuote.revision_number || 0;
    const newRevision = currentRevision + 1;

    // Create revision record
    const { error: revisionError } = await (supabase
      .from('quote_revisions') as any)
      .insert({
        quote_id: quoteId,
        revision_number: currentRevision,
        subtotal: currentQuote.subtotal,
        vat_amount: currentQuote.vat_amount,
        discount_amount: currentQuote.discount_amount,
        total_amount: currentQuote.total_amount,
        notes: currentQuote.notes,
        revised_by: userId,
        revision_reason: updateData.revision_reason,
      });

    if (revisionError) throw revisionError;

    // Update the quote with new data
    const { data, error } = await (supabase
      .from('quotes') as any)
      .update({
        ...updateData,
        revision_number: newRevision,
        status: 'submitted', // Reset to submitted after edit
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;
    return data as Quote;
  },

  /**
   * Request revision from vendor (owner action)
   * 
   * @param quoteId - The quote ID
   * @param reason - Reason for requesting revision
   * @returns Updated quote
   */
  async requestRevision(quoteId: string, reason: string) {
    const { data, error } = await (supabase
      .from('quotes') as any)
      .update({
        status: 'revision_requested',
        revision_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select()
      .single();

    if (error) throw error;
    return data as Quote;
  },

  /**
   * Get revision history for a quote
   * 
   * @param quoteId - The quote ID
   * @returns Array of revisions ordered by revision number
   */
  async getQuoteRevisions(quoteId: string): Promise<QuoteRevision[]> {
    const { data, error } = await supabase
      .from('quote_revisions')
      .select('*')
      .eq('quote_id', quoteId)
      .order('revision_number', { ascending: true });

    if (error) throw error;
    return data as QuoteRevision[];
  },

  /**
   * Auto-generate PO from approved quote
   * Creates a PO with all quote details
   * 
   * @param quoteId - The approved quote ID
   * @returns Created purchase order
   */
  async generatePOFromQuote(quoteId: string) {
    const quote = await quotesApi.getQuoteById(quoteId);
    
    if (quote.status !== 'approved') {
      throw new Error('Only approved quotes can generate POs');
    }

    // Generate PO number (format: PO-YYYYMMDD-XXXX)
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const poNumber = `PO-${date}-${random}`;

    // Create PO
    const { data, error } = await (supabase
      .from('purchase_orders') as any)
      .insert({
        contract_id: quote.contract_id,
        po_number: poNumber,
        currency: 'USD', // Default, should come from quote or property settings
        subtotal: quote.subtotal,
        vat_amount: quote.vat_amount,
        platform_fee_amount: 0, // Calculate based on business logic
        total_amount: quote.total_amount,
        status: 'draft',
        revision_number: 1,
      })
      .select()
      .single();

    if (error) throw error;

    // Update maintenance request with po_id
    if (quote.request_id) {
      await (supabase
        .from('maintenance_requests') as any)
        .update({ po_id: data.id })
        .eq('id', quote.request_id);
    }

    return data;
  },
};
