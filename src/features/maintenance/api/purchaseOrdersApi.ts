import { supabase } from '@/src/lib/supabase';

/**
 * Service Contract interface for joined data
 */
export interface ServiceContract {
  id: string;
  vendor_id: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_number?: string | null;
}

/**
 * Purchase Order interface
 * 
 * @property contract_id - NULLABLE. Only populated for long-term contracted vendors.
 *                         For ad-hoc/short-term maintenance, this will be null.
 */
export interface PurchaseOrder {
  id: string;
  /**
   * Optional reference to a service contract.
   * - NULL for ad-hoc vendors (short-term maintenance)
   * - Populated for long-term contracted vendors
   */
  contract_id: string | null;
  po_number: string;
  currency: string;
  subtotal?: number;
  vat_amount?: number;
  platform_fee_amount?: number;
  total_amount?: number;
  status: string;
  pdf_url?: string;
  revision_number?: number;
  revision_reason?: string;
  scheduled_start_date?: string;
  scheduled_start_time?: string;
  work_instructions?: string;
  sent_to_vendor_at?: string;
  sent_by?: string;
  created_at: string;
  updated_at: string;
  // Joined data (optional)
  contract?: ServiceContract;
}

export interface PORevision {
  id: string;
  po_id: string;
  revision_number: number;
  subtotal: number;
  vat_amount: number;
  platform_fee_amount: number;
  total_amount: number;
  revised_by: string;
  revision_reason?: string;
  created_at: string;
}

export interface POUpdateData {
  subtotal?: number;
  vat_amount?: number;
  platform_fee_amount?: number;
  total_amount?: number;
  revision_reason?: string;
}

