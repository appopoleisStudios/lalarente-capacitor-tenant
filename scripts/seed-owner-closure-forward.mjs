#!/usr/bin/env node
/**
 * Seed: put the E2E tenant's most recent maintenance request into the exact
 * state that surfaces the OWNER closure-review + forward flow (Plane #77):
 *
 *   - closure_reports row with status 'pending' + completion_notes +
 *     completion_photos (the vendor→owner path `requestClosure` uses), so
 *     OwnerClosureApprovalScreen (/maintenance/[id]/review-closure) renders
 *     with Approve & Complete / Request Changes.
 *   - request in_progress + closure_requested_at + deterministic title
 *     "E2E Closure Forward" so the Maestro flow can tap it reliably.
 *
 * All writes mirror the app's OWN RLS-valid calls (vendor-token writes after
 * owner-token assignment) — same self-sufficiency contract as
 * seed-tenant-closure-confirm.mjs.
 *
 * Usage:
 *   node scripts/seed-owner-closure-forward.mjs
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

// 1x1 PNG data URIs — render offline, no network dependency in the sim.
const PHOTO_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PHOTO_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

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
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function main() {
  const tenant = await login(TENANT_EMAIL, TENANT_PASSWORD);
  const vendor = await login(VENDOR_EMAIL, VENDOR_PASSWORD);
  const owner = await login(OWNER_EMAIL, OWNER_PASSWORD);
  const tenantId = tenant.user.id;
  const vendorId = vendor.user.id;
  const ownerId = owner.user.id;
  const V = headers(vendor.access_token);
  const O = headers(owner.access_token);
  console.log('✓ Logged in as tenant + vendor + owner');

  // 1. Find the tenant's most recent request.
  const mrsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?select=id,title,status,selected_vendor_id,vendor_id,tenant_id,owner_id&tenant_id=eq.${tenantId}&order=created_at.desc&limit=1`,
    { headers: O }
  );
  const mrs = await mrsRes.json();
  if (!mrs || mrs.length === 0) {
    throw new Error(
      'Tenant has no maintenance requests — run e2e-tenant-create-vendor-quote.yaml (Maestro) first to create one.'
    );
  }
  let mr = mrs[0];
  console.log(`✓ Using maintenance request: "${mr.title}" (${mr.id}, status=${mr.status})`);

  // 1b. Assign the E2E vendor via the OWNER token if not already assigned.
  if (!(mr.selected_vendor_id === vendorId || mr.vendor_id === vendorId)) {
    const assignRes = await fetch(
      `${SUPABASE_URL}/rest/v1/maintenance_requests?id=eq.${mr.id}`,
      {
        method: 'PATCH',
        headers: { ...O, Prefer: 'return=representation' },
        body: JSON.stringify({
          selected_vendor_id: vendorId,
          status: 'in_progress',
        }),
      }
    );
    const assignRows = await assignRes.json().catch(() => []);
    const assignRow = (Array.isArray(assignRows) ? assignRows : [assignRows]).find(
      (r) => r?.id === mr.id && r?.selected_vendor_id === vendorId
    );
    if (!assignRow) {
      throw new Error(
        'Vendor assignment PATCH returned no row — owner token cannot update this request (owner_id mismatch or RLS).'
      );
    }
    mr = { ...mr, selected_vendor_id: vendorId, status: 'in_progress' };
    console.log('✓ E2E vendor (re)assigned to the request (owner RLS OK)');
  } else {
    console.log('✓ E2E vendor already assigned — continuing');
  }

  const now = new Date().toISOString();
  const SEED_TITLE = 'E2E Closure Forward';

  // 2. Vendor token: set the request into closure-review state + deterministic
  //    title (mirrors requestClosure's update). Verify with return=representation.
  const reqRes = await fetch(`${SUPABASE_URL}/rest/v1/maintenance_requests?id=eq.${mr.id}`, {
    method: 'PATCH',
    headers: { ...V, Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'in_progress',
      closure_requested_at: now,
      title: SEED_TITLE,
    }),
  });
  const reqRows = await reqRes.json().catch(() => []);
  const reqRow = (Array.isArray(reqRows) ? reqRows : [reqRows]).find(
    (r) => r?.id === mr.id && r?.closure_requested_at && r?.title === SEED_TITLE
  );
  if (!reqRow) {
    throw new Error(
      'maintenance_requests PATCH returned no row — vendor token cannot update this request (RLS). Check selected_vendor_id/vendor_id.'
    );
  }
  console.log(`✓ Request retitled "${SEED_TITLE}" + set to in_progress + closure_requested_at (vendor RLS OK)`);

  // 3. Vendor token: idempotent upsert of the pending closure report (the
  //    vendor→owner path — NO vendor_confirmed_at). Reuse the active row if
  //    one exists so the seed never trips migration 050's partial unique index
  //    (WHERE status <> 'rejected') with a duplicate pending row.
  // Prefer an existing PENDING row so a re-run never touches an approved or
  // rejected closure (migration 050's partial unique index WHERE status <>
  // 'rejected' forbids duplicate active rows). Fall back to any non-rejected
  // active row only if no pending one exists.
  let closureRow = null;
  const pendRes = await fetch(
    `${SUPABASE_URL}/rest/v1/closure_reports?select=id,status&maintenance_request_id=eq.${mr.id}&status=eq.pending&limit=1`,
    { headers: V }
  );
  const pendRows = await pendRes.json().catch(() => []);
  closureRow = Array.isArray(pendRows) ? pendRows[0] : null;
  if (!closureRow?.id) {
    const anyRes = await fetch(
      `${SUPABASE_URL}/rest/v1/closure_reports?select=id,status&maintenance_request_id=eq.${mr.id}&status=neq.rejected&limit=1`,
      { headers: V }
    );
    const anyRows = await anyRes.json().catch(() => []);
    closureRow = Array.isArray(anyRows) ? anyRows[0] : null;
  }

  const closurePayload = {
    maintenance_request_id: mr.id,
    completion_notes: 'E2E: owner review — job completed, all repairs done.',
    completion_photos: [PHOTO_A, PHOTO_B],
    status: 'pending',
    // Reset any forward/verification state from a PRIOR E2E run so a re-run
    // starts clean. Reviewer catch: after a successful gate run the row ends
    // as status='approved' + tenant_verification_status='pending_tenant' +
    // forwarded_to_tenant_at set. If the seed only reset status, the owner
    // review screen would treat the closure as already forwarded
    // (isTenantVerificationPending) and the Forward CTA would never render on
    // the second run. Vendor UPDATE policy (050) allows these columns.
    tenant_verification_status: 'pending_owner',
    forwarded_to_tenant_at: null,
    auto_approve_at: null,
  };

  if (closureRow?.id) {
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/closure_reports?id=eq.${closureRow.id}`, {
      method: 'PATCH',
      headers: { ...V, Prefer: 'return=representation' },
      body: JSON.stringify(closurePayload),
    });
    const rows = await upd.json().catch(() => []);
    const row = (Array.isArray(rows) ? rows : [rows]).find((r) => r?.status === 'pending');
    if (!row) throw new Error('closure_reports PATCH returned no row — vendor RLS filtered it.');
    console.log('✓ Closure report updated to pending (owner review ready)');
  } else {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/closure_reports`, {
      method: 'POST',
      headers: { ...V, Prefer: 'return=representation' },
      body: JSON.stringify(closurePayload),
    });
    const rows = await ins.json().catch(() => []);
    const row = (Array.isArray(rows) ? rows : [rows]).find((r) => r?.status === 'pending');
    if (!row) {
      throw new Error(
        'closure_reports INSERT returned no row — check migration 050 vendor insert policy (selected_vendor_id/vendor_id).'
      );
    }
    console.log('✓ Closure report created (pending — owner review ready)');
  }

  console.log('');
  console.log('✅ SEED COMPLETE — the owner maintenance detail for this request should show:');
  console.log('   • "Review Closure Report" CTA → review-closure screen');
  console.log('   • Approve & Complete / Request Changes → Approve → Forward to Tenant');
  console.log(`   Request: ${mr.id} — retitled "${SEED_TITLE}".`);
  console.log(`SEED_MR_ID=${mr.id}`);
}

main().catch((err) => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
