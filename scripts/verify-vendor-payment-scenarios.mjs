#!/usr/bin/env node
/**
 * Verify the vendor-payment FULL SUITE scenarios (Plane #64) that cannot be
 * driven reliably through the UI (PayFast's hosted WebView is not automatable).
 *
 * Scenarios (all driven through the REAL edge functions / RLS-aware APIs):
 *   S1 Payment failure → retry → success — create checkout, FAILED ITN,
 *      assert 'failed', fresh checkout (retry), COMPLETE ITN, assert
 *      'completed' (mirrors the app's get-vendor-payment-status polling).
 *   S2 Payment cancellation — create checkout, CANCELLED ITN, assert
 *      'cancelled' (tenant abandoned PayFast).
 *   S3 Closure timeout — seed a closure_reports row with auto_approve_at in
 *      the past + tenant_verification_status='pending_tenant', invoke the
 *      auto-approve-closures edge function (service-role key), assert it
 *      auto-approved (72h rule).
 *   S4 Dispute — dispute opened then resolved. Opening + resolving a
 *      vendor_payments dispute are ADMIN-gated (vp_admin_update policy), so
 *      the lifecycle is driven with the runtime-fetched service-role key —
 *      exactly the privilege the admin dashboard exercises.
 *   S5 Payout failure → retry — payout marked failed (service role, the
 *      money-path admin action), vendor updates bank details via the REAL
 *      save-vendor-payout-preferences edge function (vendor token), then the
 *      payout is retried (service role → 'pending'), asserting processability.
 *   S6 Payer exclusivity — the tenant's visible invoices (no self-filter) must
 *      NOT include an approved owner-role invoice. The Maestro flow asserts
 *      the same at the UI level.
 *
 * Usage:
 *   node scripts/verify-vendor-payment-scenarios.mjs
 *
 * Env (optional overrides, defaults match .maestro/.env):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID (for the runtime service-role
 *     key fetch — same pattern as schedule-auto-crons.mjs; never persisted)
 *   TENANT_EMAIL/TENANT_PASSWORD, VENDOR_EMAIL/VENDOR_PASSWORD
 *   PAYFAST_PASSPHRASE (for the signed ITN simulations)
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
const PROJECT_REF = env('SUPABASE_PROJECT_ID') || new URL(SUPABASE_URL).hostname.split('.')[0];

const CREDS = {};
for (const [key, envKey] of [
  ['TENANT', 'TENANT_EMAIL'], ['TENANT_PW', 'TENANT_PASSWORD'],
  ['VENDOR', 'VENDOR_EMAIL'], ['VENDOR_PW', 'VENDOR_PASSWORD'],
]) {
  CREDS[key] = env(envKey) || env(`E2E_${envKey}`) || maestroEnv(envKey);
  if (!CREDS[key]) {
    console.error(`❌ Missing ${envKey} — set it in env, .env, or .maestro/.env`);
    process.exit(1);
  }
}

let passed = 0;
let failed = 0;
const failures = [];

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

function H(token) {
  return { apikey: ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * Fetch the service-role key at runtime via the Management API — the same
 * pattern schedule-auto-crons.mjs uses. NEVER persisted to disk or committed.
 * Used for the admin-gated vendor_payments mutations (dispute/payout) that
 * migration 047 restricts to `vp_admin_update` / service role.
 */
async function getServiceKey() {
  const token = env('SUPABASE_ACCESS_TOKEN') || maestroEnv('SUPABASE_ACCESS_TOKEN');
  if (!token) {
    throw new Error('Missing SUPABASE_ACCESS_TOKEN for the service-role key fetch (Management API).');
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Management API /api-keys failed: HTTP ${res.status}`);
  const keys = await res.json();
  const svc = (keys || []).find((k) => k.name === 'service_role');
  if (!svc?.api_key) throw new Error('service_role key not found via Management API.');
  return svc.api_key;
}

function report(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function findApprovedTenantInvoice(tenantToken) {
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=id,invoice_number,status,payer_role,total_amount,maintenance_request_id&payer_role=eq.tenant&status=eq.approved&order=created_at.desc&limit=1`,
    { headers: H(tenantToken) }
  ).then((r) => r.json());
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No APPROVED tenant-payer invoice — run scripts/seed-tenant-vendor-invoice.mjs first.');
  }
  return rows[0];
}

