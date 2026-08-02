#!/usr/bin/env node
/**
 * Verify the tenant vendor-payment happy path to COMPLETION (Plane #60).
 *
 * Deterministic replacement for the "complete payment on PayFast sandbox page"
 * step of the Maestro flow: Maestro cannot reliably fill PayFast's hosted
 * WebView form, so this script drives the REAL payment-webhook edge function
 * through a simulated signed COMPLETE ITN (same signature algorithm + php
 * urlencode parity as production) and asserts the vendor_payments record
 * reaches payment_status='completed' — exactly the state the app's result
 * screen polls for via get-vendor-payment-status.
 *
 * Steps:
 *   1. Login as the e2e tenant.
 *   2. Find the latest APPROVED tenant-payer invoice (or INVOICE_ID env
 *      override) — the same rows the tenant vendor-payments list shows.
 *   3. Call create-vendor-payment-checkout edge function → payment_id (creates
 *      the pending vendor_payments row, exactly as tapping "Pay via PayFast"
 *      does in the app).
 *   4. Simulate the signed PayFast COMPLETE ITN via
 *      simulate-vendor-payment-itn.mjs (amount must equal total_amount).
 *   5. Poll get-vendor-payment-status until 'completed' (like the app does).
 *
 * Usage:
 *   node scripts/verify-tenant-payment-completed.mjs
 *   INVOICE_ID=<uuid> node scripts/verify-tenant-payment-completed.mjs
 *
 * Env (optional overrides, defaults match .maestro/.env):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   TENANT_EMAIL, TENANT_PASSWORD
 *   PAYFAST_PASSPHRASE (or EXPO_PUBLIC_PAYFAST_PASSPHRASE from .env)
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env, maestroEnv } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY — set them in env or .env');
  process.exit(1);
}

const TENANT_EMAIL = env('TENANT_EMAIL') || env('E2E_TENANT_EMAIL') || maestroEnv('TENANT_EMAIL');
const TENANT_PASSWORD =
  env('TENANT_PASSWORD') || env('E2E_TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD');
if (!TENANT_EMAIL || !TENANT_PASSWORD) {
  console.error('❌ Missing TENANT_EMAIL / TENANT_PASSWORD — set them in env, .env, or .maestro/.env');
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVOICE_ID = process.env.INVOICE_ID || '';

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TENANT_EMAIL, password: TENANT_PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Login failed: ${body.error_description || res.status}`);
  }
  return res.json();
}

async function main() {
  // 1. Login as tenant
  const auth = await login();
  console.log('✅ Logged in as:', auth.user.email);
  const H = { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}` };

  // 2. Find the target invoice
  const lookup = UUID_RE.test(INVOICE_ID)
    ? `id=eq.${INVOICE_ID}`
    : 'payer_role=eq.tenant&status=eq.approved&order=created_at.desc&limit=1';
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=id,invoice_number,status,payer_role,total_amount,maintenance_request_id&${lookup}`,
    { headers: H }
  ).then((r) => r.json());

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No APPROVED tenant-payer invoice found — run scripts/seed-tenant-vendor-invoice.mjs first.');
  }
  const invoice = rows[0];
  const amount = Number(invoice.total_amount);
  console.log(`📄 Invoice ${invoice.invoice_number} (${invoice.id}) — R${amount}`);

  // 3. Create the checkout (creates the pending vendor_payments row)
  const returnUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=success`;
  const cancelUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=cancelled`;
  const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/create-vendor-payment-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.access_token}` },
    body: JSON.stringify({ invoice_id: invoice.id, return_url: returnUrl, cancel_url: cancelUrl }),
  });
  const fnBody = await fnRes.json();
  if (!fnRes.ok) {
    // A 409 means an in-flight pending payment already exists — reuse it so a
    // stale session from a prior run doesn't block the happy path.
    if (fnRes.status === 409 && fnBody?.payment_id) {
      console.log(`ℹ️ In-flight payment ${fnBody.payment_id} reused (${fnBody.status})`);
      await completeAndVerify(H, fnBody.payment_id, amount);
      return;
    }
    throw new Error(`Checkout failed (${fnRes.status}): ${fnBody.error || fnBody.message || JSON.stringify(fnBody)}`);
  }
  const paymentId = fnBody.payment_id;
  console.log(`🔌 Checkout OK — payment ${paymentId} (pending)`);

  await completeAndVerify(H, paymentId, amount);
}

async function completeAndVerify(H, paymentId, amount) {
  // 4. Simulate the signed COMPLETE ITN through the real webhook. The amount
  //    must match total_amount exactly or the webhook marks the payment failed.
  // import.meta.url is already a file:// URL — using it as the base avoids the
  // classic new URL(x, __dirname) ERR_INVALID_URL trap (a bare path has no scheme).
  const simulateScript = fileURLToPath(new URL('./simulate-vendor-payment-itn.mjs', import.meta.url));
  const simOut = execFileSync('node', [simulateScript, paymentId, 'COMPLETE', amount.toFixed(2)], {
    encoding: 'utf8',
    env: process.env,
  }).trim();
  console.log(simOut);
  if (simOut.includes('AMOUNT_MISMATCH') || simOut.includes('INVALID SIGNATURE')) {
    throw new Error(`ITN simulation rejected: ${simOut.slice(-200)}`);
  }

  // 5. Poll get-vendor-payment-status until completed (the app's result screen
  //    uses the same function). Timeout after 20s.
  const deadline = Date.now() + 20000;
  let last;
  while (Date.now() < deadline) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-vendor-payment-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: H.Authorization },
      body: JSON.stringify({ payment_id: paymentId }),
    });
    last = await res.json().catch(() => ({}));
    if (last.payment_status === 'completed') break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 6. Assert completion
  if (last?.payment_status !== 'completed') {
    console.error('❌ Payment did not reach completed. Last status:', JSON.stringify(last));
    process.exit(1);
  }
  console.log(`✅ PAYMENT COMPLETED — ${paymentId} (R${last.total_amount}, fee R${last.platform_fee}, vendor R${last.vendor_payout})`);
  console.log(`✅ vendor_payments record is 'completed' — happy path verified end-to-end.`);
}

main().catch((err) => {
  console.error('✗ Verification failed:', err.message);
  process.exit(1);
});
