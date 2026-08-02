#!/usr/bin/env node
/**
 * Seed: create an APPROVED tenant-payer maintenance invoice for the e2e tenant.
 *
 * Why: the tenant vendor-payments screen only lists invoices where
 *   payer_role='tenant' AND status='approved' AND the linked maintenance
 *   request belongs to the logged-in tenant. The DB currently has zero such
 *   invoices, so the 20-vendor-payments Maestro flow can never pass.
 *
 * Flow (RLS-safe, mirrors real app actions):
 *   1. Login as the e2e vendor → insert a 'submitted' invoice linked to the
 *      tenant's most recent maintenance request (vendor insert policy allows it).
 *   2. Login as the owner/admin → approve the invoice via the owner update
 *      policy (owner_invoice_update: owner_id = auth.uid()).
 *
 * Usage:
 *   node scripts/seed-tenant-vendor-invoice.mjs
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

// Login credentials — env, .env, then gitignored .maestro/.env E2E credentials.
const TENANT_EMAIL = env('TENANT_EMAIL') || env('E2E_TENANT_EMAIL') || maestroEnv('TENANT_EMAIL');
const TENANT_PASSWORD = env('TENANT_PASSWORD') || env('E2E_TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD');
const VENDOR_EMAIL = env('VENDOR_EMAIL') || env('E2E_VENDOR_EMAIL') || maestroEnv('VENDOR_EMAIL');
const VENDOR_PASSWORD = env('VENDOR_PASSWORD') || env('E2E_VENDOR_PASSWORD') || maestroEnv('VENDOR_PASSWORD');
const OWNER_EMAIL = env('OWNER_EMAIL') || env('E2E_OWNER_EMAIL') || maestroEnv('OWNER_EMAIL');
const OWNER_PASSWORD = env('OWNER_PASSWORD') || env('E2E_OWNER_PASSWORD') || maestroEnv('OWNER_PASSWORD');
for (const [name, val] of [
  ['TENANT_EMAIL', TENANT_EMAIL],
  ['TENANT_PASSWORD', TENANT_PASSWORD],
  ['VENDOR_EMAIL', VENDOR_EMAIL],
  ['VENDOR_PASSWORD', VENDOR_PASSWORD],
  ['OWNER_EMAIL', OWNER_EMAIL],
  ['OWNER_PASSWORD', OWNER_PASSWORD],
]) {
  if (!val) {
    console.error(`❌ Missing ${name} — set it in env, .env, or .maestro/.env`);
    process.exit(1);
  }
}

async function login(email, password) {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Login failed for ${email}: ${body.error_description || res.status}`);
  }
  return res.json();
}

function headers(token) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function main() {
  // 1. Login as all three roles
  const tenant = await login(TENANT_EMAIL, TENANT_PASSWORD);
  const vendor = await login(VENDOR_EMAIL, VENDOR_PASSWORD);
  const owner = await login(OWNER_EMAIL, OWNER_PASSWORD);
  console.log('✓ Logged in as tenant, vendor, owner');

  const tenantId = tenant.user.id;
  const vendorId = vendor.user.id;
  const ownerId = owner.user.id;

  // 2. Find the tenant's most recent maintenance request
  const mrsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?select=id,title,owner_id,property_id&tenant_id=eq.${tenantId}&order=created_at.desc&limit=1`,
    { headers: headers(tenant.access_token) }
  );
  const mrs = await mrsRes.json();
  if (!mrs || mrs.length === 0) {
    throw new Error('Tenant has no maintenance requests — create one first (run e2e-tenant-create-vendor-quote).');
  }
  const mr = mrs[0];
  const requestOwnerId = mr.owner_id || ownerId;
  console.log(`✓ Using maintenance request: ${mr.title} (${mr.id})`);

  // 3. Check for an existing invoice on this request — reuse instead of
  //    duplicating (leftover 'submitted' from a prior run gets approved).
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=id,invoice_number,status&maintenance_request_id=eq.${mr.id}`,
    { headers: headers(owner.access_token) }
  );
  const existing = await existingRes.json();
  const approvedExisting = (existing || []).find((i) => i.status === 'approved');
  if (approvedExisting) {
    console.log(`✓ Invoice ${approvedExisting.invoice_number} already approved — nothing to do`);
    // Still verify tenant visibility so this script stays a reliable money-path gate.
    await verifyTenantView(tenant.access_token, mr.id);
    return;
  }
  const submittedExisting = (existing || []).find((i) => i.status === 'submitted');
  let invoiceId = submittedExisting?.id;
  let invoiceNumber = submittedExisting?.invoice_number;

  // 4. Insert 'submitted' invoice as the vendor (vendor insert policy allows)
  const subtotal = 850;
  const vat = subtotal * 0.15;
  const total = subtotal + vat;
  // NOTE: the Pay Vendor screen renders item.total.toLocaleString() — line_items
  // MUST carry a `total` per item or a real invoice crashes that screen.
  // Line-item total is quantity × unit_price (EXCLUDING VAT) so the breakdown
  // doesn't double-count: the screen shows line items + Subtotal + VAT + Total.
  const lineItems = [
    { description: 'Seed: Labor - Faucet Repair (E2E money path)', quantity: 1, unit_price: subtotal, total: subtotal },
  ];
  if (!invoiceNumber) {
    invoiceNumber = `INV-E2E-${Date.now().toString().slice(-6)}`;
  }

  if (!invoiceId) {
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/maintenance_invoices`, {
      method: 'POST',
      headers: {
        ...headers(vendor.access_token),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        maintenance_request_id: mr.id,
        vendor_id: vendorId,
        owner_id: requestOwnerId,
        property_id: mr.property_id,
        invoice_number: invoiceNumber,
        status: 'submitted',
        payer_role: 'tenant',
        line_items: lineItems,
        subtotal,
        vat_amount: vat,
        total_amount: total,
        notes: 'Seeded for E2E vendor-payments verification',
      }),
    });
    if (!insertRes.ok) {
      const body = await insertRes.text();
      throw new Error(`Invoice insert failed (${insertRes.status}): ${body.slice(0, 300)}`);
    }
    const inserted = await insertRes.json().catch(() => []);
    const [invoice] = Array.isArray(inserted) ? inserted : [inserted];
    if (!invoice?.id) {
      throw new Error('Invoice insert returned no row — check RLS vendor_invoice_insert (vendor_id = auth.uid()).');
    }
    invoiceId = invoice.id;
    console.log(`✓ Inserted submitted invoice ${invoiceNumber} (${invoiceId})`);
  } else {
    // Reuse path: leftover invoices from pre-total-fix runs may lack `total` in
    // line_items (which the Pay Vendor screen renders). Backfill via the OWNER
    // token — there is no vendor_invoice_update policy, so a vendor PATCH would
    // silently RLS-filter to zero rows (PostgREST returns 200 anyway).
    // owner_invoice_update exists and the seed sets owner_id=requestOwnerId.
    const backfill = await fetch(
      `${SUPABASE_URL}/rest/v1/maintenance_invoices?id=eq.${invoiceId}`,
      {
        method: 'PATCH',
        headers: { ...headers(owner.access_token), Prefer: 'return=representation' },
        body: JSON.stringify({ line_items: lineItems, subtotal, vat_amount: vat, total_amount: total }),
      }
    );
    if (!backfill.ok) {
      throw new Error(`Backfill on reused invoice failed (${backfill.status})`);
    }
    const backfilled = await backfill.json().catch(() => []);
    const backfilledRow = (Array.isArray(backfilled) ? backfilled : [backfilled]).find(
      (i) => i?.id === invoiceId
    );
    if (!backfilledRow) {
      throw new Error(
        'Backfill returned no row — owner token does not match invoice owner_id. ' +
        'Pass OWNER_EMAIL/OWNER_PASSWORD matching the maintenance request owner.'
      );
    }
    console.log(`✓ Backfilled line_items/subtotal/vat/total on reused invoice ${invoiceNumber}`);
    console.log(`✓ Reusing existing submitted invoice ${invoiceNumber} (${invoiceId})`);
  }

  // 5. Approve as the owner (owner update policy: owner_id = auth.uid()).
  //    PostgREST PATCH returns 200 even when RLS filters out all rows, so we
  //    request the updated representation and assert it actually changed.
  const approveRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?id=eq.${invoiceId}&status=eq.submitted`,
    {
      method: 'PATCH',
      headers: {
        ...headers(owner.access_token),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: requestOwnerId,
      }),
    }
  );
  if (!approveRes.ok) {
    const body = await approveRes.text();
    throw new Error(`Invoice approve failed (${approveRes.status}): ${body.slice(0, 300)}`);
  }
  const approved = await approveRes.json().catch(() => []);
  const approvedRow = (Array.isArray(approved) ? approved : [approved]).find(
    (i) => i?.status === 'approved'
  );
  if (!approvedRow) {
    throw new Error(
      'Invoice approval returned no approved row — the invoice owner_id differs from the ' +
      'logged-in owner, or RLS owner_invoice_update is not applied. Pass OWNER_EMAIL/OWNER_PASSWORD ' +
      'matching the maintenance request owner.'
    );
  }
  console.log(`✓ Approved invoice ${invoiceNumber} — tenant money path is now testable`);

  // 6. Verify the tenant can see it (RLS tenant_invoice_select)
  await verifyTenantView(tenant.access_token, mr.id);
}

async function verifyTenantView(tenantToken, maintenanceRequestId) {
  const tenantViewRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=invoice_number,status,payer_role,total_amount&maintenance_request_id=eq.${maintenanceRequestId}`,
    { headers: headers(tenantToken) }
  );
  const tenantView = await tenantViewRes.json();
  const visible = (tenantView || []).filter((i) => i.status === 'approved' && i.payer_role === 'tenant');
  if (visible.length > 0) {
    console.log(`✓ Tenant can see approved payable invoice (RLS OK): ${JSON.stringify(visible[0])}`);
  } else {
    throw new Error(
      'Tenant cannot see the approved invoice — RLS tenant_invoice_select is not applied. ' +
      'Run: node scripts/check-apply-invoice-rls.mjs'
    );
  }
}

main().catch((err) => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
