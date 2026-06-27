// Supabase Edge Function: Payment Gateway
// Handles PayFast signature generation and Yoco checkout creation
// with secrets stored server-side only (never in the client APK).
//
// Deploy: npx supabase functions deploy payment-gateway
// Secrets: PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE,
//           YOCO_SECRET_KEY, YOCO_SANDBOX

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Secret helpers (server-side only ─ NOT in any client bundle) ──────────

function getPayFastSecrets() {
  return {
    merchantId: Deno.env.get('PAYFAST_MERCHANT_ID')?.trim() || '',
    merchantKey: Deno.env.get('PAYFAST_MERCHANT_KEY')?.trim() || '',
    passphrase: Deno.env.get('PAYFAST_PASSPHRASE')?.trim() || '',
    sandbox: Deno.env.get('PAYFAST_SANDBOX') === 'true',
  };
}

function getYocoSecrets() {
  return {
    secretKey: Deno.env.get('YOCO_SECRET_KEY')?.trim() || '',
    sandbox: Deno.env.get('YOCO_SANDBOX') === 'true',
  };
}

// ── MD5 via crypto-js (esm.sh — same approach as @supabase/supabase-js) ──

function md5Hex(input: string): string {
  return CryptoJS.MD5(input).toString();
}

// ── PayFast signature ────────────────────────────────────────────────────

function generatePayFastSignature(
  params: Record<string, string>,
  passphrase: string,
): string {
  const sorted = Object.entries(params)
    .filter(([key]) => key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const stringToHash = passphrase
    ? `${sorted}&passphrase=${encodeURIComponent(passphrase)}`
    : sorted;

  return md5Hex(stringToHash);
}

// ── Generate PayFast redirect URL ────────────────────────────────────────

async function generatePayFastUrl(body: Record<string, unknown>): Promise<Response> {
  const secrets = getPayFastSecrets();
  if (!secrets.merchantId || !secrets.passphrase) {
    console.error('payment-gateway: PayFast secrets not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Payment gateway not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 },
    );
  }

  const baseUrl = secrets.sandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';

  const params: Record<string, string> = {
    merchant_id: secrets.merchantId,
    merchant_key: secrets.merchantKey,
    return_url: String(body.returnUrl || ''),
    cancel_url: String(body.cancelUrl || ''),
    notify_url: String(body.notifyUrl || ''),
    m_payment_id: String(body.paymentId || ''),
    amount: Number(body.amount).toFixed(2),
    item_name: String(body.itemName || 'Payment'),
    item_description: String(body.itemDescription || ''),
    email_address: String(body.buyerEmail || ''),
    name_first: String(body.buyerFirstName || ''),
    name_last: String(body.buyerLastName || ''),
  };

  const signature = generatePayFastSignature(params, secrets.passphrase);
  params.signature = signature;

  const query = new URLSearchParams(params).toString();
  return new Response(
    JSON.stringify({ success: true, redirectUrl: `${baseUrl}?${query}` }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  );
}

// ── Create Yoco checkout ─────────────────────────────────────────────────

async function createYocoCheckout(body: Record<string, unknown>): Promise<Response> {
  const secrets = getYocoSecrets();
  if (!secrets.secretKey) {
    console.error('payment-gateway: Yoco secret key not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Payment gateway not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 },
    );
  }

  const apiUrl = secrets.sandbox
    ? 'https://sandbox.yoco.com/api/checkouts'
    : 'https://payments.yoco.com/api/checkouts';

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secrets.secretKey}`,
      },
      body: JSON.stringify({
        amount: Math.round(Number(body.amount) * 100),
        currency: 'ZAR',
        metadata: { payment_id: String(body.paymentId || '') },
        successUrl: String(body.returnUrl || ''),
        cancelUrl: String(body.cancelUrl || ''),
        failureUrl: String(body.cancelUrl || ''),
      }),
    });

    const data = await res.json();

    if (res.ok && data.redirectUrl) {
      return new Response(
        JSON.stringify({ success: true, redirectUrl: data.redirectUrl, transactionId: data.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: data.message || 'Failed to create checkout' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    console.error('payment-gateway: Yoco API error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Payment gateway error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
    );
  }
}

// ── Verify PayFast webhook ────────────────────────────────────────────────

async function verifyWebhook(body: Record<string, unknown>): Promise<Response> {
  const secrets = getPayFastSecrets();
  if (!secrets.passphrase) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Passphrase not configured' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 503 },
    );
  }

  const payload = body.payload as Record<string, string> | undefined;
  const signature = String(body.signature || '');

  if (!payload || !signature) {
    return new Response(
      JSON.stringify({ valid: false, error: 'Missing payload or signature' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }

  const expected = generatePayFastSignature(payload, secrets.passphrase);
  return new Response(
    JSON.stringify({ valid: expected === signature }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
  );
}

// ── Request handler ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate via user JWT (same pattern as lala-ai-chat)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.slice('Bearer '.length);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json() as Record<string, unknown>;
    const action = String(body.action || '');

    switch (action) {
      case 'generate-payfast-url':
        return await generatePayFastUrl(body);
      case 'create-yoco-checkout':
        return await createYocoCheckout(body);
      case 'verify-payfast-webhook':
        return await verifyWebhook(body);
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}. Valid: generate-payfast-url, create-yoco-checkout, verify-payfast-webhook` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    }
  } catch (err) {
    console.error('payment-gateway error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
