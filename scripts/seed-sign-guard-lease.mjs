#!/usr/bin/env node
/**
 * Seed a lease waiting on the tenant's signature on the lifecycle fixture
 * property, for .maestro/flows/android-lease-sign-guard.yaml. Inserted as the
 * owner through REST under RLS — the same write as the app's "Send to tenant".
 * Prints the lease id. Clean up with: node scripts/reset-lifecycle-fixture.mjs --apply
 */
import { env, maestroEnv } from './lib/load-env.mjs';

const URL_ = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const PROPERTY_ID =
  env('LC_PROPERTY_ID') || maestroEnv('LC_PROPERTY_ID') || '2ee8cfaf-f02d-491b-8947-6c49975f5732';
const cred = (role) => ({
  email: env(`${role}_EMAIL`) || maestroEnv(`${role}_EMAIL`),
  password: env(`${role}_PASSWORD`) || maestroEnv(`${role}_PASSWORD`),
});

async function login(role) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(cred(role)),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${role} login failed: ${j.error_description || r.status}`);
  return j;
}

// A 12-month lease starting on the 1st of next month, so it never goes stale.
const now = new Date();
const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), 0));
const iso = (d) => d.toISOString().slice(0, 10);

const owner = await login('OWNER');
const tenant = await login('TENANT');
const r = await fetch(`${URL_}/rest/v1/leases`, {
  method: 'POST',
  headers: {
    apikey: KEY,
    Authorization: `Bearer ${owner.access_token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({
    property_id: PROPERTY_ID,
    owner_id: owner.user.id,
    tenant_id: tenant.user.id,
    start_date: iso(start),
    end_date: iso(end),
    monthly_rent: 7500,
    deposit_amount: 15000,
    payment_due_day: 1,
    status: 'pending_tenant_signature',
  }),
});
const text = await r.text();
if (!r.ok) throw new Error(`lease insert → ${r.status} ${text.slice(0, 200)}`);
console.log(JSON.parse(text)[0].id);
