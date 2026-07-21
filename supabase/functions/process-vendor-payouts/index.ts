// ============================================================================
// SUPABASE EDGE FUNCTION: process-vendor-payouts
// ============================================================================
// Admin-triggered / cron-ready function that processes pending vendor payouts.
//
// GET  → Returns list of pending payouts grouped by vendor with status-split totals
// POST → Initiates batch processing (marks pending payouts as processing for manual EFT)
//
// For v1, the payout adapter uses manual_eft — admins review pending payouts,
// process the bank EFTs manually, then mark as sent via admin-mark-payout-sent.
//
// No ledger writes happen here — the only money-path ledger entries (payout_sent,
// payout_fee) are written in admin-mark-payout-sent when the actual transfer occurs.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { verifyAdmin } from '../_shared/admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Mapped payout shape ──────────────────────────────────────────────────

interface MappedPayout {
  id: string;
  invoice_number: string | null;
  maintenance_title: string | null;
  vendor_name: string;
  vendor_id: string;
  total_amount: number;
  platform_fee: number;
  payout_fee: number;
  vendor_payout: number;
  payout_status: string;
  payout_method: string;
  payout_reference: string | null;
  payout_initiated_at: string | null;
  payout_completed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

function mapPayoutRow(r: any): MappedPayout {
  return {
    id: r.id,
    invoice_number: r.invoice?.invoice_number || null,
    maintenance_title: r.maintenance_request?.title || null,
    vendor_name: r.vendor?.business_name || r.vendor?.full_name || 'Unknown',
    vendor_id: r.vendor_id,
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
  };
}

// ─── GET: List pending payouts ────────────────────────────────────────────

async function handleGetPayouts(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  // Fetch completed payments with any non-sent payout status
  const { data: pendingPayouts, error } = await supabase
    .from('vendor_payments')
    .select(`
      id, vendor_id, total_amount, platform_fee, gateway_fee, payout_fee, vendor_payout,
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

  // Map every row to the flat PayoutRow shape first
  const mapped: MappedPayout[] = rows.map(mapPayoutRow);

  // Status-split counts
  const pendingCount = mapped.filter(p => p.payout_status === 'pending').length;
  const processingCount = mapped.filter(p => p.payout_status === 'processing').length;
  const failedCount = mapped.filter(p => p.payout_status === 'failed').length;

  // True-pending sum for "Amount Owed" (only pending, not processing/failed)
  const amountOwed = mapped
    .filter(p => p.payout_status === 'pending')
    .reduce((s, p) => s + p.vendor_payout, 0);

  // Total across all statuses (for complete picture)
  const totalAmount = mapped.reduce((s, p) => s + p.vendor_payout, 0);

  // Group the mapped rows by vendor_id
  const byVendor = new Map<string, {
    vendor_id: string;
    business_name: string | null;
    full_name: string;
    email: string | null;
    payouts: MappedPayout[];
    total_owed: number;
    count: number;
  }>();

  for (const payout of mapped) {
    const vid = payout.vendor_id;
    if (!byVendor.has(vid)) {
      // Find the first row with this vendor for name/email
      const rawRow = rows.find((r: any) => r.vendor_id === vid);
      byVendor.set(vid, {
        vendor_id: vid,
        business_name: rawRow?.vendor?.business_name || null,
        full_name: rawRow?.vendor?.full_name || 'Unknown',
        email: rawRow?.vendor?.email || null,
        payouts: [],
        total_owed: 0,
        count: 0,
      });
    }
    const group = byVendor.get(vid)!;
    group.payouts.push(payout);
    group.total_owed += payout.vendor_payout;
    group.count += 1;
  }

  return new Response(
    JSON.stringify({
      // Status-split counts
      pending_count: pendingCount,
      processing_count: processingCount,
      failed_count: failedCount,
      total_count: rows.length,
      // Amount owed = only true pending
      amount_owed: Math.round(amountOwed * 100) / 100,
      // Total across all statuses (for complete picture)
      total_amount: Math.round(totalAmount * 100) / 100,
      by_vendor: Array.from(byVendor.values()).map(g => ({
        ...g,
        total_owed: Math.round(g.total_owed * 100) / 100,
      })),
      payouts: mapped,
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

  // Build query for pending payouts only
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

  // Track which requested payout_ids were not found (already non-pending or don't exist)
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
        // Mark as processing — no ledger write here. The only money-path
        // ledger entries (payout_sent, payout_fee) are written in
        // admin-mark-payout-sent when the actual bank transfer occurs.
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
