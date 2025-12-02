/**
 * Purchase Order Actions API
 * PO status updates and actions
 */

import { supabase } from '@/src/lib/supabase';
import type { POStatus, PurchaseOrder } from '../types/po.types';

/**
 * Update PO status
 * 
 * @param poId - The purchase order ID
 * @param status - The new status
 * @returns Updated purchase order
 */
export async function updatePOStatus(poId: string, status: POStatus): Promise<PurchaseOrder> {
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

  console.log('✅ PO status updated');

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
        const { data: quote } = await supabase
          .from('quotes')
          .select('vendor_id')
          .eq('id', (request as any).selected_quote_id)
          .single();
        
        vendorId = (quote as any)?.vendor_id;
      }
      
      // Update maintenance request status to 'assigned' and set selected_vendor_id
      const updateData: any = {
        status: 'assigned',
        mms_status: 'po_issued',
      };
      
      if (vendorId) {
        updateData.selected_vendor_id = vendorId;
      }
      
      const { error: updateError } = await (supabase
        .from('maintenance_requests') as any)
        .update(updateData)
        .eq('id', (request as any).id);

      if (updateError) {
        console.error('❌ Error updating maintenance request:', updateError);
      } else {
        console.log('✅ Maintenance request updated to assigned');
      }
    }
  }

  return data as PurchaseOrder;
}

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
export async function sendPOToVendor(
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
  
  return data as PurchaseOrder;
}

/**
 * Accept PO (Vendor action)
 * 
 * @param poId - The purchase order ID
 * @param vendorId - The vendor's user ID
 * @returns Updated purchase order
 */
export async function acceptPO(poId: string, vendorId: string): Promise<PurchaseOrder> {
  // TODO: Verify vendor is assigned to this PO
  return updatePOStatus(poId, 'accepted');
}

/**
 * Reject PO (Vendor action)
 * 
 * @param poId - The purchase order ID
 * @param vendorId - The vendor's user ID
 * @param reason - Reason for rejection
 * @returns Updated purchase order
 */
export async function rejectPO(
  poId: string,
  vendorId: string,
  reason: string
): Promise<PurchaseOrder> {
  // TODO: Verify vendor is assigned to this PO
  // TODO: Store rejection reason
  return updatePOStatus(poId, 'rejected');
}
