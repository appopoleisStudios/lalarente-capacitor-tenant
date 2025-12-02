/**
 * Purchase Order Revisions API
 * Track PO revision history
 */

import { supabase } from '@/src/lib/supabase';
import type { PORevision, PORevisionData } from '../types/po.types';

/**
 * Get revision history for a purchase order
 * 
 * @param poId - The purchase order ID
 * @returns Array of revisions ordered by revision number
 * 
 * @example
 * ```typescript
 * const revisions = await getPORevisions(poId);
 * ```
 */
export async function getPORevisions(poId: string): Promise<PORevision[]> {
  const { data, error } = await supabase
    .from('po_revisions')
    .select('*')
    .eq('po_id', poId)
    .order('revision_number', { ascending: true });

  if (error) throw error;
  return data as PORevision[];
}

/**
 * Create a PO revision record
 * This is typically called internally before updating a PO
 * 
 * @param poId - The purchase order ID
 * @param revisionData - The revision data
 * @param userId - The user making the revision
 * @returns Created revision record
 * 
 * @example
 * ```typescript
 * const revision = await createPORevision(poId, revisionData, userId);
 * ```
 */
export async function createPORevision(
  poId: string,
  revisionData: PORevisionData,
  userId: string
): Promise<PORevision> {
  const { data, error } = await (supabase
    .from('po_revisions') as any)
    .insert({
      po_id: poId,
      ...revisionData,
      revised_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as PORevision;
}
