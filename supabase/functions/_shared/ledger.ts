// ============================================================================
// SHARED: Vendor payment ledger helper
// ============================================================================
// Provides a single function to write entries to the vendor_payment_ledger
// table. Import in any Edge Function that needs to record financial events.
//
// Usage:
//   import { writeLedgerEntry } from '../_shared/ledger.ts';
//   await writeLedgerEntry(supabase, paymentId, 'payout_sent', -900, -900,
//     'Manual EFT payout', userId, 'REF123');
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Write an entry to the vendor_payment_ledger journal.
 * Non-critical failures are logged but not thrown — the caller won't fail
 * if the ledger write fails (the primary operation succeeds regardless).
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
): Promise<void> {
  try {
    await supabase.from('vendor_payment_ledger').insert({
      vendor_payment_id: vendorPaymentId,
      entry_type: entryType,
      amount,
      running_balance: runningBalance,
      description,
      created_by: createdBy,
      reference_id: referenceId,
    } as any);
  } catch (err) {
    console.error(`⚠️ Failed to write ledger entry for ${vendorPaymentId}:`, err);
  }
}
