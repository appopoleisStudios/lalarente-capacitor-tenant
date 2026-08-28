#!/usr/bin/env node
/**
 * Seed: create an APPROVED OWNER-role maintenance invoice for the e2e tenant.
 *
 * Plane #64 — payer-exclusivity scenario: the tenant vendor-payments list
 * filters `payer_role='tenant'`, so an invoice with payer_role='owner' on the
 * SAME maintenance request must be HIDDEN from the tenant (no Pay Now). This
 * script creates that owner-role invoice so the full suite can assert the
 * negative (assertNotVisible in Maestro + API-level assert in verify).
 *
 * Flow (RLS-safe, mirrors real app actions — same pattern as
 * seed-tenant-vendor-invoice.mjs):
 *   1. Login as the e2e vendor → insert a 'submitted' owner-role invoice
 *      linked to the tenant's most recent maintenance request.
 *   2. Login as the owner/admin → approve it.
 *
 * Usage:
 *   node scripts/seed-owner-role-invoice.mjs
 *
 * Env (optional overrides, defaults match .maestro/.env):
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   TENANT_EMAIL, TENANT_PASSWORD
 *   VENDOR_EMAIL, VENDOR_PASSWORD
 *   OWNER_EMAIL, OWNER_PASSWORD
 */
import { env, maestroEnv } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY — set them in env or .env');
  process.exit(1);
}

const TENANT_EMAIL = env('TENANT_EMAIL') || env('E2E_TENANT_EMAIL') || maestroEnv('TENANT_EMAIL');
const TENANT_PASSWORD = env('TENANT_PASSWORD') || env('E2E_TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD');
const VENDOR_EMAIL = env('VENDOR_EMAIL') || env('E2E_VENDOR_EMAIL') || maestroEnv('VENDOR_EMAIL');
const VENDOR_PASSWORD = env('VENDOR_PASSWORD') || env('E2E_VENDOR_PASSWORD') || maestroEnv('VENDOR_PASSWORD');
const OWNER_EMAIL = env('OWNER_EMAIL') || env('E2E_OWNER_EMAIL') || maestroEnv('OWNER_EMAIL');
const OWNER_PASSWORD = env('OWNER_PASSWORD') || env('E2E_OWNER_PASSWORD') || maestroEnv('OWNER_PASSWORD');
for (const [name, val] of [
  ['TENANT_EMAIL', TENANT_EMAIL], ['TENANT_PASSWORD', TENANT_PASSWORD],
  ['VENDOR_EMAIL', VENDOR_EMAIL], ['VENDOR_PASSWORD', VENDOR_PASSWORD],
  ['OWNER_EMAIL', OWNER_EMAIL], ['OWNER_PASSWORD', OWNER_PASSWORD],
]) {
  if (!val) {
    console.error(`❌ Missing ${name} — set it in env, .env, or .maestro/.env`);
    process.exit(1);
  }
}

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

