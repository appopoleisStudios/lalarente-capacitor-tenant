#!/usr/bin/env node
/**
 * Seed: put the E2E tenant's most recent maintenance request into the exact
 * state that surfaces BOTH newly-shipped screens:
 *
 *   A. TenantMaintenanceDetailScreen "Confirm Completed Work" CTA (Plane #61,
 *      PR #114) — shown when a closure_reports row has vendor_confirmed_at set
 *      and tenant_verification_status is NOT 'tenant_approved'/'pending_tenant'.
 *   B. TenantClosureConfirmScreen (/maintenance/closure-confirm, PR #114) with
 *      the vendor's after-photos + notes rendered (testIDs added in the same PR).
 *   C. Tenant timeline progress photo (Plane #61, PR #115) — the detail screen
 *      surfaces progressUpdates[0].photos in the Progress Updates card.
 *
 * All writes mirror the app's OWN RLS-valid calls so the seed can never pass
 * while the app is broken:
 *   - closure_reports insert/update via the VENDOR token (migration 050 vendor
 *     policy: selected_vendor_id OR vendor_id = auth.uid()).
 *   - maintenance_requests.closure_requested_at + status via the VENDOR token
 *     (same path vendorRequestClosureWithPhotos uses).
 *   - job_progress_updates insert via the VENDOR token (same path
 *     addProgressNote uses).
 *
 * Usage:
 *   node scripts/seed-tenant-closure-confirm.mjs
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
  const tenant = await login(TENANT_EMAIL, TENANT_PASSWORD);
  const vendor = await login(VENDOR_EMAIL, VENDOR_PASSWORD);
  const owner = await login(OWNER_EMAIL, OWNER_PASSWORD);
  const tenantId = tenant.user.id;
  const vendorId = vendor.user.id;
  const ownerId = owner.user.id;
  const V = headers(vendor.access_token);
  const O = headers(owner.access_token);
  console.log('✓ Logged in as tenant + vendor + owner');

  // 1. Find the tenant's most recent request (ANY vendor assignment). The
  //    closure RLS (migration 050) requires the VENDOR to be assigned, so if
  //    the request has no vendor yet we assign via the OWNER token (owner
  //    update policy: owner_id = auth.uid()) — mirroring how owners assign
  //    vendors in the app. This makes the seed self-sufficient: it does NOT
  //    depend on a prior vendor-quote Maestro run.
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

  // 1b. If the E2E vendor is NOT the assigned vendor, assign via the OWNER
  //     token. Check "assigned to THIS vendor", not "any vendor": a prior
  //     real/seed flow may have left a different vendor attached, and the
  //     vendor-token writes below would then silently RLS-filter to zero rows.
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

  // 2. Vendor token: set the request into closure-awaiting state (mirrors
  //    vendorRequestClosureWithPhotos: status must be in_progress + it stamps
  //    closure_requested_at). Also give the request a DETERMINISTIC title so the
  //    Maestro flow can tap it by text (index-0 ordering is fragile when the
  //    tenant has multiple requests). Verify with return=representation so an
  //    RLS silent-filter can never pass.
  const SEED_TITLE = 'E2E Closure Confirm';
  const reqRes = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?id=eq.${mr.id}`,
    {
      method: 'PATCH',
      headers: { ...V, Prefer: 'return=representation' },
      body: JSON.stringify({
        status: 'in_progress',
        closure_requested_at: now,
        title: SEED_TITLE,
      }),
    }
  );
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

  // 3. Vendor token: upsert the closure report with after-work photos +
  //    vendor confirmation. Mirrors vendorRequestClosureWithPhotos exactly.
  const closureRes = await fetch(
    `${SUPABASE_URL}/rest/v1/closure_reports?select=id,vendor_confirmed_at,tenant_verification_status,vendor_after_photos&maintenance_request_id=eq.${mr.id}&order=vendor_confirmed_at.desc.nullslast&limit=1`,
    { headers: V }
  );
  const existing = await closureRes.json().catch(() => []);
  const closureRow = Array.isArray(existing) ? existing[0] : null;

  const closurePayload = {
    maintenance_request_id: mr.id,
    vendor_after_photos: [PHOTO_A, PHOTO_B],
    vendor_closure_notes: 'E2E: job completed — all repairs done, tenant to confirm.',
    vendor_confirmed_at: now,
    status: 'pending',
    tenant_verification_status: 'pending_owner',
  };

  if (closureRow?.id) {
    const upd = await fetch(
      `${SUPABASE_URL}/rest/v1/closure_reports?id=eq.${closureRow.id}`,
      {
        method: 'PATCH',
        headers: { ...V, Prefer: 'return=representation' },
        body: JSON.stringify(closurePayload),
      }
    );
    const rows = await upd.json().catch(() => []);
    const row = (Array.isArray(rows) ? rows : [rows]).find((r) => r?.vendor_confirmed_at);
    if (!row) throw new Error('closure_reports PATCH returned no row — vendor RLS filtered it.');
    console.log('✓ Closure report updated (vendor confirmed with after-photos)');
  } else {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/closure_reports`, {
      method: 'POST',
      headers: { ...V, Prefer: 'return=representation' },
      body: JSON.stringify(closurePayload),
    });
    const rows = await ins.json().catch(() => []);
    const row = (Array.isArray(rows) ? rows : [rows]).find((r) => r?.vendor_confirmed_at);
    if (!row) {
      throw new Error(
        'closure_reports INSERT returned no row — check migration 050 vendor insert policy (selected_vendor_id/vendor_id).'
      );
    }
    console.log('✓ Closure report created (vendor confirmed with after-photos)');
  }

  // 4. Vendor token: progress update WITH photos for the tenant timeline
  //    (Plane #61 / PR #115 — the detail screen surfaces progressUpdates[0]).
  //    IDEMPOTENT: the table has a unique index (idx_job_progress_updates_unique
  //    on maintenance_request_id, likely per day) — a prior run leaves a row, so
  //    INSERT 409s. Select-then-update: find the existing row and refresh its
  //    photos/notes instead of duplicating.
  const pSelect = await fetch(
    `${SUPABASE_URL}/rest/v1/job_progress_updates?select=id&maintenance_request_id=eq.${mr.id}&order=created_at.desc&limit=1`,
    { headers: V }
  );
  const pExisting = await pSelect.json().catch(() => []);
  const pExistingRow = Array.isArray(pExisting) ? pExisting[0] : null;
  const pPayload = {
    maintenance_request_id: mr.id,
    vendor_id: vendorId,
    update_date: now.slice(0, 10),
    notes: 'E2E: work 80% complete — finishing touches.',
    photos: [PHOTO_A],
  };

  if (pExistingRow?.id) {
    const upd = await fetch(
      `${SUPABASE_URL}/rest/v1/job_progress_updates?id=eq.${pExistingRow.id}`,
      {
        method: 'PATCH',
        headers: { ...V, Prefer: 'return=representation' },
        body: JSON.stringify(pPayload),
      }
    );
    const updRows = await upd.json().catch(() => []);
    const updRow = (Array.isArray(updRows) ? updRows : [updRows]).find(
      (r) => r?.id === pExistingRow.id
    );
    if (!updRow) {
      throw new Error('job_progress_updates PATCH returned no row — vendor update RLS-filtered.');
    }
    console.log('✓ Progress update refreshed with photo (idempotent — reused existing row)');
  } else {
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/job_progress_updates`, {
      method: 'POST',
      headers: { ...V, Prefer: 'return=representation' },
      body: JSON.stringify(pPayload),
    });
    const pRows = await pRes.json().catch(() => []);
    const pRow = Array.isArray(pRows) ? pRows[0] : pRows;
    if (pRow?.id) {
      console.log('✓ Progress update with photo inserted (timeline photo will render)');
    } else {
      throw new Error(
        'job_progress_updates INSERT returned no row — vendor progress-insert failed. ' +
        'Check the job_progress_updates RLS policies.'
      );
    }
  }

  console.log('');
  console.log('✅ SEED COMPLETE — the tenant detail screen should now show:');
  console.log('   • "Confirm Completed Work" CTA (closure-confirm)');
  console.log('   • Progress Updates card with the E2E photo');
  console.log(`   Request: ${mr.id} — tap "${SEED_TITLE}" in the tenant list.`);
}

main().catch((err) => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
