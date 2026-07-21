/**
 * Purchase Order Actions API
 * PO status updates and actions
 */

import { supabase } from '@/lib/supabase';
import { notificationsApi } from '@/src/features/notifications/api/notificationsApi';
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

  // Fire-and-forget notification to vendor — vendor_id is looked up via service_contracts
  findVendorByPO(poId).then(vendorId => {
    if (vendorId) {
      notificationsApi.sendNotification({
        user_id: vendorId,
        type: 'maintenance_updated',
        data: { customTitle: 'New Purchase Order', customBody: 'A new purchase order has been sent to you.', newStatus: 'PO sent' },
      }).catch(e => console.error('Failed to send PO notification:', e));
    }
  }).catch(e => console.error('Failed to find vendor for PO notification:', e));
  
  return data as PurchaseOrder;
}

/** Look up the vendor_id assigned to a PO via the maintenance request */
async function findVendorByPO(poId: string): Promise<string | null> {
  try {
    const { data: po } = await (supabase.from('purchase_orders') as any)
      .select('contract_id')
      .eq('id', poId)
      .single();
    if (!po?.contract_id) return null;
    const { data: contract } = await supabase
      .from('service_contracts')
      .select('vendor_id')
      .eq('id', po.contract_id)
      .single();
    return (contract as any)?.vendor_id || null;
  } catch {
    return null;
  }
}

/**
 * Verify a vendor is assigned to this PO via the contract relationship
 */
async function verifyVendorAssignment(poId: string, vendorId: string): Promise<void> {
  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select('contract_id')
    .eq('id', poId)
    .maybeSingle<{ contract_id: string }>();

  if (error) throw error;
  if (!po) throw new Error('Purchase Order not found');

  const { contract_id: contractId } = po;
  if (!contractId) throw new Error('PO has no contract reference');

  const { data: contract, error: contractError } = await supabase
    .from('service_contracts')
    .select('vendor_id')
    .eq('id', contractId)
    .single<{ vendor_id: string }>();

  if (contractError) throw new Error('Could not verify vendor assignment');
  if (!contract || contract.vendor_id !== vendorId) {
    throw new Error('You are not authorized to act on this purchase order');
  }
}

/**
 * Accept PO (Vendor action)
 * 
 * @param poId - The purchase order ID
 * @param vendorId - The vendor's user ID
 * @returns Updated purchase order
 */
export async function acceptPO(poId: string, vendorId: string): Promise<PurchaseOrder> {
  await verifyVendorAssignment(poId, vendorId);
  const po = await updatePOStatus(poId, 'accepted');

  // Notify the owner that PO was accepted
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('owner_id')
    .eq('po_id', poId)
    .maybeSingle();

  if (request && (request as any).owner_id) {
    notificationsApi.sendNotification({
      user_id: (request as any).owner_id,
      type: 'maintenance_updated',
      data: { customTitle: 'PO Accepted by Vendor', customBody: 'The vendor has accepted the purchase order.', newStatus: 'accepted' },
    }).catch(e => console.error('Failed to send PO accepted notification:', e));
  }

  return po;
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
  await verifyVendorAssignment(poId, vendorId);
  
  // Persist rejection reason first — throw on failure so status is NOT updated
  const { error: reasonError } = await (supabase
    .from('purchase_orders') as any)
    .update({
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', poId);

  if (reasonError) {
    console.error('Failed to store rejection reason:', reasonError);
    throw new Error('Failed to record rejection reason — PO status unchanged');
  }

  const po = await updatePOStatus(poId, 'rejected');

  // Notify the owner that PO was rejected
  const { data: request } = await supabase
    .from('maintenance_requests')
    .select('owner_id')
    .eq('po_id', poId)
    .maybeSingle();

  if (request && (request as any).owner_id) {
    notificationsApi.sendNotification({
      user_id: (request as any).owner_id,
      type: 'maintenance_updated',
      data: { customTitle: 'PO Rejected by Vendor', customBody: 'The vendor has rejected the purchase order.', newStatus: 'rejected', rejectionReason: reason },
    }).catch(e => console.error('Failed to send PO rejected notification:', e));
  }

  return po;
}

