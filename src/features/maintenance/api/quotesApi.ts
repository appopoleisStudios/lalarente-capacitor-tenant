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
  /**
   * Accept a quote (Owner action) - DEPRECATED
   * Use the new acceptQuote(quoteId, ownerId) instead
   * This version is kept for backward compatibility
   */
  async acceptQuoteOld(quoteId: string) {
    console.log('⚠️ Using deprecated acceptQuoteOld - please use acceptQuote(quoteId, ownerId) instead');
    console.log('📝 Accepting quote:', quoteId);
    
    // Update the quote status
    const { data, error } = await (supabase
      .from('quotes') as any)
      .update({
        status: 'approved',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId)
      .select();

    if (error) {
      console.error('❌ Failed to accept quote');
      throw error;
    }

    console.log('✅ Quote accepted successfully');
    return data;
  },

  /**
   * Reject a quote (Owner action) - DEPRECATED
   * Use the new rejectQuote(quoteId, ownerId, reason) instead
   */
  async rejectQuoteOld(quoteId: string) {
    console.log('⚠️ Using deprecated rejectQuoteOld - please use rejectQuote(quoteId, ownerId, reason) instead');
    
    const { error } = await (supabase
      .from('quotes') as any)
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (error) {
      console.error('Error rejecting quote:', error);
      throw error;
    }

    const updatedQuote = await quotesApi.getQuoteById(quoteId);
    return updatedQuote;
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
    const { error } = await (supabase
      .from('quotes') as any)
      .update({
        status: 'revision_requested',
        revision_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (error) {
      console.error('Error requesting revision:', error);
      throw error;
    }

    // Fetch the updated quote with full details
    const updatedQuote = await quotesApi.getQuoteById(quoteId);
    return updatedQuote;
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
   * @param approvedQuote - Optional pre-fetched quote object to avoid refetching
   * @returns Created purchase order
   */
  async generatePOFromQuote(quoteId: string, approvedQuote?: Quote) {
    // Use provided quote or fetch it
    const quote = approvedQuote || await quotesApi.getQuoteById(quoteId);

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

    // Generate PO number (format: PO-YYYYMMDD-XXXX)
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const poNumber = `PO-${date}-${random}`;

    // Create PO
    const { data, error } = await (supabase
      .from('purchase_orders') as any)
      .insert([{
        contract_id: quote.contract_id,
        po_number: poNumber,
        currency: 'ZAR', // South African Rand
        subtotal: quote.subtotal,
        vat_amount: quote.vat_amount,
        platform_fee_amount: 0, // Calculate based on business logic
        total_amount: quote.total_amount,
        status: 'issued',
        revision_number: 1,
      }])
      .select();

    if (error) {
      console.error('Error creating PO:', error);
      console.error('Quote data:', { quoteId, contract_id: quote.contract_id, request_id: quote.request_id });
      
      // Provide user-friendly error for RLS policy violations
      if (error.code === '42501') {
        throw new Error('Permission denied: Unable to create Purchase Order. Please contact support if this issue persists.');
      }
      
      throw error;
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to create PO - no data returned');
    }

    const po = data[0];

    // Update maintenance request with po_id and selected_quote_id
    if (quote.request_id) {
      console.log('🔄 Attempting to update maintenance request...');
      console.log('Request ID:', quote.request_id);
      console.log('PO ID:', po.id);
      console.log('Quote ID:', quoteId);
      
      const { data: updateData, error: updateError } = await (supabase
        .from('maintenance_requests') as any)
        .update({ 
          po_id: po.id,
          selected_quote_id: quoteId,
        })
        .eq('id', quote.request_id)
        .select();

      if (updateError) {
        console.error('❌ FAILED to update maintenance request');
        console.error('Error code:', updateError.code);
        console.error('Error message:', updateError.message);
        console.error('Error hint:', updateError.hint);
        console.error('Error details:', updateError.details);
        console.error('Full error:', updateError);
        
        // This is critical - throw the error so we know what's wrong
        throw new Error(`Failed to link PO to maintenance request: ${updateError.message || 'Unknown error'}`);
      } else {
        console.log('✅ Successfully updated maintenance request');
        console.log('Updated data:', updateData);
      }
    }

    return po;
  },

  /**
   * Submit a new quote with line items (vendor action)
   * 
   * @param quoteData - Quote data including line items
   * @returns Created quote with line items
   */
  async submitQuote(quoteData: {
    request_id: string;
    vendor_id: string;
    owner_id: string;
    property_id: string;
    contract_id?: string | null;
    subtotal: number;
    vat_amount: number;
    discount_amount: number;
    total_amount: number;
    notes?: string;
    estimated_duration?: string;
    warranty_period?: string;
    line_items: Array<{
      name: string;
      quantity: number;
      unit_price: number;
    }>;
  }) {
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
        unit: 'unit', // Default unit
        tax_rate: 0.15, // 15% VAT
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

      // TODO: Send notification to owner
      // This would be implemented with a notification service

      return quote as Quote;
    } catch (error) {
      console.error('Error submitting quote:', error);
      throw error;
    }
  },

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
  async acceptQuote(quoteId: string, ownerId: string) {
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

    console.log('🔍 Authorization check:', {
      quoteOwnerId: typedQuote.owner_id,
      providedOwnerId: ownerId,
      match: typedQuote.owner_id === ownerId,
    });

    // Verify owner
    if (typedQuote.owner_id !== ownerId) {
      console.error('❌ Authorization failed:', {
        quoteOwnerId: typedQuote.owner_id,
        providedOwnerId: ownerId,
      });
      throw new Error('Unauthorized: You are not the owner of this quote');
    }

    console.log('✅ Quote found and authorized:', typedQuote);

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
      const { data: updatedRequest, error: updateRequestError } = await (supabase
        .from('maintenance_requests') as any)
        .update({
          selected_quote_id: quoteId,
          selected_vendor_id: typedQuote.vendor_id,
          status: 'assigned',
          mms_status: 'po_issued',
        })
        .eq('id', typedQuote.request_id)
        .select()
        .single();

      if (updateRequestError) {
        console.error('❌ Error updating maintenance request:', updateRequestError);
        throw updateRequestError;
      }

      console.log('✅ Maintenance request updated:', updatedRequest);
    }

    // 4. Generate Purchase Order (using same format as generatePOFromQuote)
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const poNumber = `PO-${date}-${random}`;
    
    console.log('📝 Creating PO with quote data:', {
      subtotal: typedQuote.subtotal,
      vat_amount: typedQuote.vat_amount,
      total_amount: typedQuote.total_amount,
      contract_id: typedQuote.contract_id,
    });
    
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
      console.error('Quote data:', { quoteId, contract_id: typedQuote.contract_id, request_id: typedQuote.request_id });
      
      if (poError.code === '42501') {
        throw new Error('Permission denied: Unable to create Purchase Order. Please contact support if this issue persists.');
      }
      
      throw poError;
    }

    if (!newPO || newPO.length === 0) {
      throw new Error('Failed to create PO - no data returned');
    }

    const po = newPO[0];
    console.log('✅ PO created:', po);

    // 5. Link PO to maintenance request
    if (typedQuote.request_id) {
      console.log('🔄 Linking PO to maintenance request...');
      console.log('Request ID:', typedQuote.request_id);
      console.log('PO ID:', po.id);
      
      const { error: linkError } = await (supabase
        .from('maintenance_requests') as any)
        .update({
          po_id: po.id,
        })
        .eq('id', typedQuote.request_id);

      if (linkError) {
        console.error('❌ Error linking PO to request:', linkError);
        throw linkError;
      }

      console.log('✅ PO linked to maintenance request');
    }

    return {
      quote: updatedQuote,
      po: po,
      message: 'Quote accepted and PO generated successfully',
    };
  },

  /**
   * Reject a quote (Owner action)
   * 
   * @param quoteId - The quote ID to reject
   * @param ownerId - The owner's user ID (for verification)
   * @param rejectionReason - Optional reason for rejection
   */
  async rejectQuote(quoteId: string, ownerId: string, rejectionReason?: string) {
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

    return data;
  },

  /**
   * Request revision on a quote (Owner action)
   * 
   * @param quoteId - The quote ID
   * @param ownerId - The owner's user ID (for verification)
   * @param revisionReason - Reason for requesting revision
   */
  async requestQuoteRevision(quoteId: string, ownerId: string, revisionReason: string) {
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


    return data;
  },
};
