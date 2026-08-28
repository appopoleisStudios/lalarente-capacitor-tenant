#!/usr/bin/env node
/**
 * Verify OWNER → vendor payment to COMPLETION (LAL-112 / PR #166).
 *
 * Maestro cannot fill PayFast's hosted WebView. This drives the same path
 * the owner app uses after "Pay via PayFast":
 *   1. Login as owner (not tenant).
 *   2. Find the latest APPROVED owner-payer invoice (or INVOICE_ID).
 *   3. Prove the tenant is rejected on checkout (403).
 *   4. Call create-vendor-payment-checkout as the owner → pending row.
 *   5. Signed COMPLETE ITN through payment-webhook (same as production).
 *   6. Poll get-vendor-payment-status as the owner until completed.
 *   7. Assert invoice is paid and vendor_payments.owner_id is the owner.
 *
 * Usage:
 *   OWNER_PAY_E2E=1 node scripts/seed-owner-role-invoice.mjs
 *   node scripts/verify-owner-payment-completed.mjs
 *   INVOICE_ID=<uuid> node scripts/verify-owner-payment-completed.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env, maestroEnv } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY');
  process.exit(1);
}

const OWNER_EMAIL = env('OWNER_EMAIL') || env('E2E_OWNER_EMAIL') || maestroEnv('OWNER_EMAIL');
const OWNER_PASSWORD =
  env('OWNER_PASSWORD') || env('E2E_OWNER_PASSWORD') || maestroEnv('OWNER_PASSWORD');
const TENANT_EMAIL = env('TENANT_EMAIL') || env('E2E_TENANT_EMAIL') || maestroEnv('TENANT_EMAIL');
const TENANT_PASSWORD =
  env('TENANT_PASSWORD') || env('E2E_TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD');
if (!OWNER_EMAIL || !OWNER_PASSWORD || !TENANT_EMAIL || !TENANT_PASSWORD) {
  console.error('❌ Missing OWNER_/TENANT_ credentials in env or .maestro/.env');
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVOICE_ID = process.env.INVOICE_ID || '';

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${email}: ${body.error_description || res.status}`);
  }
  return res.json();
}

function headers(token) {
  return { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function checkout(token, invoiceId) {
  const returnUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=success`;
  const cancelUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=cancelled`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-vendor-payment-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ invoice_id: invoiceId, return_url: returnUrl, cancel_url: cancelUrl }),
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  const owner = await login(OWNER_EMAIL, OWNER_PASSWORD);
  const tenant = await login(TENANT_EMAIL, TENANT_PASSWORD);
  console.log('✅ Logged in as owner:', owner.user.email);
  console.log('✅ Logged in as tenant:', tenant.user.email);
  const OH = headers(owner.access_token);

  const lookup = UUID_RE.test(INVOICE_ID)
    ? `id=eq.${INVOICE_ID}`
    : 'payer_role=eq.owner&status=eq.approved&order=created_at.desc&limit=1';
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=id,invoice_number,status,payer_role,total_amount,owner_id,vendor_id,maintenance_request_id&${lookup}`,
    { headers: OH }
  ).then((r) => r.json());

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(
      'No APPROVED owner-payer invoice found — run OWNER_PAY_E2E=1 node scripts/seed-owner-role-invoice.mjs first.'
    );
  }
  const invoice = rows[0];
  const amount = Number(invoice.total_amount);
  console.log(
    `📄 Invoice ${invoice.invoice_number} (${invoice.id}) payer_role=${invoice.payer_role} status=${invoice.status} R${amount}`
  );
  if (invoice.payer_role !== 'owner') {
    throw new Error(`Expected payer_role=owner, got ${invoice.payer_role}`);
  }
  if (invoice.owner_id !== owner.user.id) {
    throw new Error(`Invoice owner_id ${invoice.owner_id} !== logged-in owner ${owner.user.id}`);
  }

  const tenantCheckout = await checkout(tenant.access_token, invoice.id);
  if (tenantCheckout.res.status !== 403) {
    throw new Error(
      `Tenant checkout should be 403 on owner-billed invoice, got ${tenantCheckout.res.status}: ${JSON.stringify(tenantCheckout.body)}`
    );
  }
  console.log('✅ Tenant checkout rejected (403) on owner-billed invoice');

  const { res: fnRes, body: fnBody } = await checkout(owner.access_token, invoice.id);
  if (!fnRes.ok) {
    if (fnRes.status === 409 && fnBody?.payment_id) {
      console.log(`ℹ️ In-flight/existing payment ${fnBody.payment_id} reused (${fnBody.status})`);
      if (fnBody.status === 'completed') {
        console.log('✅ OWNER PAYMENT already completed — vendor_payments record is completed.');
        return;
      }
      await completeAndVerify(OH, owner.user.id, invoice, fnBody.payment_id, amount);
      return;
    }
    throw new Error(
      `Owner checkout failed (${fnRes.status}): ${fnBody.error || fnBody.message || JSON.stringify(fnBody)}`
    );
  }
  const paymentId = fnBody.payment_id;
  if (!paymentId) {
    throw new Error(`Owner checkout returned no payment_id: ${JSON.stringify(fnBody)}`);
  }
  console.log(`🔌 Owner checkout OK — payment ${paymentId} (pending)`);

  await completeAndVerify(OH, owner.user.id, invoice, paymentId, amount);
}

async function completeAndVerify(OH, ownerUserId, invoice, paymentId, amount) {
  const simulateScript = fileURLToPath(new URL('./simulate-vendor-payment-itn.mjs', import.meta.url));
  const simOut = execFileSync('node', [simulateScript, paymentId, 'COMPLETE', amount.toFixed(2)], {
    encoding: 'utf8',
    env: process.env,
  }).trim();
  console.log(simOut);
  if (simOut.includes('AMOUNT_MISMATCH') || simOut.includes('INVALID SIGNATURE')) {
    throw new Error(`ITN simulation rejected: ${simOut.slice(-200)}`);
  }

  const deadline = Date.now() + 20000;
  let last;
  while (Date.now() < deadline) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-vendor-payment-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: OH.Authorization },
      body: JSON.stringify({ payment_id: paymentId }),
    });
    last = await res.json().catch(() => ({}));
    if (last.payment_status === 'completed') break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  if (last?.payment_status !== 'completed') {
    console.error('❌ Owner payment did not reach completed. Last status:', JSON.stringify(last));
    process.exit(1);
  }
  if (last.owner_id && last.owner_id !== ownerUserId) {
    throw new Error(`vendor_payments.owner_id ${last.owner_id} !== owner ${ownerUserId}`);
  }
  if (last.vendor_id && invoice.vendor_id && last.vendor_id !== invoice.vendor_id) {
    throw new Error(`vendor_payments.vendor_id ${last.vendor_id} !== invoice vendor ${invoice.vendor_id}`);
  }

  const invRows = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=id,status,payer_role&id=eq.${invoice.id}`,
    { headers: OH }
  ).then((r) => r.json());
  const paid = Array.isArray(invRows) ? invRows[0] : null;
  if (paid?.status !== 'paid') {
    throw new Error(`Invoice status after owner pay is '${paid?.status}', expected 'paid'`);
  }

  console.log(
    `✅ OWNER PAYMENT COMPLETED — ${paymentId} (R${last.total_amount}, fee R${last.platform_fee}, vendor R${last.vendor_payout})`
  );
  console.log(`✅ Invoice ${invoice.invoice_number} is paid; vendor_payments is completed (owner → vendor).`);
}

main().catch((err) => {
  console.error('✗ Owner payment verification failed:', err.message);
  process.exit(1);
});
