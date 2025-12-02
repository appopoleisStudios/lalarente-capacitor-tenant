/**
 * Vendor Maintenance API
 * Vendor-specific views of maintenance requests
 */

import { supabase } from '@/src/lib/supabase';
import type { MaintenanceRequest } from '../types/maintenance.types';
import type {
    JobStatusUpdate,
    QuoteSubmission,
    VendorMaintenanceFilters,
    VendorMaintenanceRequest,
} from '../types/vendor.types';

/**
 * Get available maintenance requests for a vendor
 * Returns requests where:
 * - visibility = 'public' (Open Market) - ALL vendors can see
 * - vendor has a quote_request (Invited)
 * - vendor is a dedicated vendor for the property
 * 
 * @param vendorId - The vendor's user ID
 * @param filters - Optional filters for status, category, quote status
 * @returns Array of maintenance requests accessible to the vendor
 */
export async function getAvailableRequests(
    vendorId: string,
    filters?: VendorMaintenanceFilters
): Promise<VendorMaintenanceRequest[]> {
    // Build the base query
    let query = supabase
        .from('maintenance_requests')
        .select(`
      *,
      property:properties(id, title, address, city, province),
      category:service_categories(id, name),
      owner:profiles!owner_id(id, full_name, email, phone),
      tenant:profiles!tenant_id(id, full_name, phone)
    `);

    // Apply status filter if provided
    if (filters?.status) {
        query = query.eq('status', filters.status);
    }

    // Apply category filter if provided
    if (filters?.category) {
        query = query.eq('category_id', filters.category);
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data: requests, error } = await query;

    if (error) throw error;

    if (!requests) return [];

    const typedRequests = requests as any[];

    // Get vendor's service categories
    const { data: vendorServices, error: servicesError } = await supabase
        .from('vendor_services')
        .select('category_id')
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

    if (servicesError) throw servicesError;

    const vendorCategoryIds = (vendorServices as any[])?.map((vs: any) => vs.category_id) || [];

    // Get vendor's quote requests
    const { data: quoteRequests, error: quoteRequestsError } = await supabase
        .from('vendor_quote_requests')
        .select('request_id, quote_id, status')
        .eq('vendor_id', vendorId);

    if (quoteRequestsError) throw quoteRequestsError;

    const quoteRequestMap = new Map(
        (quoteRequests as any[])?.map((qr: any) => [qr.request_id, qr]) || []
    );

    // Get vendor's quotes
    const { data: vendorQuotes, error: quotesError } = await supabase
        .from('quotes')
        .select('id, request_id, status, total_amount, created_at')
        .eq('vendor_id', vendorId);

    if (quotesError) throw quotesError;

    const quotesByRequest = new Map(
        (vendorQuotes as any[])?.map((q: any) => [q.request_id, q]) || []
    );

    // Get dedicated vendor relationships
    const { data: dedicatedVendorRels, error: dedicatedError } = await supabase
        .from('dedicated_vendors')
        .select('property_id, category_id')
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

    if (dedicatedError) throw dedicatedError;

    const typedDedicatedVendors = dedicatedVendorRels as any[];
    const dedicatedPropertyIds = new Set(
        typedDedicatedVendors?.map((dv: any) => dv.property_id) || []
    );

    // Filter requests based on access rules
    const accessibleRequests = typedRequests.filter(request => {
        // Check if vendor has a quote for this request
        const hasQuote = quotesByRequest.has(request.id);

        // Apply hasQuote filter if specified
        if (filters?.hasQuote !== undefined) {
            if (filters.hasQuote && !hasQuote) return false;
            if (!filters.hasQuote && hasQuote) return false;
        }

        // Rule 1: ALL public requests are visible to ALL vendors (Open Market)
        if (request.visibility === 'public') {
            return true;
        }

        // Rule 2: Invited requests (vendor has quote_request)
        if (request.visibility === 'invited') {
            if (quoteRequestMap.has(request.id)) {
                return true;
            }
        }

        // Rule 3: Dedicated vendor for property
        if (request.property_id && dedicatedPropertyIds.has(request.property_id)) {
            const dedicatedRel = typedDedicatedVendors?.find(
                (dv: any) => dv.property_id === request.property_id
            );
            if (!dedicatedRel?.category_id || dedicatedRel.category_id === request.category_id) {
                return true;
            }
        }

        // Rule 4: Vendor is selected for this request
        if (request.selected_vendor_id === vendorId) {
            return true;
        }

        return false;
    });

    // Enrich with vendor-specific data
    const enrichedRequests: VendorMaintenanceRequest[] = accessibleRequests.map(request => {
        const quote = quotesByRequest.get(request.id);
        const hasQuoteRequest = quoteRequestMap.has(request.id);

        // Check if vendor can quote
        const canQuote =
            hasQuoteRequest ||
            request.selected_vendor_id === vendorId ||
            (request.category_id && vendorCategoryIds.includes(request.category_id)) ||
            (request.property_id && dedicatedPropertyIds.has(request.property_id));

        return {
            ...request,
            my_quote: quote ? {
                id: quote.id,
                status: quote.status,
                total_amount: quote.total_amount,
                created_at: quote.created_at,
            } : undefined,
            has_quote_request: hasQuoteRequest,
            can_quote: canQuote,
        };
    });

    return enrichedRequests;
}