async function main() {
  const tenant = await login(TENANT_EMAIL, TENANT_PASSWORD);
  const vendor = await login(VENDOR_EMAIL, VENDOR_PASSWORD);
  const owner = await login(OWNER_EMAIL, OWNER_PASSWORD);
  console.log('✓ Logged in as tenant, vendor, owner');

  const tenantId = tenant.user.id;
  const vendorId = vendor.user.id;
  const ownerId = owner.user.id;

  // Tenant's most recent maintenance request (same lookup as the tenant seed)
  const mrsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?select=id,title,owner_id,property_id&tenant_id=eq.${tenantId}&order=created_at.desc&limit=1`,
    { headers: headers(tenant.access_token) }
  );
  const mrs = await mrsRes.json();
  if (!mrs || mrs.length === 0) {
    throw new Error('Tenant has no maintenance requests — run e2e-tenant-create-vendor-quote first.');
  }
  let mr = mrs[0];
  const requestOwnerId = mr.owner_id || ownerId;
  console.log(`✓ Using maintenance request: ${mr.title} (${mr.id})`);

  // Owner-pay Maestro path: assign vendor, set in_progress, retitle so the
  // list card + invoice CTA are deterministic (invoice card only mounts when
  // status is in_progress or completed).
  const ownerPayE2e = process.env.OWNER_PAY_E2E === '1';
  const SEED_TITLE = 'E2E Owner Invoice Pay';
  if (ownerPayE2e) {
    const assignRes = await fetch(
      `${SUPABASE_URL}/rest/v1/maintenance_requests?id=eq.${mr.id}`,
      {
        method: 'PATCH',
        headers: { ...headers(owner.access_token), Prefer: 'return=representation' },
        body: JSON.stringify({
          selected_vendor_id: vendorId,
          status: 'in_progress',
          title: SEED_TITLE,
        }),
      }
    );
    const assignRows = await assignRes.json().catch(() => []);
    const assignRow = (Array.isArray(assignRows) ? assignRows : [assignRows]).find(
      (r) => r?.id === mr.id && r?.title === SEED_TITLE
    );
    if (!assignRow) {
      throw new Error(
        'OWNER_PAY_E2E request PATCH returned no row — owner token cannot update this request (owner_id mismatch or RLS).'
      );
    }
    mr = { ...mr, ...assignRow };
    console.log(`✓ Retitled request "${SEED_TITLE}" + in_progress (owner pay Maestro)`);
  }

  // Distinctive owner-role invoice number so the full suite can assert it is
  // NOT visible to the tenant (payer exclusivity).
  const invoiceNumber = `INV-OWNER-E2E-${Date.now().toString().slice(-6)}`;
  const subtotal = 1200;
  const vat = subtotal * 0.15;
  const total = subtotal + vat;
  const lineItems = [
    { description: 'Seed: Owner-payable work (payer exclusivity E2E)', quantity: 1, unit_price: subtotal, total: subtotal },
  ];

  // Insert 'submitted' as the vendor (vendor insert policy: vendor_id = auth.uid()).
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/maintenance_invoices`, {
    method: 'POST',
    headers: { ...headers(vendor.access_token), Prefer: 'return=representation' },
    body: JSON.stringify({
      maintenance_request_id: mr.id,
      vendor_id: vendorId,
      owner_id: requestOwnerId,
      property_id: mr.property_id,
      invoice_number: invoiceNumber,
      status: 'submitted',
      payer_role: 'owner', // ← the exclusivity under test
      line_items: lineItems,
      subtotal,
      vat_amount: vat,
      total_amount: total,
      notes: 'Seeded for Plane #64 payer-exclusivity E2E',
    }),
  });
  if (!insertRes.ok) {
    const body = await insertRes.text();
    throw new Error(`Owner-role invoice insert failed (${insertRes.status}): ${body.slice(0, 300)}`);
  }
  const inserted = await insertRes.json().catch(() => []);
  const [invoice] = Array.isArray(inserted) ? inserted : [inserted];
  if (!invoice?.id) {
    throw new Error('Owner-role invoice insert returned no row — check RLS vendor_invoice_insert.');
  }
  console.log(`✓ Inserted submitted OWNER-role invoice ${invoiceNumber} (${invoice.id})`);

  // Approve as the owner (owner update policy: owner_id = auth.uid()).
  const approveRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?id=eq.${invoice.id}&status=eq.submitted`,
    {
      method: 'PATCH',
      headers: { ...headers(owner.access_token), Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: requestOwnerId,
      }),
    }
  );
  if (!approveRes.ok) {
    const body = await approveRes.text();
    throw new Error(`Owner-role invoice approve failed (${approveRes.status}): ${body.slice(0, 300)}`);
  }
  const approved = await approveRes.json().catch(() => []);
  const approvedRow = (Array.isArray(approved) ? approved : [approved]).find((i) => i?.status === 'approved');
  if (!approvedRow) {
    throw new Error('Owner-role invoice approval returned no approved row — owner token mismatch.');
  }
  console.log(`✓ Approved OWNER-role invoice ${invoiceNumber} — tenant must NOT see it (payer exclusivity)`);
}

main().catch((err) => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
