/* eslint-disable */ // Deno edge function — URL imports are not resolvable by ESLint
// ============================================================================
// SUPABASE EDGE FUNCTION: Reconcile Stuck Payments
// ============================================================================
// Plane #62 — Stuck payment reconciliation.
// Every 15 minutes. Finds vendor_payments stuck in 'processing' for longer
// than 15 minutes (no ITN arrived) and reconciles them:
//   1. Queries the PayFast Query API for the real status (when a query token
//      is configured in env).
//   2. Resolves the row to the gateway's authoritative status.
//   3. Falls back to alerting the owner when the gateway can't be queried.
//
// Cron Schedule: */15 * * * * (every 15 minutes)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const QUERY_API = 'https://api.payfast.co.za/process/query';

async function notify(supabase, userId, title, body, data, type = 'payment_failed') {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data: data || {},
    });
  } catch (err) {
    console.error(`⚠️ Failed to notify ${userId}:`, err); // non-fatal
  }
}

/**
 * Write an entry to the vendor_payment_ledger journal.
 * Mirrors payment-webhook's writeVendorLedgerEntry() so reconcile's completion
 * side effects are byte-identical to a real ITN (a late ITN skips these once
 * the row is completed — they must exist before that).
 */
async function writeLedgerEntry(
  supabase,
  vendorPaymentId,
  entryType,
  amount,
  runningBalance,
  description
) {
  try {
    await supabase.from('vendor_payment_ledger').insert({
      vendor_payment_id: vendorPaymentId,
      entry_type: entryType,
      amount,
      running_balance: runningBalance,
      description,
    });
  } catch (err) {
    console.error(`⚠️ Failed to write ledger entry for ${vendorPaymentId}:`, err); // non-fatal
  }
}

/**
 * Query PayFast for the authoritative status of a payment.
 * Docs: https://developers.payfast.co.za/docs#query_api
 * Requires PAYFAST_MERCHANT_ID + PAYFAST_QUERY_TOKEN env vars.
 * Returns the gateway record ({ payment_status, pf_payment_id, fee }) or null
 * when the gateway can't be queried (no token / HTTP error / not found).
 */