/**
 * Get full details of a maintenance request
 * Includes all related data and vendor-specific context
 * 
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID (for access check)
 * @returns Full maintenance request details
 */
export async function getRequestById(
    requestId: string,
    vendorId: string
): Promise<VendorMaintenanceRequest> {
    const { data: request, error } = await supabase
        .from('maintenance_requests')
        .select(`
      *,
      property:properties(id, title, address, city, province),
      category:service_categories(id, name),
      owner:profiles!owner_id(id, full_name, email, phone),
      tenant:profiles!tenant_id(id, full_name, phone)
    `)
        .eq('id', requestId)
        .single();

    if (error) throw error;

    const typedRequest = request as any;

    // Get vendor's quote for this request
    const { data: quote } = await supabase
        .from('quotes')
        .select('id, status, total_amount, created_at, revision_reason')
        .eq('request_id', requestId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

    const typedQuote = quote as any;

    // Check if vendor has a quote request
    const { data: quoteRequest } = await supabase
        .from('vendor_quote_requests')
        .select('id')
        .eq('request_id', requestId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

    // Get vendor's service categories
    const { data: vendorServices } = await supabase
        .from('vendor_services')
        .select('category_id')
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

    const vendorCategoryIds = (vendorServices as any[])?.map((vs: any) => vs.category_id) || [];

    // Check if vendor is a dedicated vendor for this property
    const { data: dedicatedVendor } = await supabase
        .from('dedicated_vendors')
        .select('id')
        .eq('vendor_id', vendorId)
        .eq('property_id', typedRequest.property_id)
        .eq('is_active', true)
        .maybeSingle();

    // Determine if vendor can quote
    const canQuote =
        !!quoteRequest ||
        typedRequest.selected_vendor_id === vendorId ||
        (typedRequest.category_id && vendorCategoryIds.includes(typedRequest.category_id)) ||
        !!dedicatedVendor;

    return {
        ...typedRequest,
        my_quote: typedQuote ? {
            id: typedQuote.id,
            status: typedQuote.status,
            total_amount: typedQuote.total_amount,
            created_at: typedQuote.created_at,
            revision_reason: typedQuote.revision_reason,
        } : undefined,
        has_quote_request: !!quoteRequest,
        can_quote: canQuote,
    };
}

/**
 * Get vendor's active jobs (requests where their quote was accepted)
 * 
 * @param vendorId - The vendor's user ID
 * @returns Array of active job requests
 */
export async function getMyJobs(vendorId: string): Promise<VendorMaintenanceRequest[]> {
    const { data: requests, error } = await supabase
        .from('maintenance_requests')
        .select(`
      *,
      property:properties(id, title, address, city, province),
      category:service_categories(id, name),
      owner:profiles!owner_id(id, full_name, email, phone),
      tenant:profiles!tenant_id(id, full_name, phone)
    `)
        .eq('selected_vendor_id', vendorId)
        .in('status', ['assigned', 'in_progress'])
        .order('created_at', { ascending: false });

    if (error) throw error;

    if (!requests) return [];

    const typedRequests = requests as any[];

    // Get vendor's quotes for these requests
    const requestIds = typedRequests.map((r: any) => r.id);
    const { data: quotes } = await supabase
        .from('quotes')
        .select('id, request_id, status, total_amount, created_at')
        .eq('vendor_id', vendorId)
        .in('request_id', requestIds);

    const typedQuotes = quotes as any[];

    const quotesByRequest = new Map(
        typedQuotes?.map((q: any) => [q.request_id, q]) || []
    );

    // Enrich with vendor-specific data
    const enrichedRequests: VendorMaintenanceRequest[] = typedRequests.map((request: any) => {
        const quote = quotesByRequest.get(request.id);

        return {
            ...request,
            my_quote: quote ? {
                id: quote.id,
                status: quote.status,
                total_amount: quote.total_amount,
                created_at: quote.created_at,
            } : undefined,
            can_quote: true,
        };
    });

    return enrichedRequests;
}

/**
 * Update job status (vendor action)
 * Allows vendor to start work or mark as completed
 * 
 * @param requestId - The maintenance request ID
 * @param vendorId - The vendor's user ID (for access check)
 * @param update - Status update data
 * @returns Updated maintenance request
 */
export async function updateJobStatus(
    requestId: string,
    vendorId: string,
    update: JobStatusUpdate
): Promise<MaintenanceRequest> {
    // Verify vendor is assigned to this request
    const { data: request } = await supabase
        .from('maintenance_requests')
        .select('selected_vendor_id, status, images')
        .eq('id', requestId)
        .single();

    const typedRequest = request as any;

    if (!typedRequest) {
        throw new Error('Request not found');
    }

    if (typedRequest.selected_vendor_id !== vendorId) {
        throw new Error('You are not assigned to this request');
    }

    // Prepare update data
    const updateData: any = {
        status: update.status,
    };

    // If marking as completed, add completion data
    if (update.status === 'completed') {
        updateData.completed_date = new Date().toISOString();

        if (update.completion_notes) {
            updateData.description = `${typedRequest.status}\n\nCompletion Notes: ${update.completion_notes}`;
        }

        // Handle completion photos
        if (update.completion_photos && update.completion_photos.length > 0) {
            const existingImages = (typedRequest.images as string[]) || [];
            updateData.images = [...existingImages, ...update.completion_photos];
        }
    }

    // Update the request
    const { data, error } = await (supabase
        .from('maintenance_requests') as any)
        .update(updateData)
        .eq('id', requestId)
        .select()
        .single();

    if (error) throw error;

    return data as MaintenanceRequest;
}

/**
 * Submit a quote for a maintenance request
 * Creates a quote and updates the vendor_quote_request status
 * 
 * @param vendorId - The vendor's user ID
 * @param quoteData - Quote submission data
 * @returns Created quote
 */
export async function submitQuote(
    vendorId: string,
    quoteData: QuoteSubmission
) {
    // Validate that vendor has access to this request
    const request = await getRequestById(quoteData.request_id, vendorId);

    if (!request.has_quote_request && request.visibility !== 'public') {
        throw new Error('You do not have permission to quote on this request');
    }

    // Check if vendor can quote (has matching category)
    if (!request.can_quote) {
        throw new Error('You do not have the required service category to quote on this request');
    }

    // Validate quote amounts
    if (quoteData.subtotal <= 0) {
        throw new Error('Subtotal must be greater than 0');
    }

    if (quoteData.total_amount <= 0) {
        throw new Error('Total amount must be greater than 0');
    }

    // Get owner and property info from request
    const ownerId = request.owner_id;
    const propertyId = request.property_id;

    // Create the quote
    const { data: quote, error: quoteError } = await (supabase
        .from('quotes') as any)
        .insert({
            vendor_id: vendorId,
            owner_id: ownerId,
            property_id: propertyId,
            request_id: quoteData.request_id,
            contract_id: quoteData.contract_id || null,
            status: 'submitted',
            subtotal: quoteData.subtotal,
            vat_amount: quoteData.vat_amount,
            discount_amount: quoteData.discount_amount || 0,
            total_amount: quoteData.total_amount,
            notes: quoteData.notes,
            revision_number: 1,
        })
        .select()
        .single();

    if (quoteError) throw quoteError;

    // Create quote line items if provided
    if (quoteData.line_items && quoteData.line_items.length > 0) {
        const lineItemsToInsert = quoteData.line_items.map(item => ({
            quote_id: quote.id,
            description: item.name,
            qty: item.quantity,
            unit_price: item.unit_price,
            unit: 'unit',
            tax_rate: 0.15,
        }));

        await (supabase
            .from('quote_lines') as any)
            .insert(lineItemsToInsert);
    }

    // Update vendor_quote_request if it exists
    if (request.has_quote_request) {
        await (supabase
            .from('vendor_quote_requests') as any)
            .update({
                status: 'responded',
                responded_at: new Date().toISOString(),
                quote_id: quote.id,
            })
            .eq('request_id', quoteData.request_id)
            .eq('vendor_id', vendorId);
    }

    // Update maintenance request status
    await (supabase
        .from('maintenance_requests') as any)
        .update({ mms_status: 'quoting' })
        .eq('id', quoteData.request_id)
        .eq('mms_status', 'vendor_routing');

    return quote;
}

/**
 * Decline a quote request
 * Updates the vendor_quote_request status to declined
 * 
 * @param vendorId - The vendor's user ID
 * @param requestId - The maintenance request ID
 * @param reason - Optional reason for declining
 */
export async function declineQuoteRequest(
    vendorId: string,
    requestId: string,
    reason?: string
) {
    // Verify vendor has a quote request for this
    const { data: quoteRequest, error: fetchError } = await supabase
        .from('vendor_quote_requests')
        .select('id, status')
        .eq('request_id', requestId)
        .eq('vendor_id', vendorId)
        .maybeSingle();

    if (fetchError) throw fetchError;

    const typedQuoteRequest = quoteRequest as any;

    if (!typedQuoteRequest) {
        throw new Error('No quote request found for this maintenance request');
    }

    if (typedQuoteRequest.status !== 'pending') {
        throw new Error('Quote request has already been responded to');
    }

    // Update the quote request status
    const { error: updateError } = await (supabase
        .from('vendor_quote_requests') as any)
        .update({
            status: 'declined',
            responded_at: new Date().toISOString(),
        })
        .eq('id', typedQuoteRequest.id);

    if (updateError) throw updateError;

    return { success: true, message: 'Quote request declined' };
}
