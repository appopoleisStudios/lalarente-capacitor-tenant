// ============================================================================
// SUPABASE EDGE FUNCTION: create-vendor-payment-checkout
// ============================================================================
// Creates a pending vendor_payments record and returns PayFast hosted
// payment page fields. The client renders a hidden HTML form that
// POSTs to PayFast to complete the transaction.
//
// PayFast docs: https://developers.payfast.co.za/docs
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
//   PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY (from Supabase secrets)
//   PAYFAST_PASSPHRASE (from Supabase secrets)
//   PAYFAST_SANDBOX (set to 'true' for sandbox testing)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import md5 from 'npm:blueimp-md5@2.19.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  invoice_id: string;
  return_url: string;
  cancel_url: string;
  idempotency_key?: string;
}

// ─── PayFast signature generation (custom / hosted checkout) ──────────────
// Docs: https://developers.payfast.co.za/docs#step-2-signature
//
// CRITICAL: Use INSERTION order of the attribute set — NOT alphabetical sort.
// Alphabetical ordering is the *API* signature format and will 400 the hosted
// /eng/process page with "Generated signature does not match submitted signature".
// Live probe (merchant 10051626): insertion-order → HTTP 302; alpha-sort → 400.
//
// PHP urlencode parity vs encodeURIComponent:
//   Space → +, hex digits UPPERCASE, and PHP's urlencode() ALSO encodes the
//   chars encodeURIComponent leaves unescaped (! ~ * ' ( )). Without patching
//   those, a signed value containing any of them (e.g. a `*` in an item name)
//   would hash differently from PayFast's PHP server → signature mismatch.
//
// ⚠️ KEEP IN SYNC: this function is duplicated byte-for-byte in
//   supabase/functions/payment-webhook/index.ts and in
//   scripts/probe-payfast-signature.mjs + scripts/simulate-vendor-payment-itn.mjs.
//   A desync breaks ITN signature verification silently — edit all four.
function phpUrlEncode(str: string): string {
  return encodeURIComponent(String(str).trim())
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase())
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/~/g, '%7E')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function generatePayFastSignature(params: Record<string, string>, passphrase: string): string {
  // Match PayFast's PHP sample: foreach ($data as $key => $val) in array order.
  let pfOutput = '';
  for (const [key, value] of Object.entries(params)) {
    if (key === 'signature') continue;
    if (value === '' || value == null) continue;
    pfOutput += `${key}=${phpUrlEncode(value)}&`;
  }
  let stringToHash = pfOutput.slice(0, -1); // drop trailing &
  if (passphrase) {
    stringToHash += `&passphrase=${phpUrlEncode(passphrase)}`;
  }
  return md5(stringToHash);
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
    // ── Auth: extract caller identity ───────────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and extract user ID
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

    // ── Parse request ────────────────────────────────────────────────────
    const body: CheckoutRequest = await req.json();
    const { invoice_id, return_url, cancel_url, idempotency_key } = body;

    if (!invoice_id || !return_url || !cancel_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: invoice_id, return_url, cancel_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Fetch invoice ────────────────────────────────────────────────────
    const { data: invoice, error: invoiceError } = await supabase
      .from('maintenance_invoices')
      .select(
        `
        id, invoice_number, status, payer_role, total_amount, subtotal, vat_amount,
        maintenance_request_id, vendor_id, owner_id, line_items,
        maintenance_requests!inner(tenant_id, title),
        vendor:profiles!vendor_id(full_name, email, business_name)
      `
      )
      .eq('id', invoice_id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Validate ─────────────────────────────────────────────────────────
    const inv = invoice as any;

    // Payer must match invoice.payer_role. Tenant-billed invoices stay
    // tenant-only; owner-billed invoices are paid by the job owner.
    if (inv.payer_role === 'tenant') {
      if (inv.maintenance_requests.tenant_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Only the tenant for this job can pay.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (inv.payer_role === 'owner') {
      if (inv.owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Only the owner billed for this invoice can pay.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      return new Response(JSON.stringify({ error: 'This invoice has no valid payer.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Invoice must allow payment
    if (inv.status === 'paid') {
      return new Response(JSON.stringify({ error: 'This invoice is already paid.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (inv.status !== 'approved') {
      return new Response(
        JSON.stringify({
          error: `Invoice status is '${inv.status}'. Only approved invoices can be paid.`,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── PayFast config: read early + fail loudly if not configured ───────
    // Must NOT create a pending vendor_payments row (or return a checkout
    // URL) when the gateway is misconfigured — otherwise the tenant lands on
    // a broken PayFast page with no explanation. Sandbox credentials live in
    // Supabase secrets (PAYFAST_MERCHANT_ID/KEY/PASSPHRASE, PAYFAST_SANDBOX).
    const sandbox = Deno.env.get('PAYFAST_SANDBOX')?.trim() !== 'false';
    const merchantId = Deno.env.get('PAYFAST_MERCHANT_ID')?.trim() || '';
    const merchantKey = Deno.env.get('PAYFAST_MERCHANT_KEY')?.trim() || '';
    const passphrase = Deno.env.get('PAYFAST_PASSPHRASE')?.trim() || '';
    const notifyUrl = `${supabaseUrl}/functions/v1/payment-webhook`;

    if (!merchantId || !merchantKey) {
      console.error('❌ create-vendor-payment-checkout: PayFast merchant credentials missing');
      return new Response(
        JSON.stringify({
          error: 'Payment gateway is not configured. Please try again later.',
          message: 'PayFast merchant credentials are missing. Please try again later.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Check idempotency ────────────────────────────────────────────────
    if (idempotency_key) {
      const { data: existing } = await supabase
        .from('vendor_payments')
        .select('id, payment_status')
        .eq('idempotency_key', idempotency_key)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            payment_id: existing.id,
            status: existing.payment_status,
            message: 'Payment checkout already exists for this idempotency key',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Block if invoice already has a completed payment ─────────────────
    const { data: completedPay } = await supabase
      .from('vendor_payments')
      .select('id, payment_status')
      .eq('invoice_id', invoice_id)
      .eq('payment_status', 'completed')
      .maybeSingle();

    if (completedPay) {
      return new Response(
        JSON.stringify({
          payment_id: completedPay.id,
          status: 'completed',
          error: 'This invoice already has a completed payment.',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Check no in-flight payment already exists for this invoice ───────
    const { data: inFlight } = await supabase
      .from('vendor_payments')
      .select('id, payment_status, created_at')
      .eq('invoice_id', invoice_id)
      .in('payment_status', ['pending', 'processing'])
      .maybeSingle();

    if (inFlight) {
      // If the pending row is older than 30 minutes, expire it and allow retry
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const createdAt = new Date(inFlight.created_at);

      if (createdAt < thirtyMinAgo) {
        // Expire the abandoned pending row
        const { error: expireError } = await supabase
          .from('vendor_payments')
          .update({
            payment_status: 'cancelled',
            gateway_response: {
              expired: true,
              expired_at: new Date().toISOString(),
              reason: 'Payment session expired — user did not complete within 30 minutes',
            },
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', inFlight.id);

        if (expireError) {
          console.error('⚠️ Failed to expire abandoned payment:', expireError);
          // Non-fatal — continue and let the user retry
        } else {
          console.log(
            `ℹ️ Expired abandoned payment ${inFlight.id} (created ${createdAt.toISOString()})`
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            payment_id: inFlight.id,
            status: inFlight.payment_status,
            message: 'A payment is already in progress for this invoice',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Calculate fees ───────────────────────────────────────────────────
    const totalAmount = parseFloat(inv.total_amount);
    const platformFeePercent = 10.0; // 10% platform fee
    const platformFee = Math.round(totalAmount * (platformFeePercent / 100) * 100) / 100;
    const payoutFee = 0; // Weekly payout is free (default)
    const vendorPayout = totalAmount - platformFee - payoutFee;

    // ── Create vendor_payments record ────────────────────────────────────
    const newPayment = {
      invoice_id: invoice_id,
      maintenance_request_id: inv.maintenance_request_id,
      tenant_id: inv.maintenance_requests.tenant_id,
      vendor_id: inv.vendor_id,
      owner_id: inv.owner_id,
      total_amount: totalAmount,
      platform_fee: platformFee,
      platform_fee_percent: platformFeePercent,
      gateway_fee: 0,
      payout_fee: payoutFee,
      vendor_payout: vendorPayout,
      payment_gateway: 'payfast',
      idempotency_key: idempotency_key || null,
      payment_status: 'pending',
      payout_status: 'pending',
      payout_method: 'manual_eft',
      dispute_status: 'none',
    };

    const { data: payment, error: createError } = await supabase
      .from('vendor_payments')
      .insert(newPayment)
      .select()
      .single();

    if (createError || !payment) {
      console.error('❌ Failed to create vendor payment:', createError);
      return new Response(JSON.stringify({ error: 'Failed to create payment record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paymentId = (payment as any).id;

    // ── Generate PayFast form fields ─────────────────────────────────────
    const vendorName =
      (inv.vendor as any)?.business_name || (inv.vendor as any)?.full_name || 'Service Provider';

    // Attribute order matches PayFast custom-integration docs / PHP sample
    // (merchant → buyer → transaction). Empty optionals omitted before signing.
    const fullName = (user.user_metadata?.full_name || '').trim();
    const nameFirst = fullName.split(/\s+/)[0] || '';
    const nameLast = fullName.split(/\s+/).slice(1).join(' ') || '';

    const payfastFields: Record<string, string> = {};
    const setField = (key: string, value: string) => {
      const v = (value ?? '').trim();
      if (v) payfastFields[key] = v;
    };
    setField('merchant_id', merchantId);
    setField('merchant_key', merchantKey);
    setField('return_url', return_url);
    setField('cancel_url', cancel_url);
    setField('notify_url', notifyUrl);
    setField('name_first', nameFirst);
    setField('name_last', nameLast);
    setField('email_address', user.email || '');
    setField('m_payment_id', paymentId);
    setField('amount', totalAmount.toFixed(2));
    setField('item_name', `Maintenance - ${vendorName}`);
    setField(
      'item_description',
      `Invoice ${inv.invoice_number}: Maintenance work by ${vendorName}`
    );

    const signature = generatePayFastSignature(payfastFields, passphrase);
    if (signature) {
      payfastFields.signature = signature;
    }

    const formAction = sandbox
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';

    // GET redirect for in-app WebView — same field order as the signature.
    // Prefer POST in WebView when possible; GET is accepted by sandbox/live.
    const queryString = Object.entries(payfastFields)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const payfastRedirectUrl = `${formAction}?${queryString}`;

    // ── Return checkout data ─────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        payment_id: paymentId,
        payfast_form_action: formAction,
        payfast_fields: payfastFields,
        payfast_redirect_url: payfastRedirectUrl,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
        breakdown: {
          total_amount: totalAmount,
          platform_fee: platformFee,
          vendor_payout: vendorPayout,
          platform_fee_percent: platformFeePercent,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ create-vendor-payment-checkout error:', error);
    return new Response(JSON.stringify({ error: 'Internal error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
