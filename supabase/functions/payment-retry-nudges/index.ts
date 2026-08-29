/* eslint-disable */ // Deno edge function — URL imports are not resolvable by ESLint
// ============================================================================
// SUPABASE EDGE FUNCTION: Payment Retry Nudges
// ============================================================================
// Plane #62 — Retry nudges + auto-cancel.
// Daily. For FAILED vendor payments, nudges the tenant to retry at 24h, 48h and
// 72h after failure (idempotent — tracked in gateway_response.retry_nudges[]).
// Auto-cancels PENDING payments older than 7 days (stale abandoned checkout).
//
// Cron Schedule: 0 9 * * * (daily 09:00) — or every hour if preferred.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function notify(supabase, userId, title, body, data) {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'payment_failed',
      title,
      body,
      data: data || {},
    });
  } catch (err) {
    console.error(`⚠️ Failed to notify ${userId}:`, err); // non-fatal
  }
}

/** Return the list of nudge buckets (in hours) that are due for this payment. */
function dueNudges(sentNudges, failedAt) {
  const sent = new Set(sentNudges || []);
  const ageHrs = (Date.now() - new Date(failedAt).getTime()) / HOUR;
  const due = [];
  for (const bucket of [24, 48, 72]) {
    if (ageHrs >= bucket && !sent.has(bucket)) due.push(bucket);
  }
  return due;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing env vars');
    const cronToken = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
    if (cronToken.length !== supabaseServiceKey.length) {
      return new Response(JSON.stringify({ error: 'Unauthorized: service-role access required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    let cronDiff = 0;
    for (let i = 0; i < cronToken.length; i++) {
      cronDiff |= cronToken.charCodeAt(i) ^ supabaseServiceKey.charCodeAt(i);
    }
    if (cronDiff !== 0) {
      return new Response(JSON.stringify({ error: 'Unauthorized: service-role access required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const nowIso = new Date().toISOString();
    console.log('🔔 Payment retry nudges triggered');

    // ── 1. Retry nudges for FAILED payments (24h / 48h / 72h) ────────────
    const { data: failed, error: failedErr } = await supabase
      .from('vendor_payments')
      .select('id, tenant_id, vendor_id, total_amount, invoice_id, updated_at, gateway_response')
      .eq('payment_status', 'failed')
      .limit(200);

    if (failedErr) throw failedErr;

    let nudges = 0;
    for (const pay of failed || []) {
      // Anchor the buckets to the FAILURE time, NOT updated_at: migration 047
      // installs trg_vendor_payments_updated_at, which stamps updated_at = NOW()
      // on every write — so reading it directly would push the 48h/72h buckets
      // out by each nudge write (drift). Freeze failed_at into gateway_response
      // on first write so the anchor is stable across runs. The webhook doesn't
      // set failed_at, so the first sighting's updated_at (≈ failure time, the
      // last writer before this cron) becomes the frozen anchor.
      const gw = { ...(pay.gateway_response || {}) };
      const failedAt = gw.failed_at || pay.updated_at;
      if (!failedAt) continue;

      const sentNudges = Array.isArray(gw.retry_nudges) ? gw.retry_nudges : [];
      const due = dueNudges(sentNudges, failedAt);
      if (due.length === 0) continue;

      const amount = `R ${(pay.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
      await notify(
        supabase,
        pay.tenant_id,
        'Payment Failed — Retry',
        `Your payment of ${amount} failed. Please retry when convenient.`,
        { vendor_payment_id: pay.id, invoice_id: pay.invoice_id }
      );
      await notify(
        supabase,
        pay.vendor_id,
        'Payment Needs Retry',
        `A payment of ${amount} for your job failed. The tenant has been reminded.`,
        { vendor_payment_id: pay.id, invoice_id: pay.invoice_id }
      );

      // Idempotency: persist the buckets we just sent and freeze the anchor.
      if (!gw.failed_at) gw.failed_at = failedAt;
      gw.retry_nudges = [...new Set([...sentNudges, ...due])];
      await supabase.from('vendor_payments').update({ gateway_response: gw }).eq('id', pay.id);
      nudges += due.length;
    }

    // ── 2. Auto-cancel PENDING payments older than 7 days ────────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * DAY).toISOString();
    const { data: stalePending, error: pendingErr } = await supabase
      .from('vendor_payments')
      .select('id, tenant_id, total_amount, invoice_id, gateway_response')
      .eq('payment_status', 'pending')
      .lt('created_at', sevenDaysAgo)
      .limit(100);

    if (pendingErr) throw pendingErr;

    let autoCancelled = 0;
    for (const pay of stalePending || []) {
      const { error: cancelErr } = await supabase
        .from('vendor_payments')
        .update({
          payment_status: 'cancelled',
          gateway_response: {
            ...(pay.gateway_response || {}),
            auto_cancelled: true,
            auto_cancelled_at: nowIso,
            reason:
              'Payment session auto-cancelled after 7 days — tenant did not complete checkout',
          },
          updated_at: nowIso,
        })
        .eq('id', pay.id)
        .eq('payment_status', 'pending'); // status guard

      if (cancelErr) {
        console.error(`❌ Failed to auto-cancel ${pay.id}:`, cancelErr);
        continue;
      }
      autoCancelled++;
      await notify(
        supabase,
        pay.tenant_id,
        'Payment Expired',
        'An unpaid invoice session expired after 7 days. You can start a new payment anytime.',
        { vendor_payment_id: pay.id, invoice_id: pay.invoice_id }
      );
    }

    console.log(`✅ Sent ${nudges} retry nudges, auto-cancelled ${autoCancelled} stale payments`);
    return new Response(
      JSON.stringify({
        success: true,
        retry_nudges_sent: nudges,
        auto_cancelled: autoCancelled,
        timestamp: nowIso,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('❌ payment-retry-nudges error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// ============================================================================
// DEPLOYMENT / CRON
// ============================================================================
// 1. Deploy:
//    npx supabase functions deploy payment-retry-nudges
// 2. Schedule daily via pg_cron (Supabase Dashboard → Database → Cron Jobs):
//    SELECT cron.schedule(
//      'payment-retry-nudges',
//      '0 9 * * *',
//      $$SELECT net.http_post(
//        url := 'https://[project-ref].supabase.co/functions/v1/payment-retry-nudges',
//        headers := jsonb_build_object(
//          'Authorization', 'Bearer [service-role-key]',
//          'Content-Type', 'application/json'
//        )
//      )$$
//    );
// ============================================================================
