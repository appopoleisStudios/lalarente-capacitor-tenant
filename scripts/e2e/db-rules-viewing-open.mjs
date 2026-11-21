#!/usr/bin/env node
/**
 * Release-gate database check, run by run-lifecycle-e2e.sh right after
 * lifecycle-02a (the fixture tenant's viewing is approved and still ahead).
 * As the tenant, through RLS, the database must refuse:
 *  - CT7-030: a second open viewing request for the same property
 *    (unique index uq_viewing_requests_open_per_tenant_property)
 *  - CT7-032: an application while that viewing is still ahead
 *    (trigger trg_guard_apply_after_viewing)
 * A refused insert stores nothing. If one is ever accepted, the row is
 * cancelled/withdrawn here and the check fails (fixture reset cleans up too).
 */
import { login, call, get, expectRefused } from './fixture-api.mjs';

const PROPERTY = process.env.LC_PROPERTY_ID;
if (!PROPERTY) throw new Error('LC_PROPERTY_ID is required');

const tenant = await login('TENANT');
// APPROVED, not pending: an older index (idx_viewing_requests_unique_pending)
// also refuses a second PENDING request, which would hide a missing CT7-030 index.
const open = await get(
  tenant,
  `viewing_requests?select=id,owner_id,confirmed_date,requested_date,status&property_id=eq.${PROPERTY}&tenant_id=eq.${tenant.id}&status=in.(pending,approved)`
);
if (open.length !== 1 || open[0].status !== 'approved')
  throw new Error(`setup: expected exactly 1 open viewing, approved; found ${JSON.stringify(open.map((v) => v.status))}`);
const ahead = new Date(open[0].confirmed_date || `${open[0].requested_date}T23:59:59+02:00`);
if (!(ahead > new Date())) throw new Error('setup: the open viewing is not in the future');
const owner_id = open[0].owner_id;
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

let failure = null;

/** The database accepted a row it should have refused: close it again, and
 *  say so loudly if that fails (the fixture reset doesn't cover it). */
async function undo(res, table, status) {
  if (!res.ok) return; // refused for another reason: nothing was stored
  for (const row of [].concat(res.body || [])) {
    if (!row?.id) continue;
    const r = await call(tenant, 'PATCH', `${table}?id=eq.${row.id}`, { status });
    const done = r.ok && Array.isArray(r.body) && r.body.length === 1 && r.body[0].status === status;
    console.error(
      done
        ? `  undone: ${table} ${row.id.slice(0, 8)} → ${status}`
        : `  ✗ CLEANUP FAILED: ${table} ${row.id} is still open — remove it by hand`
    );
  }
}

const dup = await call(tenant, 'POST', 'viewing_requests', {
  property_id: PROPERTY,
  tenant_id: tenant.id,
  owner_id,
  requested_date: tomorrow,
  requested_time: '10:00',
  status: 'pending',
});
try {
  expectRefused('CT7-030 second open viewing', dup, {
    code: '23505',
    message: /uq_viewing_requests_open_per_tenant_property/,
  });
} catch (e) {
  failure = e;
  await undo(dup, 'viewing_requests', 'cancelled');
}

const app = await call(tenant, 'POST', 'rental_applications', {
  property_id: PROPERTY,
  tenant_id: tenant.id,
  owner_id,
  status: 'draft',
  full_name: 'E2E db-rule check',
});
try {
  expectRefused('CT7-032 application before the viewing', app, {
    code: 'P0001',
    message: /once your scheduled viewing/,
  });
} catch (e) {
  failure = failure || e;
  await undo(app, 'rental_applications', 'withdrawn');
}

if (failure) {
  console.error(`✗ ${failure.message}`);
  process.exit(1);
}
