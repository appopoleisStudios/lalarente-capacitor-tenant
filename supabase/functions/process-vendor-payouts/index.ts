// ============================================================================
// SUPABASE EDGE FUNCTION: process-vendor-payouts
// ============================================================================
// Admin-triggered / cron-ready function that processes pending vendor payouts.
//
// GET  → Returns list of pending payouts grouped by vendor with totals
// POST → Processes all pending payouts (manual_eft: marks as sent with ref)
//
// For v1, the payout adapter uses manual_eft — admins review pending payouts,
// process the bank EFTs manually, then mark as sent via admin-mark-payout-sent.
// This function can be extended for automated PayFast payouts in a later phase.
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

// ─── GET: List pending payouts ────────────────────────────────────────────

async function handleGetPayouts(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  // Fetch all completed payments with pending payouts
  const { data: pendingPayouts, error } = await supabase
    .from('vendor_payments')
    .select(`
      id, total_amount, platform_fee, gateway_fee, payout_fee, vendor_payout,
      payment_status, payout_status, payout_method, payout_reference,
      payout_initiated_at, payout_completed_at, created_at, paid_at,
      invoice:invoice_id(invoice_number),
      maintenance_request:maintenance_request_id(title),
      vendor:vendor_id(full_name, business_name, email),
      tenant:tenant_id(full_name, email)
    `)
    .eq('payment_status', 'completed')
    .in('payout_status', ['pending', 'processing', 'failed'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Failed to fetch pending payouts:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch payouts' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rows = (pendingPayouts || []) as any[];

  // Group by vendor for summary
  const byVendor = new Map<string, {
    vendor_id: string;
    business_name: string | null;
    full_name: string;
    email: string | null;
    payouts: typeof rows;
    total_pending: number;
    count: number;
  }>();

  for (const row of rows) {
    const vid = row.vendor_id;
    if (!byVendor.has(vid)) {
      byVendor.set(vid, {
        vendor_id: vid,
        business_name: row.vendor?.business_name || null,
        full_name: row.vendor?.full_name || 'Unknown',
        email: row.vendor?.email || null,
        payouts: [],
        total_pending: 0,
        count: 0,
      });
    }
    const group = byVendor.get(vid)!;
    group.payouts.push(row);
    group.total_pending += parseFloat(row.vendor_payout || 0);
    group.count += 1;
  }

  const totalPendingAmount = rows.reduce(
    (sum, r) => sum + parseFloat(r.vendor_payout || 0), 0
  );

  return new Response(
    JSON.stringify({
      total_pending_count: rows.length,
      total_pending_amount: Math.round(totalPendingAmount * 100) / 100,
      by_vendor: Array.from(byVendor.values()).map(g => ({
        ...g,
        total_pending: Math.round(g.total_pending * 100) / 100,
      })),
      payouts: rows.map(r => ({
        id: r.id,
        invoice_number: r.invoice?.invoice_number || null,
        maintenance_title: r.maintenance_request?.title || null,
        vendor_name: r.vendor?.business_name || r.vendor?.full_name || 'Unknown',
        total_amount: parseFloat(r.total_amount),
        platform_fee: parseFloat(r.platform_fee),
        payout_fee: parseFloat(r.payout_fee),
        vendor_payout: parseFloat(r.vendor_payout),
        payout_status: r.payout_status,
        payout_method: r.payout_method,
        payout_reference: r.payout_reference,
        payout_initiated_at: r.payout_initiated_at,
        payout_completed_at: r.payout_completed_at,
        paid_at: r.paid_at,
        created_at: r.created_at,
      })),
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ─── POST: Process pending payouts ────────────────────────────────────────

async function handleProcessPayouts(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: { payout_ids?: string[]; method?: string }
): Promise<Response> {
  const { payout_ids, method } = body;
  const payoutMethod = method || 'manual_eft';

  // Build query builder for pending payouts
  let query = supabase
    .from('vendor_payments')
    .select('id, total_amount, platform_fee, payout_fee, vendor_payout, payout_method, payout_status, vendor_id')
    .eq('payment_status', 'completed')
    .eq('payout_status', 'pending');

  if (payout_ids && payout_ids.length > 0) {
    query = query.in('id', payout_ids);
  }

  const { data: toProcess, error: fetchError } = await query;

  if (fetchError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch payouts' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const rows = (toProcess || []) as any[];

  // Track which requested IDs were not found (skipped because they don't
  // exist or have moved past 'pending' status since the list was loaded)
  const foundIds = new Set(rows.map((r: any) => r.id));
  const skippedIds = payout_ids && payout_ids.length > 0
    ? payout_ids.filter(id => !foundIds.has(id))
    : [];

  if (rows.length === 0) {
    const response: Record<string, any> = { message: 'No pending payouts to process', processed: 0 };
    if (skippedIds.length > 0) {
      response.skipped_count = skippedIds.length;
      response.skipped_ids = skippedIds;
    }
    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const now = new Date().toISOString();
  const processed: string[] = [];
  const errors: string[] = [];

  for (const payout of rows) {
    try {
      if (payoutMethod === 'manual_eft') {
        // Manual EFT: mark as processing — admin will later mark as sent
        // after performing the actual bank transfer
        const { error: updateError } = await supabase
          .from('vendor_payments')
          .update({
            payout_status: 'processing',
            payout_method: 'manual_eft',
            payout_initiated_at: now,
            updated_at: now,
          } as any)
          .eq('id', payout.id)
          .eq('payout_status', 'pending');  // Guard: only if still pending

        if (updateError) {
          errors.push(`Failed to update ${payout.id}: ${updateError.message}`);
        } else {
          processed.push(payout.id);

          // Write ledger entry for payout_sent (amount negative = outflow from LaLarente)
          // For manual_eft, we write the ledger when admin marks as sent,
          // but we log the initiation here
          await writeLedgerEntry(
            supabase,
            payout.id,
            'payout_fee',
            -Math.abs(parseFloat(payout.payout_fee || 0)),
            -Math.abs(parseFloat(payout.payout_fee || 0)),
            `Payout initiation fee (${payoutMethod})`,
            userId
          );
        }
      } else {
        errors.push(`Unsupported payout method: ${payoutMethod}`);
      }
    } catch (err: any) {
      errors.push(`Error processing ${payout.id}: ${err.message}`);
    }
  }

  const response: Record<string, any> = {
    processed_count: processed.length,
    error_count: errors.length,
    processed_ids: processed,
    errors: errors.length > 0 ? errors : undefined,
  };
  if (skippedIds.length > 0) {
    response.skipped_count = skippedIds.length;
    response.skipped_ids = skippedIds;
  }

  return new Response(
    JSON.stringify(response),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ─── Main handler ─────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization') || '';

    // Verify admin
    const { user, error: authError } = await verifyAdmin(supabase, authHeader);
    if (authError) return authError;

    if (req.method === 'GET') {
      return await handleGetPayouts(supabase, user.id);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      return await handleProcessPayouts(supabase, user.id, body);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ process-vendor-payouts error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
