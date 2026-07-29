#!/usr/bin/env node
/**
 * T0 Verification Script: Tenant-Direct Vendor Visibility
 * 
 * Verifies that a vendor can discover maintenance requests with visibility='public'.
 * Tests actual API endpoints the app uses, not database directly.
 *
 * PREREQUISITE: A maintenance request with title containing "T0 E2E Test" and
 * visibility='public' must exist. Run: node tmp/create-t0-request.mjs
 *
 * Usage: node scripts/verify-t0-vendor-visibility.mjs
 * 
 * Reads credentials from:
 *   1. Environment variables (VENDOR_E2E_EMAIL, VENDOR_E2E_PASSWORD)
 *   2. .maestro/.env file
 *
 * Exits with code 0 on success, 1 on failure.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const MAESTRO_ENV = resolve(PROJECT_ROOT, '.maestro/.env');

// Load .maestro/.env
function loadEnv() {
  const env = {};
  try {
    if (existsSync(MAESTRO_ENV)) {
      const content = readFileSync(MAESTRO_ENV, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) env[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
        }
      }
    }
  } catch (e) {
    console.warn(`⚠️  Failed to parse ${MAESTRO_ENV}: ${e.message}`);
  }
  return env;
}

const env = loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const VENDOR_EMAIL = process.env.VENDOR_E2E_EMAIL || env.VENDOR_E2E_EMAIL;
const VENDOR_PASSWORD = process.env.VENDOR_E2E_PASSWORD || env.VENDOR_E2E_PASSWORD;

const missing = [];
if (!SUPABASE_URL) missing.push('SUPABASE_URL');
if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY');
if (!VENDOR_EMAIL) missing.push('VENDOR_E2E_EMAIL');
if (!VENDOR_PASSWORD) missing.push('VENDOR_E2E_PASSWORD');
if (missing.length > 0) {
  console.error(`\n❌ Missing environment variables: ${missing.join(', ')}`);
  console.error('   Set them in your environment or add to .maestro/.env');
  console.error('   Example .maestro/.env entries:');
  console.error('     SUPABASE_URL=https://your-project.supabase.co');
  console.error('     SUPABASE_ANON_KEY=your-anon-key');
  console.error('     VENDOR_E2E_EMAIL=e2e-vendor@example.com');
  console.error('     VENDOR_E2E_PASSWORD=your-password\n');
  process.exit(1);
}

let passed = 0;
let failed = 0;

function test(name, condition, detail) {
  if (condition) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`); failed++; }
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data;
}

async function restQuery(url, token) {
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` }
  });
  return await res.json();
}

async function main() {
  console.log('\n🔍 T0: Tenant-Direct Vendor Visibility Verification');
  console.log('='.repeat(60));

  // 1. Sign in as vendor
  console.log('\n📋 Test 1: Vendor Authentication');
  let vendor;
  try {
    vendor = await signIn(VENDOR_EMAIL, VENDOR_PASSWORD);
    test('Vendor sign-in succeeds', !!vendor.access_token);
  } catch (e) {
    test('Vendor sign-in succeeds', false, e.message);
    process.exit(1);
  }

  // 2. Verify test request exists (prerequisite)
  console.log('\n📋 Test 2: Test Request Exists');
  const existingReqs = await restQuery(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?select=id,title,visibility,status&title=like.*T0 E2E*&limit=1`,
    vendor.access_token
  );
  
  const hasTestRequest = Array.isArray(existingReqs) && existingReqs.length > 0;
  test('T0 test request exists in database', hasTestRequest);
  if (!hasTestRequest) {
    console.log('\n⚠️  No T0 test request found. Create one first:');
    console.log('   node /tmp/create-t0-request.mjs\n');
  }

  // 3. Verify the specific T0 request is accessible via RLS
  console.log('\n📋 Test 3: Request Accessible via Vendor RLS');
  if (hasTestRequest) {
    const reqId = existingReqs[0].id;
    const req = await restQuery(
      `${SUPABASE_URL}/rest/v1/maintenance_requests?id=eq.${reqId}`,
      vendor.access_token
    );
    test('T0 request accessible to vendor', Array.isArray(req) && req.length > 0);
    if (Array.isArray(req) && req.length > 0) {
      test('Visibility is public', req[0].visibility === 'public');
      test('Status is open', req[0].status === 'open');
      console.log(`\n    ID: ${req[0].id}`);
      console.log(`    Title: ${req[0].title}`);
      console.log(`    Visibility: ${req[0].visibility}`);
      console.log(`    Status: ${req[0].status}`);
    }
  }

  // 4. Verify vendor can list open public requests
  console.log('\n📋 Test 4: Vendor Can List Public Requests');
  const allOpen = await restQuery(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?select=id,title,visibility,status&status=eq.open&limit=20&order=created_at.desc`,
    vendor.access_token
  );
  test('Open requests queryable', Array.isArray(allOpen));
  if (Array.isArray(allOpen)) {
    const publicList = allOpen.filter(r => r.visibility === 'public');
    test('Public open requests visible', publicList.length > 0, `Found ${publicList.length}`);
    console.log(`\n    Total open requests: ${allOpen.length}`);
    console.log(`    Public open requests: ${publicList.length}`);
  }

  // 5. Verify invited requests NOT visible (RLS negative check)
  console.log('\n📋 Test 5: Invited Requests Correctly Filtered (RLS Negative Check)');
  const invited = await restQuery(
    `${SUPABASE_URL}/rest/v1/maintenance_requests?select=id,visibility&visibility=eq.invited&limit=10`,
    vendor.access_token
  );
  if (Array.isArray(invited)) {
    test('Invited requests filtered when no quote request', invited.length === 0, `Found ${invited.length}`);
  } else {
    test('Invited query returns array', false);
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed === 0) {
    console.log('✅ T0 VERIFICATION PASSED: Vendor can discover public maintenance requests.\n');
    process.exit(0);
  } else {
    console.log('❌ T0 VERIFICATION FAILED: Some checks did not pass.\n');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('\n💥 Script error:', e.message);
  process.exit(1);
});