export const purchaseOrdersApi = {
  /**
   * Fetch PO by its ID (primary method)
   * Includes optional contract join when contract_id is present
   * 
   * @param poId - The purchase order ID
   * @returns Purchase order with optional contract details
   */
  async getPOById(poId: string): Promise<PurchaseOrder> {
    const { data, error} = await supabase
      .from('purchase_orders')
      .select(`
        *,
        contract:service_contracts(
          id,
          vendor_id,
          status,
          start_date,
          end_date
        )
      `)
      .eq('id', poId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching PO by ID:', error);
      console.error('PO ID:', poId);
      throw error;
    }
    
    if (!data) {
      throw new Error('Purchase Order not found');
    }
    
    return data as PurchaseOrder;
  },

  /**
   * Fetch PO by maintenance request ID
   * Uses the direct po_id reference from maintenance_requests table
   * 
   * @param requestId - The maintenance request ID
   * @returns Purchase order if found, null if request has no PO yet
   */
  async getPOByRequestId(requestId: string): Promise<PurchaseOrder | null> {
    // First get the request to find po_id
    const { data: request, error: reqError } = await supabase
      .from('maintenance_requests')
      .select('po_id')
      .eq('id', requestId)
      .single();

    if (reqError) throw reqError;
    const poId = (request as any)?.po_id;
    if (!poId) return null;

    // Then fetch the PO with contract details
    return purchaseOrdersApi.getPOById(poId);
  },

  /**
   * @deprecated Use getPOById or getPOByRequestId instead.
   * This method assumes all POs have a contract_id, which is incorrect.
   * Only kept for backward compatibility.
   * 
   * Get PO by contract ID
   */
  async getPOByContract(contractId: string): Promise<PurchaseOrder | null> {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data as PurchaseOrder | null;
  },

  // Get PO with full details (including quote and vendor)
  async getPOWithDetails(poId: string) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .select(`
        *,
        contract:contracts!contract_id(
          id,
          quote:quotes(
            id,
            total_amount,
            vendor:profiles!vendor_id(
              id,
              full_name,
              phone,
              email,
              business_name
            )
          )
        )
      `)
      .eq('id', poId)
      .single();

    if (error) throw error;
    return data;
  },

  // Update PO status
  async updatePOStatus(poId: string, status: string) {
    console.log('🔄 Updating PO status:', { poId, status });
    
    const { data, error } = await (supabase
      .from('purchase_orders') as any)
      .update({ 
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating PO status:', error);
      throw error;
    }

    console.log('✅ PO status updated:', data);

    // If PO is accepted, update the maintenance request status to 'assigned'
    if (status === 'accepted') {
      console.log('🔍 Looking for maintenance request with po_id:', poId);
      
      // Find the maintenance request that references this PO
      const { data: request, error: reqError } = await supabase
        .from('maintenance_requests')
        .select('id, status, selected_vendor_id, selected_quote_id')
        .eq('po_id', poId)
        .maybeSingle();

      if (reqError) {
        console.error('❌ Error finding maintenance request:', reqError);
      } else if (request) {
        console.log('✅ Found maintenance request:', request);
        
        // Get the vendor_id from the selected quote
        let vendorId = (request as any).selected_vendor_id;
        
        if (!vendorId && (request as any).selected_quote_id) {
          console.log('🔍 Getting vendor_id from quote:', (request as any).selected_quote_id);
          const { data: quote } = await supabase
            .from('quotes')
            .select('vendor_id')
            .eq('id', (request as any).selected_quote_id)
            .single();
          
          vendorId = (quote as any)?.vendor_id;
          console.log('✅ Found vendor_id from quote:', vendorId);
        }
        
        // Update maintenance request status to 'assigned' and set selected_vendor_id
        const updateData: any = {
          status: 'assigned',
          mms_status: 'po_issued',
        };
        
        // Set selected_vendor_id if we found it
        if (vendorId) {
          updateData.selected_vendor_id = vendorId;
        }
        
        const { data: updatedRequest, error: updateError } = await (supabase
          .from('maintenance_requests') as any)
          .update(updateData)
          .eq('id', (request as any).id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating maintenance request:', updateError);
        } else {
          console.log('✅ Maintenance request updated to assigned:', updatedRequest);
        }
      } else {
        console.warn('⚠️ No maintenance request found with po_id:', poId);
      }
    }

    return data as PurchaseOrder;
  },

  /**
   * Update PO with revision tracking (owner only)
   * Creates a revision record before updating the PO
   * 
   * @param poId - The PO ID to update
   * @param updateData - The fields to update
   * @param userId - The owner making the update
   * @returns Updated PO
   */
  async updatePO(poId: string, updateData: POUpdateData, userId: string): Promise<PurchaseOrder> {
    // First, get the current PO to create revision
    const currentPO = await purchaseOrdersApi.getPOById(poId);
    
    const currentRevision = currentPO.revision_number || 1;
    const newRevision = currentRevision + 1;

    // Create revision record
    const { error: revisionError } = await (supabase
      .from('po_revisions') as any)
      .insert({
        po_id: poId,
        revision_number: currentRevision,
        subtotal: currentPO.subtotal,
        vat_amount: currentPO.vat_amount,
        platform_fee_amount: currentPO.platform_fee_amount,
        total_amount: currentPO.total_amount,
        revised_by: userId,
        revision_reason: updateData.revision_reason,
      });

    if (revisionError) throw revisionError;

    // Update the PO with new data
    const { data, error } = await (supabase
      .from('purchase_orders') as any)
      .update({
        ...updateData,
        revision_number: newRevision,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .select()
      .single();

    if (error) throw error;
    return data as PurchaseOrder;
  },

  /**
   * Get revision history for a PO
   * 
   * @param poId - The PO ID
   * @returns Array of revisions ordered by revision number
   */
  async getPORevisions(poId: string): Promise<PORevision[]> {
    const { data, error } = await supabase
      .from('po_revisions')
      .select('*')
      .eq('po_id', poId)
      .order('revision_number', { ascending: true });

    if (error) throw error;
    return data as PORevision[];
  },

  /**
   * Get complete audit trail for dispute resolution
   * Returns both quote and PO revision history
   * 
   * @param requestId - The maintenance request ID
   * @returns Complete history for transparency
   */
  async getDisputeAuditTrail(requestId: string) {
    // Get the request with quote and PO info
    const { data: request, error: reqError } = await supabase
      .from('maintenance_requests')
      .select('id, selected_quote_id, po_id')
      .eq('id', requestId)
      .single();

    if (reqError) throw reqError;

    const requestData = request as any;
    const auditTrail: any = {
      request_id: requestId,
      quote_history: [],
      po_history: [],
    };

    // Get quote revisions if quote exists
    if (requestData.selected_quote_id) {
      const { data: quoteRevisions } = await supabase
        .from('quote_revisions')
        .select('*')
        .eq('quote_id', requestData.selected_quote_id)
        .order('revision_number', { ascending: true });

      auditTrail.quote_history = quoteRevisions || [];
    }

    // Get PO revisions if PO exists
    if (requestData.po_id) {
      const { data: poRevisions } = await supabase
        .from('po_revisions')
        .select('*')
        .eq('po_id', requestData.po_id)
        .order('revision_number', { ascending: true });

      auditTrail.po_history = poRevisions || [];
    }

    return auditTrail;
  },

  /**
   * Send PO to vendor with scheduling information
   * Updates PO with scheduled start date/time, work instructions, and sent timestamp
   * 
   * @param poId - The PO ID to send
   * @param scheduledStartDate - When the work should start (ISO date string)
   * @param scheduledStartTime - Time of day for work start (HH:MM format)
   * @param workInstructions - Optional instructions for the vendor
   * @param sentBy - User ID of the owner sending the PO
   * @returns Updated PO
   */
  async sendPOToVendor(
    poId: string,
    scheduledStartDate: string,
    scheduledStartTime: string,
    workInstructions: string | null,
    sentBy: string
  ): Promise<PurchaseOrder> {
    const { data, error } = await (supabase
      .from('purchase_orders') as any)
      .update({
        scheduled_start_date: scheduledStartDate,
        scheduled_start_time: scheduledStartTime,
        work_instructions: workInstructions,
        sent_to_vendor_at: new Date().toISOString(),
        sent_by: sentBy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', poId)
      .select()
      .single();

    if (error) throw error;
    
    // TODO: Send notification to vendor
    // This would typically trigger a notification through your notification system
    
    return data as PurchaseOrder;
  },
};
