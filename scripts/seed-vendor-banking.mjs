#!/usr/bin/env node
/**
 * Seed deterministic vendor payout preferences for the E2E vendor (Plane #52).
 *
 * Uses the REAL save-vendor-payout-preferences edge function so the Maestro
 * earnings/banking flow has stable pre-filled values to assert against and a
 * valid row to update (idempotent: upserts on vendor_id).
 *
 * Usage: node scripts/seed-vendor-banking.mjs
 * Env:   SUPABASE_URL/SUPABASE_ANON_KEY (+ VENDOR creds from env/.env/.maestro/.env)
 */
import { env, maestroEnv } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const VENDOR_EMAIL = env('VENDOR_EMAIL') || env('E2E_VENDOR_EMAIL') || maestroEnv('VENDOR_EMAIL');
const VENDOR_PASSWORD = env('VENDOR_PASSWORD') || env('E2E_VENDOR_PASSWORD') || maestroEnv('VENDOR_PASSWORD');

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY — set them in env or .env');
  process.exit(1);
}
if (!VENDOR_EMAIL || !VENDOR_PASSWORD) {
  console.error('❌ Missing VENDOR_EMAIL / VENDOR_PASSWORD — set them in env, .env, or .maestro/.env');
  process.exit(1);
}

async function main() {
  // 1. Login as vendor
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: VENDOR_EMAIL, password: VENDOR_PASSWORD }),
  }).then((r) => r.json());
  if (!auth.access_token) {
    console.error(`❌ Vendor login failed: ${auth.error_description || JSON.stringify(auth)}`);
    process.exit(1);
  }

  // 2. Save preferences via the REAL edge function (idempotent upsert)
  const res = await fetch(`${SUPABASE_URL}/functions/v1/save-vendor-payout-preferences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schedule: 'weekly',
      bank_account_name: 'E2E Vendor (Maestro)',
      bank_name: 'First National Bank',
      branch_code: '255005',
      account_number: '62841728093',
      account_type: 'cheque',
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error(`❌ save-vendor-payout-preferences failed (HTTP ${res.status}): ${JSON.stringify(body).slice(0, 500)}`);
    process.exit(1);
  }
  if (!body.account_number_masked) {
    console.error(`❌ Save returned no masked account number — PAYOUT_ENCRYPTION_KEY missing on live? ${JSON.stringify(body).slice(0, 300)}`);
    process.exit(1);
  }

  console.log(`✅ Payout preferences seeded: schedule=${body.schedule} bank=${body.bank_name} acct=${body.account_number_masked}`);
}

main().catch((e) => {
  console.error('✗ Seed failed:', e.message);
  process.exit(1);
});