async function queryPayFast(paymentId, amount) {
  const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID')?.trim();
  const queryToken = Deno.env.get('PAYFAST_QUERY_TOKEN')?.trim();
  if (!merchantId || !queryToken) {
    console.log('ℹ️ PAYFAST_QUERY_TOKEN not configured — falling back to admin alert');
    return null;
  }

  // Query API requires m_payment_id AND amount to look up a payment. The amount
  // must match the original exactly — always 2 decimals (e.g. 1500.00), never
  // raw float stringification (1500 or 1500.5 would not match).
  const body = new URLSearchParams({
    m_payment_id: paymentId,
    amount: Number(amount).toFixed(2),
  });
  const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY')?.trim() || '';

  const res = await fetch(`${QUERY_API}/${merchantId}/${queryToken}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'merchant-id': merchantId,
      'merchant-key': merchantKey,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    console.warn(`⚠️ PayFast query failed (HTTP ${res.status}): ${await res.text()}`);
    return null;
  }
  const data = await res.json();
  // Query API returns { data: { response: [ { m_payment_id, payment_status, ... } ] } }
  // — an ARRAY of records, not an object keyed by payment id.
  const records = data?.data?.response;
  const record = Array.isArray(records)
    ? records.find((r) => r?.m_payment_id === paymentId) || records[0]
    : null;
  if (!record) {
    console.warn(`⚠️ PayFast query returned no record for ${paymentId}`);
    return null;
  }
  return {
    status: record.payment_status,
    pf_payment_id: record.pf_payment_id || null,
    fee: record.fee != null ? Number(record.fee) : 0,
  };
}

/**
 * Map gateway status → vendor_payments.payment_status.
 * PENDING intentionally returns null: the payment is still in flight at the
 * gateway, so the row must STAY in 'processing' (never downgrade to 'pending'
 * — that would resurrect the checkout UI for a live payment). The cron keeps
 * polling it and resolves when the gateway finalizes.
 */
function mapGatewayStatus(status) {
  const s = (status || '').toUpperCase();
  if (s === 'COMPLETE' || s === 'COMPLETED') return 'completed';
  if (s === 'FAILED') return 'failed';
  if (s === 'CANCELLED') return 'cancelled';
  return null; // PENDING / unknown — keep in processing, keep polling
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing env vars');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const nowIso = new Date().toISOString();
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    console.log('🔁 Reconcile stuck payments triggered');

    // Payments stuck in 'processing' — updated more than 15 minutes ago.
    const { data: stuck, error: stuckErr } = await supabase
      .from('vendor_payments')
      .select(
        'id, tenant_id, owner_id, vendor_id, invoice_id, total_amount, platform_fee, platform_fee_percent, gateway_response, created_at, updated_at'
      )
      .eq('payment_status', 'processing')
      .lt('updated_at', staleBefore)
      .limit(100);

    if (stuckErr) throw stuckErr;

    let reconciled = 0;
    let alerted = 0;

    for (const pay of stuck || []) {
      // Still attempt the gateway query every run (so a later-configured
      // PAYFAST_QUERY_TOKEN can auto-resolve); only the ALERT path is guarded.
      const gateway = await queryPayFast(pay.id, pay.total_amount);

      if (!gateway) {
        // Can't query the gateway — alert the owner ONCE for manual
        // reconciliation (prevents 15-min notification spam).
        if (pay.gateway_response?.reconciliation_alerted_at) {
          console.log(`ℹ️ Already alerted for ${pay.id} — skipping duplicate alert`);
          continue;
        }
        const { error: alertErr } = await supabase
          .from('vendor_payments')
          .update({
            gateway_response: {
              ...(pay.gateway_response || {}),
              reconciliation_alerted_at: nowIso,
            },
            updated_at: nowIso,
          })
          .eq('id', pay.id)
          .eq('payment_status', 'processing');

        if (alertErr) {
          console.error(`❌ Failed to mark alert on ${pay.id}:`, alertErr);
          continue;
        }
        alerted++;
        await notify(
          supabase,
          pay.owner_id,
          'Stuck Payment Needs Review',
          `A payment has been stuck in processing for over 15 minutes. Please review invoice ${pay.invoice_id}.`,
          { vendor_payment_id: pay.id, invoice_id: pay.invoice_id, stuck: true },
          'payment_failed'
        );
        continue;
      }

      const mapped = mapGatewayStatus(gateway.status);
      if (!mapped) {
        // Gateway queried OK but the payment is still PENDING (or unknown) —
        // in flight at the gateway, so keep the row in 'processing' and keep
        // polling. No alert, no status change. (Blocker #2: never downgrade a
        // stuck 'processing' row back to 'pending'.)
        console.log(`ℹ️ ${pay.id} still ${gateway.status} at gateway — staying in processing`);
        continue;
      }

      // Gateway has an authoritative answer — resolve the row (status-guarded).
      const update = {
        payment_status: mapped,
        gateway_response: {
          ...(pay.gateway_response || {}),
          reconciled: true,
          reconciled_at: nowIso,
          gateway_query_status: gateway.status,
          reason: `Reconciled from gateway query: ${gateway.status}`,
        },
        updated_at: nowIso,
      };
      if (gateway.pf_payment_id) update.gateway_transaction_id = gateway.pf_payment_id;
      if (mapped === 'completed') update.paid_at = nowIso;

      const { error: updateErr } = await supabase
        .from('vendor_payments')
        .update(update)
        .eq('id', pay.id)
        .eq('payment_status', 'processing'); // status guard

      if (updateErr) {
        console.error(`❌ Failed to reconcile ${pay.id}:`, updateErr);
        continue;
      }
      reconciled++;

      if (mapped === 'completed') {
        // ── Mirror the webhook's completion side effects EXACTLY. The webhook's
        // idempotency guard skips already-completed payments, so a late real ITN
        // would NOT re-run invoice/ledger writes — they must happen here.
        //
        // 1) Invoice → paid (status-guarded, with payment_reference).
        const { error: invoiceErr } = await supabase
          .from('maintenance_invoices')
          .update({
            status: 'paid',
            paid_at: nowIso,
            payment_reference: gateway.pf_payment_id || null,
          })
          .eq('id', pay.invoice_id)
          .eq('status', 'approved');
        if (invoiceErr) {
          console.error(`⚠️ Failed to mark invoice ${pay.invoice_id} paid:`, invoiceErr);
        }

        // 2) Ledger journal — same 3 entries as the webhook, same running
        //    balances. Without these the ledger would be permanently missing
        //    the money-in event for this payment.
        const total = Number(pay.total_amount) || 0;
        const platformFee = Number(pay.platform_fee) || 0;
        const gatewayFee = Number(gateway.fee) || 0;
        const runningAfterFee = total - platformFee;
        const runningAfterGateway = runningAfterFee - gatewayFee;

        await writeLedgerEntry(
          supabase,
          pay.id,
          'payment_received',
          total,
          total,
          'PayFast payment received (reconciled)'
        );
        await writeLedgerEntry(
          supabase,
          pay.id,
          'platform_fee',
          -platformFee,
          runningAfterFee,
          `Platform fee (${pay.platform_fee_percent}%)`
        );
        await writeLedgerEntry(
          supabase,
          pay.id,
          'gateway_fee',
          -gatewayFee,
          runningAfterGateway,
          'PayFast transaction fee (reconciled)'
        );

        // 3) Notifications — vendor / owner / tenant, same types as the webhook.
        const amountFormatted = `R ${total.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
        await notify(
          supabase,
          pay.vendor_id,
          'Payment Received for Maintenance Job',
          `Payment of ${amountFormatted} received. Payout will be processed according to your schedule.`,
          { vendor_payment_id: pay.id },
          'vendor_payment_received'
        );
        await notify(
          supabase,
          pay.owner_id,
          'Vendor Payment Completed',
          `Payment of ${amountFormatted} has been completed for maintenance job.`,
          { vendor_payment_id: pay.id },
          'vendor_payment_completed'
        );
        await notify(
          supabase,
          pay.tenant_id,
          'Payment Successful',
          `Your payment of ${amountFormatted} has been processed successfully.`,
          { vendor_payment_id: pay.id },
          'payment_confirmed'
        );
      }
    }

    console.log(`✅ Reconciled ${reconciled} payments, alerted admin for ${alerted}`);
    return new Response(
      JSON.stringify({ success: true, reconciled, alerted_admin: alerted, timestamp: nowIso }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('❌ reconcile-stuck-payments error:', error);
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
//    npx supabase functions deploy reconcile-stuck-payments
// 2. Set env secret when available:
//    npx supabase secrets set PAYFAST_QUERY_TOKEN=<token> PAYFAST_MERCHANT_ID=<id> PAYFAST_MERCHANT_KEY=<key>
//    (Without PAYFAST_QUERY_TOKEN the function alerts the owner instead.)
// 3. Schedule every 15 min via pg_cron:
//    SELECT cron.schedule(
//      'reconcile-stuck-payments',
//      '*/15 * * * *',
//      $$SELECT net.http_post(
//        url := 'https://[project-ref].supabase.co/functions/v1/reconcile-stuck-payments',
//        headers := jsonb_build_object(
//          'Authorization', 'Bearer [service-role-key]',
//          'Content-Type', 'application/json'
//        )
//      )$$
//    );
// ============================================================================