async function createCheckout(tenantToken, invoiceId) {
  const returnUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=success`;
  const cancelUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=cancelled`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-vendor-payment-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tenantToken}` },
    body: JSON.stringify({ invoice_id: invoiceId, return_url: returnUrl, cancel_url: cancelUrl }),
  });
  const body = await res.json();
  if (!res.ok) {
    if (res.status === 409 && body?.payment_id) {
      console.log(`  ℹ️ In-flight payment ${body.payment_id} reused (${body.status})`);
      return body.payment_id;
    }
    throw new Error(`Checkout failed (${res.status}): ${body.error || body.message || JSON.stringify(body)}`);
  }
  return body.payment_id;
}

async function pollStatus(token, paymentId, wanted, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-vendor-payment-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ payment_id: paymentId }),
    });
    last = await res.json().catch(() => ({}));
    if (last.payment_status === wanted) return last;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return last;
}

function simulateItn(paymentId, status, amount) {
  const script = fileURLToPath(new URL('./simulate-vendor-payment-itn.mjs', import.meta.url));
  const out = execFileSync('node', [script, paymentId, status, amount], {
    encoding: 'utf8',
    env: process.env,
  }).trim();
  console.log(out.split('\n').map((l) => `    ${l}`).join('\n'));
  if (out.includes('AMOUNT_MISMATCH') || out.includes('INVALID SIGNATURE')) {
    throw new Error(`ITN simulation rejected: ${out.slice(-200)}`);
  }
}

/** Patch a vendor_payment with the service-role key (admin-gated fields). */
async function patchVendorPayment(serviceKey, paymentId, fields) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/vendor_payments?id=eq.${paymentId}`,
    {
      method: 'PATCH',
      headers: { ...H(serviceKey), Prefer: 'return=representation' },
      body: JSON.stringify({ updated_at: new Date().toISOString(), ...fields }),
    }
  );
  const body = await res.json().catch(() => []);
  return (Array.isArray(body) ? body : [body]).find((p) => p?.id === paymentId);
}

// ── S1: Payment failure → retry → success ──────────────────────────────────
async function scenarioFailureRetrySuccess(tenant, invoice) {
  console.log('\n── S1: PAYMENT FAILURE → RETRY → SUCCESS ──');
  const amount = invoice.total_amount.toFixed(2);
  const first = await createCheckout(tenant.access_token, invoice.id);
  simulateItn(first, 'FAILED', amount);
  const failedState = await pollStatus(tenant.access_token, first, 'failed');
  report('S1a payment marked failed after card decline', failedState?.payment_status === 'failed',
    failedState?.payment_status || 'timeout');

  // Retry — a fresh checkout creates a NEW pending row.
  const retry = await createCheckout(tenant.access_token, invoice.id);
  simulateItn(retry, 'COMPLETE', amount);
  const completedState = await pollStatus(tenant.access_token, retry, 'completed');
  report('S1b retry succeeds (COMPLETE ITN → completed)', completedState?.payment_status === 'completed',
    completedState?.payment_status || 'timeout');
  return retry;
}

// ── S2: Payment cancellation ───────────────────────────────────────────────
async function scenarioCancellation(tenant, invoice) {
  console.log('\n── S2: PAYMENT CANCELLATION (tenant abandons PayFast) ──');
  const paymentId = await createCheckout(tenant.access_token, invoice.id);
  simulateItn(paymentId, 'CANCELLED', invoice.total_amount.toFixed(2));
  const state = await pollStatus(tenant.access_token, paymentId, 'cancelled');
  report('S2 payment cancelled after abandonment', state?.payment_status === 'cancelled',
    state?.payment_status || 'timeout');
}

