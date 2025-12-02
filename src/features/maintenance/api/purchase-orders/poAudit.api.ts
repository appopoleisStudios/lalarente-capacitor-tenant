/**
 * Purchase Order Audit API
 * Audit trail for dispute resolution
 */

import { supabase } from '@/src/lib/supabase';
import type { MaintenanceRequest } from '../types/maintenance.types';
import type { AuditTrail, PurchaseOrder } from '../types/po.types';
import type { Quote } from '../types/quote.types';

/**
 * Get complete audit trail for dispute resolution
 * Returns both quote and PO revision history
 * 
 * @param requestId - The maintenance request ID
 * @returns Complete history for transparency
 * 
 * @example
 * ```typescript
 * const audit = await getDisputeAuditTrail(requestId);
 * ```
 */
export async function getDisputeAuditTrail(requestId: string): Promise<AuditTrail> {
  // Get the request with quote and PO info
  const { data: request, error: reqError } = await supabase
    .from('maintenance_requests')
    .select('id, selected_quote_id, po_id')
    .eq('id', requestId)
    .single();

  if (reqError) throw reqError;

  const requestData = request as any;
  const auditTrail: AuditTrail = {
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
}

/**
 * Get complete history for a maintenance request
 * Includes request, quotes, PO, and all revisions
 * 
 * @param requestId - The maintenance request ID
 * @returns Complete history object
 * 
 * @example
 * ```typescript
 * const history = await getCompleteHistory(requestId);
 * ```
 */
export async function getCompleteHistory(requestId: string): Promise<{
  request: MaintenanceRequest;
  quotes: Quote[];
  po: PurchaseOrder | null;
  revisions: {
    quotes: any[];
    po: any[];
  };
}> {
  // Get the maintenance request
  const { data: request, error: requestError } = await supabase
    .from('maintenance_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (requestError) throw requestError;

  // Get all quotes for this request
  const { data: quotes } = await supabase
    .from('quotes')
    .select(`
      *,
      vendor:profiles!vendor_id(id, full_name, phone, email, avatar_url)
    `)
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });

  // Get PO if it exists
  let po: PurchaseOrder | null = null;
  if ((request as any).po_id) {
    const { data: poData } = await supabase
      .from('purchase_orders')
      .select('*')
      .eq('id', (request as any).po_id)
      .single();
    po = poData as PurchaseOrder;
  }

  // Get audit trail
  const auditTrail = await getDisputeAuditTrail(requestId);

  return {
    request: request as MaintenanceRequest,
    quotes: (quotes || []) as Quote[],
    po,
    revisions: {
      quotes: auditTrail.quote_history,
      po: auditTrail.po_history,
    },
  };
}
