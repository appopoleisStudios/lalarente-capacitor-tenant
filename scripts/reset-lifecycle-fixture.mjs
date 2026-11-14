#!/usr/bin/env node
/**
 * Reset the lifecycle E2E fixture (B9-008) so scripts/run-lifecycle-e2e.sh can
 * run from lifecycle-01 again.
 *
 * Every live record on the fixture properties is moved to a terminal status
 * through the REST API, signed in as the party the app would use (owner or
 * tenant) — the same writes the app makes, under RLS. Nothing is deleted, so
 * history stays auditable. Then the properties are made available again.
 *
 * Usage:
 *   node scripts/reset-lifecycle-fixture.mjs           # dry run: show what would change
 *   node scripts/reset-lifecycle-fixture.mjs --apply   # make the changes
 *
 * Fixture ids default to the runner's (LC_PROPERTY_ID, LC_BRANCH_PROPERTY_ID);
 * credentials come from env / .env / .maestro/.env.
 */
import { env, maestroEnv } from './lib/load-env.mjs';

const APPLY = process.argv.includes('--apply');
const URL_ = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const PROPERTY_IDS = [
  env('LC_PROPERTY_ID') || maestroEnv('LC_PROPERTY_ID') || '2ee8cfaf-f02d-491b-8947-6c49975f5732',
  env('LC_BRANCH_PROPERTY_ID') ||
    maestroEnv('LC_BRANCH_PROPERTY_ID') ||
    '53ac13a1-ad41-45da-a9ff-2c8b7083ad74',
];
const cred = (role) => ({
  email: env(`${role}_EMAIL`) || maestroEnv(`${role}_EMAIL`),
  password: env(`${role}_PASSWORD`) || maestroEnv(`${role}_PASSWORD`),
});

// table → [statuses that are still "live", terminal status, who may set it]
const RESETS = [
  ['viewing_requests', ['pending', 'approved'], 'cancelled', 'tenant'],
  [
    'rental_applications',
    ['submitted', 'under_review', 'pending_verification', 'approved', 'lease_offered'],
    'withdrawn',
    'tenant',
  ],
  ['holding_deposits', ['pending', 'paid'], 'refunded', 'owner'],
  ['inspections', ['scheduled', 'in_progress', 'pending_signatures'], 'cancelled', 'owner'],
  ['maintenance_requests', ['open', 'assigned', 'in_progress'], 'closed', 'owner'],
  [
    'leases',
    ['draft', 'pending_tenant_signature', 'pending_owner_signature', 'active'],
    'terminated',
    'owner',
  ],
];

async function login(role) {
  const { email, password } = cred(role);
  if (!email || !password) throw new Error(`Missing ${role}_EMAIL / ${role}_PASSWORD`);
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${role} login failed: ${j.error_description || r.status}`);
  return j.access_token;
}

async function rest(token, method, path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  if (!URL_ || !KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_ANON_KEY');
  const tokens = { owner: await login('OWNER'), tenant: await login('TENANT') };
  console.log(APPLY ? 'Applying reset…' : 'Dry run (pass --apply to change data)');
  let failures = 0;

  for (const pid of PROPERTY_IDS) {
    const [prop] = await rest(tokens.owner, 'GET', `properties?select=title,status&id=eq.${pid}`);
    console.log(`\n${prop?.title ?? pid} (status: ${prop?.status})`);

    for (const [table, live, terminal, role] of RESETS) {
      // Filter client-side: `status=in.(…)` 400s on enum columns if a listed
      // status isn't a member of that enum.
      const rows = (
        await rest(tokens.owner, 'GET', `${table}?select=id,status&property_id=eq.${pid}`)
      ).filter((r) => live.includes(r.status));
      for (const row of rows) {
        const label = `  ${table} ${row.id.slice(0, 8)} ${row.status} → ${terminal} (as ${role})`;
        if (!APPLY) {
          console.log(label);
          continue;
        }
        try {
          const out = await rest(tokens[role], 'PATCH', `${table}?id=eq.${row.id}`, {
            status: terminal,
          });
          if (!out?.length) throw new Error('no row updated (RLS)');
          console.log(`${label} ✓`);
        } catch (e) {
          failures++;
          console.log(`${label} ✗ ${e.message}`);
        }
      }
    }

    if (prop && prop.status !== 'available') {
      const label = `  property status ${prop.status} → available`;
      if (!APPLY) console.log(label);
      else {
        try {
          await rest(tokens.owner, 'PATCH', `properties?id=eq.${pid}`, { status: 'available' });
          console.log(`${label} ✓`);
        } catch (e) {
          failures++;
          console.log(`${label} ✗ ${e.message}`);
        }
      }
    }
  }
  console.log(failures ? `\n${failures} change(s) failed` : '\nDone.');
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(`❌ ${e.message}`);
  process.exit(1);
});
