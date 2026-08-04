// ============================================================================
// SUPABASE EDGE FUNCTION: get-vendor-payment-status
// ============================================================================
// Returns the status of a vendor payment without exposing gateway secrets.
// Used by the client to poll after the PayFast return URL redirect.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get payment_id from query param (GET) or body (POST) ────────────
    let paymentId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      paymentId = url.searchParams.get('payment_id');
    } else {
      const body = await req.json();
      paymentId = body.payment_id;
    }

    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'Missing payment_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch once (include role ids for auth; omit gateway secrets) ─────
    const { data: payment, error: fetchError } = await supabase
      .from('vendor_payments')
      .select(
        `
        id, tenant_id, vendor_id, owner_id,
        total_amount, platform_fee, platform_fee_percent, vendor_payout,
        payout_fee, payment_status, payout_status, dispute_status, paid_at,
        receipt_url,
        created_at, updated_at,
        invoice:invoice_id(invoice_number, status, payer_role, line_items, subtotal, vat_amount)
      `
      )
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pmt = payment as any;

    const isParty =
      pmt.tenant_id === user.id || pmt.vendor_id === user.id || pmt.owner_id === user.id;

    if (!isParty) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('dev_admin')
        .eq('id', user.id)
        .single();

      if (!profile || !(profile as any).dev_admin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Return sanitised response (NO gateway secrets!) ──────────────────
    const invoice = pmt.invoice as any;

    return new Response(
      JSON.stringify({
        payment_id: pmt.id,
        payment_status: pmt.payment_status,
        payout_status: pmt.payout_status,
        dispute_status: pmt.dispute_status,
        paid_at: pmt.paid_at,
        total_amount: pmt.total_amount,
        platform_fee: pmt.platform_fee,
        vendor_payout: pmt.vendor_payout,
        receipt_url: pmt.receipt_url || null,
        invoice_number: invoice?.invoice_number || '',
        invoice_status: invoice?.status || '',
        created_at: pmt.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ get-vendor-payment-status error:', error);
    return new Response(JSON.stringify({ error: 'Internal error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
