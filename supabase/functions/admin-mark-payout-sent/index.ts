// ============================================================================
// SUPABASE EDGE FUNCTION: admin-mark-payout-sent
// ============================================================================
// Admin-only function to mark a vendor payout as sent after completing a
// manual EFT or other off-platform payout. Records the bank reference number
// and writes the payout_sent ledger entry.
//
// POST /admin-mark-payout-sent
//   Body: { payment_id: string, reference: string }
//   Auth: Requires admin role or dev_admin flag
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { verifyAdmin } from '../_shared/admin.ts';
import { writeLedgerEntry } from '../_shared/ledger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Send notification ────────────────────────────────────────────────────

async function sendPayoutNotification(
  supabase: ReturnType<typeof createClient>,
  vendorPayment: any,
  reference: string
): Promise<void> {
  try {
    const amountFormatted = `R ${(parseFloat(vendorPayment.vendor_payout) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

    if (vendorPayment.vendor_id) {
      await supabase.from('notifications').insert({
        user_id: vendorPayment.vendor_id,
        type: 'vendor_payout_sent',
        title: 'Payout Sent',
        body: `Your payout of ${amountFormatted} has been sent. Reference: ${reference}. It may take 1-3 business days to reflect in your account.`,
        data: { vendor_payment_id: vendorPayment.id, payout_reference: reference },
      } as any);
    }

    if (vendorPayment.owner_id) {
      await supabase.from('notifications').insert({
        user_id: vendorPayment.owner_id,
        type: 'vendor_payout_sent',
        title: 'Vendor Payout Completed',
        body: `Payout of ${amountFormatted} has been sent to the vendor.`,
        data: { vendor_payment_id: vendorPayment.id },
      } as any);
    }
  } catch (err) {
    console.error(`⚠️ Failed to send payout notification:`, err);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization') || '';

    // Verify admin
    const { user, error: authError } = await verifyAdmin(supabase, authHeader);
    if (authError) return authError;

    // Parse body
    const body = await req.json();
    const { payment_id, reference } = body;

    if (!payment_id) {
      return new Response(JSON.stringify({ error: 'Missing required field: payment_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!reference || typeof reference !== 'string' || reference.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required field: reference (bank EFT reference)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the vendor payment to verify it exists and is in a processable state
    const { data: vp, error: fetchError } = await supabase
      .from('vendor_payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (fetchError || !vp) {
      return new Response(JSON.stringify({ error: 'Vendor payment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vendorPayment = vp as any;

    // Validate current payout_status allows marking as sent
    const allowedStatuses = ['processing', 'pending'];
    if (!allowedStatuses.includes(vendorPayment.payout_status)) {
      return new Response(
        JSON.stringify({
          error: `Payout status is '${vendorPayment.payout_status}'. Only 'processing' or 'pending' payouts can be marked as sent.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure payment is completed (money received)
    if (vendorPayment.payment_status !== 'completed') {
      return new Response(
        JSON.stringify({ error: `Payment status is '${vendorPayment.payment_status}'. Only completed payments can have payouts marked as sent.` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    // Atomically update payout to sent (using status guard to prevent races)
    const { data: updated, error: updateError } = await supabase
      .from('vendor_payments')
      .update({
        payout_status: 'sent',
        payout_reference: reference.trim(),
        payout_completed_at: now,
        updated_at: now,
      } as any)
      .eq('id', payment_id)
      .in('payout_status', allowedStatuses)  // Guard: only if still processable
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to mark payout as sent:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update payout status' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Write ledger entries ─────────────────────────────────────────
    const payoutAmount = -Math.abs(parseFloat(vendorPayment.vendor_payout || 0));
    const payoutFee = -Math.abs(parseFloat(vendorPayment.payout_fee || 0));

    // Payout sent (negative = outflow from LaLarente to vendor)
    await writeLedgerEntry(
      supabase, payment_id, 'payout_sent',
      payoutAmount,
      payoutAmount,  // Simple running: first entry
      `Manual EFT payout to vendor`,
      user.id,
      reference.trim()
    );

    // Payout fee if applicable
    if (vendorPayment.payout_fee && parseFloat(vendorPayment.payout_fee) > 0) {
      await writeLedgerEntry(
        supabase, payment_id, 'payout_fee',
        payoutFee,
        payoutAmount + payoutFee,  // Running balance after fee
        `Payout fee charged`,
        user.id
      );
    }

    // Send notification to vendor
    await sendPayoutNotification(supabase, vendorPayment, reference.trim());

    console.log(`✅ Payout ${payment_id} marked as sent with reference: ${reference.trim()}`);

    return new Response(
      JSON.stringify({
        success: true,
        payment_id,
        payout_status: 'sent',
        payout_reference: reference.trim(),
        payout_completed_at: now,
        vendor_payout: parseFloat(vendorPayment.vendor_payout),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ admin-mark-payout-sent error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