// ── S3: Closure timeout → auto-approve ─────────────────────────────────────
async function scenarioClosureTimeout(vendor, serviceKey) {
  console.log('\n── S3: CLOSURE TIMEOUT (auto-approve after 72h) ──');
  // Only requests the vendor is actually assigned to — the closure INSERT
  // policy (migration 050) requires selected_vendor_id OR vendor_id = auth.uid().
  const mrs = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?select=id,title,owner_id,tenant_id,selected_vendor_id&or=(selected_vendor_id.eq.${vendor.user.id},vendor_id.eq.${vendor.user.id})&order=created_at.desc&limit=1`,
    { headers: H(vendor.access_token) }
  ).then((r) => r.json());
  const mr = Array.isArray(mrs) ? mrs[0] : null;
  if (!mr) {
    throw new Error('Vendor is not assigned to any maintenance request — run e2e-tenant-create-vendor-quote first.');
  }

  const past = new Date(Date.now() - 75 * 60 * 60 * 1000).toISOString();
  const insertRes = await fetch(
    `${SUPABASE_URL}/rest/v1/closure_reports?select=id,tenant_verification_status`,
    {
      method: 'POST',
      headers: { ...H(vendor.access_token), Prefer: 'return=representation' },
      body: JSON.stringify({
        maintenance_request_id: mr.id,
        status: 'pending',
        tenant_verification_status: 'pending_tenant',
        auto_approve_at: past,
        forwarded_to_tenant_at: past,
        completion_notes: 'E2E: closure timeout scenario',
      }),
    }
  );
  const inserted = await insertRes.json().catch(() => []);
  if (!insertRes.ok) {
    throw new Error(`Closure insert failed (${insertRes.status}): ${JSON.stringify(inserted).slice(0, 300)}`);
  }
  const closure = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!closure?.id) {
    throw new Error('Closure insert returned no row — check RLS closure insert policy (vendor must be assigned).');
  }

  // Invoke the real auto-approve-closures edge function with the service key
  // (the pg_cron uses the same auth).
  const res = await fetch(`${SUPABASE_URL}/functions/v1/auto-approve-closures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
  });
  const body = await res.json().catch(() => ({}));
  const ok = res.ok && (body.auto_approved ?? -1) >= 1;
  report('S3 closure auto-approved after 72h timeout', ok,
    `auto_approved=${body.auto_approved ?? 'err ' + res.status}`);

  const check = await fetch(
    `${SUPABASE_URL}/rest/v1/closure_reports?select=id,tenant_verification_status,tenant_ack_at&id=eq.${closure.id}`,
    { headers: H(vendor.access_token) }
  ).then((r) => r.json());
  const row = Array.isArray(check) ? check[0] : null;
  report('S3 row state verified (auto_approved + ack stamped)',
    row?.tenant_verification_status === 'auto_approved' && !!row?.tenant_ack_at,
    row?.tenant_verification_status || 'n/a');
}

// ── S4: Dispute lifecycle (admin-gated via service role) ───────────────────
async function scenarioDispute(serviceKey, completedPaymentId) {
  console.log('\n── S4: DISPUTE (opened → admin resolves) ──');
  // Opening + resolving a vendor_payments dispute is restricted to vp_admin_update
  // / service role (migration 047) — drive it with the service key, which is
  // the same privilege the admin dashboard uses.
  const openedRow = await patchVendorPayment(serviceKey, completedPaymentId, { dispute_status: 'opened' });
  report('S4a dispute opened', openedRow?.dispute_status === 'opened', openedRow?.dispute_status || 'n/a');

  const resolvedRow = await patchVendorPayment(serviceKey, completedPaymentId, {
    dispute_status: 'resolved',
    dispute_resolved_at: new Date().toISOString(),
  });
  report('S4b dispute resolved by admin',
    resolvedRow?.dispute_status === 'resolved' && !!resolvedRow?.dispute_resolved_at,
    resolvedRow?.dispute_status || 'n/a');
}

