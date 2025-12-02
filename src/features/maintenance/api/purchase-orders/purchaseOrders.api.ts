/**
 * Purchase Orders API
 * Core PO CRUD operations
 */

import { supabase } from '@/src/lib/supabase';
import type { POCreateData, POUpdateData, PurchaseOrder, PurchaseOrderWithDetails } from '../types/po.types';
import { createPORevision } from './poRevisions.api';

/**
 * Fetch PO by its ID (primary method)
 * Includes optional contract join when contract_id is present
 * 
 * @param poId - The purchase order ID
 * @returns Purchase order with optional contract details
 */
export async function getPOById(poId: string): Promise<PurchaseOrder> {
  const { data, error } = await supabase
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
    throw error;
  }
  
  if (!data) {
    throw new Error('Purchase Order not found');
  }
  
  return data as PurchaseOrder;
}

/**
 * Fetch PO by maintenance request ID
 * Uses the direct po_id reference from maintenance_requests table
 * 
 * @param requestId - The maintenance request ID
 * @returns Purchase order if found, null if request has no PO yet
 */
export async function getPOByRequestId(requestId: string): Promise<PurchaseOrder | null> {
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
  return getPOById(poId);
}

/**
 * Get PO with full details (including quote and vendor)
 * 
 * @param poId - The purchase order ID
 * @returns PO with detailed relations
 */
export async function getPOWithDetails(poId: string): Promise<PurchaseOrderWithDetails> {
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
  return data as PurchaseOrderWithDetails;
}

/**
 * Create a new purchase order
 * 
 * @param poData - PO creation data
 * @returns Created purchase order
 */
export async function createPO(poData: POCreateData): Promise<PurchaseOrder> {
  const { data, error } = await (supabase
    .from('purchase_orders') as any)
    .insert(poData)
    .select()
    .single();

  if (error) throw error;
  return data as PurchaseOrder;
}

/**
 * Update PO with revision tracking (owner only)
 * Creates a revision record before updating the PO
 * 
 * @param poId - The PO ID to update
 * @param updateData - The fields to update
 * @param userId - The owner making the update
 * @returns Updated PO
 */
export async function updatePO(
  poId: string,
  updateData: POUpdateData,
  userId: string
): Promise<PurchaseOrder> {
  // First, get the current PO to create revision
  const currentPO = await getPOById(poId);
  
  const currentRevision = currentPO.revision_number || 1;
  const newRevision = currentRevision + 1;

  // Create revision record
  await createPORevision(
    poId,
    {
      revision_number: currentRevision,
      subtotal: currentPO.subtotal || 0,
      vat_amount: currentPO.vat_amount || 0,
      platform_fee_amount: currentPO.platform_fee_amount || 0,
      total_amount: currentPO.total_amount || 0,
      revision_reason: updateData.revision_reason,
    },
    userId
  );

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
}
