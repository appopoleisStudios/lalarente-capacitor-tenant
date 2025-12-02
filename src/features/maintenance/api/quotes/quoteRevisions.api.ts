/**
 * Quote Revisions API
 * Track quote revision history
 */

import { supabase } from '@/src/lib/supabase';
import type { QuoteRevision, QuoteRevisionData } from '../types/quote.types';

/**
 * Get revision history for a quote
 * 
 * @param quoteId - The quote ID
 * @returns Array of revisions ordered by revision number
 * 
 * @example
 * ```typescript
 * const revisions = await getQuoteRevisions(quoteId);
 * ```
 */
export async function getQuoteRevisions(quoteId: string): Promise<QuoteRevision[]> {
  const { data, error } = await supabase
    .from('quote_revisions')
    .select('*')
    .eq('quote_id', quoteId)
    .order('revision_number', { ascending: true });

  if (error) throw error;
  return data as QuoteRevision[];
}

/**
 * Create a quote revision record
 * This is typically called internally before updating a quote
 * 
 * @param quoteId - The quote ID
 * @param revisionData - The revision data
 * @param userId - The user making the revision
 * @returns Created revision record
 * 
 * @example
 * ```typescript
 * const revision = await createQuoteRevision(quoteId, revisionData, userId);
 * ```
 */
export async function createQuoteRevision(
  quoteId: string,
  revisionData: QuoteRevisionData,
  userId: string
): Promise<QuoteRevision> {
  const { data, error } = await (supabase
    .from('quote_revisions') as any)
    .insert({
      quote_id: quoteId,
      ...revisionData,
      revised_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data as QuoteRevision;
}
