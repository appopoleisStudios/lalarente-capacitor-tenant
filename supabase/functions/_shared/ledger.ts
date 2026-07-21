// ============================================================================
// SHARED: Vendor payment ledger helper
// ============================================================================
// Provides a function to write entries to the vendor_payment_ledger table.
// Import in any Edge Function that needs to record financial events.
//
// Usage:
//   import { writeLedgerEntry } from '../_shared/ledger.ts';
//   const { error } = await writeLedgerEntry(supabase, paymentId, 'payout_sent', -900, -900,
//     'Manual EFT payout', userId, 'REF123');
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Write an entry to the vendor_payment_ledger journal.
 *
 * Returns `{ error }` — the caller decides how to handle failures.
 * For critical money-movement entries (e.g. payout_sent), callers should
 * fail when error is truthy. For non-critical entries, the caller may
 * choose to log and continue.
 */
export async function writeLedgerEntry(
  supabase: ReturnType<typeof createClient>,
  vendorPaymentId: string,
  entryType: string,
  amount: number,
  runningBalance: number,
  description: string,
  createdBy: string | null = null,
  referenceId: string | null = null
): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('vendor_payment_ledger').insert({
      vendor_payment_id: vendorPaymentId,
      entry_type: entryType,
      amount,
      running_balance: runningBalance,
      description,
      created_by: createdBy,
      reference_id: referenceId,
    } as any);

    if (error) {
      console.error(`❌ Ledger write failed for ${vendorPaymentId} (${entryType}):`, error);
      return { error: new Error(error.message) };
    }

    return { error: null };
  } catch (err: any) {
    console.error(`⚠️ Ledger write threw for ${vendorPaymentId} (${entryType}):`, err);
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