// ── S5: Payout failure → vendor updates bank → retry ───────────────────────
async function scenarioPayoutFailure(vendor, serviceKey, completedPaymentId) {
  console.log('\n── S5: PAYOUT FAILURE → VENDOR UPDATES BANK → RETRY ──');
  // Mark the payout failed (admin/service-role money-path action).
  const failedRow = await patchVendorPayment(serviceKey, completedPaymentId, { payout_status: 'failed' });
  report('S5a payout marked failed (wrong bank details)', failedRow?.payout_status === 'failed',
    failedRow?.payout_status || 'n/a');

  // Vendor corrects bank details via the REAL edge function (vendor-gated).
  const prefs = await fetch(`${SUPABASE_URL}/functions/v1/save-vendor-payout-preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vendor.access_token}` },
    body: JSON.stringify({
      schedule: 'instant',
      bank_account_name: 'E2E Vendor',
      bank_name: 'Test Bank',
      branch_code: '123456',
      account_type: 'cheque',
      account_number: '1234567890',
    }),
  });
  const prefsBody = await prefs.json().catch(() => ({}));
  report('S5b vendor updates bank details', prefs.ok && !!prefsBody.account_number_masked,
    prefsBody.account_number_masked ? `masked ${prefsBody.account_number_masked}` : `err ${prefs.status}`);

  // Retry: back to 'pending' so the payout pipeline picks it up again.
  const retriedRow = await patchVendorPayment(serviceKey, completedPaymentId, { payout_status: 'pending' });
  report('S5c payout retried (failed → pending, ready for pipeline)',
    retriedRow?.payout_status === 'pending', retriedRow?.payout_status || 'n/a');
}

// ── S6: Payer exclusivity (API-level, no self-filter) ──────────────────────
async function scenarioPayerExclusivity(tenant) {
  console.log('\n── S6: PAYER EXCLUSIVITY (owner-role invoice hidden from tenant) ──');
  // Do NOT self-filter by payer_role — fetch every invoice the tenant can see
  // on their requests and assert no INV-OWNER-E2E appears. This catches RLS
  // leaking owner-payable invoices to the tenant's view.
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=invoice_number,payer_role,status&order=created_at.desc&limit=200`,
    { headers: H(tenant.access_token) }
  ).then((r) => r.json());
  const ownerVisible = (Array.isArray(rows) ? rows : []).some((i) =>
    String(i.invoice_number).startsWith('INV-OWNER-E2E'));
  report('S6 owner-role invoice hidden from tenant list', !ownerVisible,
    ownerVisible ? 'OWNER invoice leaked into tenant view!' : 'no owner-role invoice visible');
}

async function main() {
  const tenant = await login(CREDS.TENANT, CREDS.TENANT_PW);
  const vendor = await login(CREDS.VENDOR, CREDS.VENDOR_PW);
  console.log(`✅ Logged in as tenant + vendor`);

  const serviceKey = await getServiceKey();
  console.log('🔑 Service-role key fetched at runtime (Management API, never persisted)');

  const invoice = await findApprovedTenantInvoice(tenant.access_token);
  console.log(`📄 Invoice ${invoice.invoice_number} (${invoice.id}) — R${invoice.total_amount}`);

  let completedPaymentId = null;

  try {
    completedPaymentId = await scenarioFailureRetrySuccess(tenant, invoice);
    await scenarioCancellation(tenant, invoice);
    await scenarioClosureTimeout(vendor, serviceKey);
    await scenarioDispute(serviceKey, completedPaymentId);
    await scenarioPayoutFailure(vendor, serviceKey, completedPaymentId);
    await scenarioPayerExclusivity(tenant);
  } catch (err) {
    failed++;
    failures.push(`setup: ${err.message}`);
    console.error(`  ❌ Scenario setup failed: ${err.message}`);
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(` SCENARIO RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log(' FAILED:', failures.join(', '));
    process.exit(1);
  }
  console.log(' ✅ VENDOR PAYMENT FULL SUITE — deterministic scenarios verified');
}

main().catch((err) => {
  console.error('✗ Verification failed:', err.message);
  process.exit(1);
});
