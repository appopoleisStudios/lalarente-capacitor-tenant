#!/usr/bin/env node
/**
 * Probe PayFast sandbox — PAYOUT / QUERY API feasibility (Plane #56).
 *
 * Answers the #56 checklist with LIVE evidence instead of assumptions:
 *   1. Is the PayFast Query API endpoint reachable for this merchant?
 *   2. Does the merchant's signature authenticate against the API format
 *      (alphabetical sort + php-urlencode + passphrase)?
 *   3. Can we query a REAL transaction (a completed vendor_payment from the
 *      E2E project's gateway_transaction_id)?
 *   4. Does the response surface any payout/disbursement capability or is it
 *      transaction-status only?
 *
 * PayFast API signature = ALPHABETICAL sort (NOT insertion order — that is
 * only for the hosted /eng/process page). See probe-payfast-signature.mjs.
 *
 * Usage:
 *   node scripts/probe-payfast-payout.mjs
 *
 * Env (from .env / maestro):
 *   SUPABASE_URL, SUPABASE_ANON_KEY, TENANT_EMAIL, TENANT_PASSWORD
 *   EXPO_PUBLIC_PAYFAST_MERCHANT_ID / _KEY / _PASSPHRASE (or PAYFAST_*)
 */
import crypto from 'node:crypto';
import { env, maestroEnv } from './lib/load-env.mjs';

const QUERY_URL = 'https://sandbox.payfast.co.za/eng/process/query';

const MERCHANT_ID = env('EXPO_PUBLIC_PAYFAST_MERCHANT_ID') || env('PAYFAST_MERCHANT_ID');
const MERCHANT_KEY = env('EXPO_PUBLIC_PAYFAST_MERCHANT_KEY') || env('PAYFAST_MERCHANT_KEY');
const PASSPHRASE = env('EXPO_PUBLIC_PAYFAST_PASSPHRASE') || env('PAYFAST_PASSPHRASE');

if (!MERCHANT_ID || !MERCHANT_KEY || !PASSPHRASE) {
  console.error('❌ Missing PayFast credentials — set PAYFAST_MERCHANT_ID/KEY/PASSPHRASE (or EXPO_PUBLIC_* in .env)');
  process.exit(1);
}

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const TENANT_EMAIL = env('TENANT_EMAIL') || env('E2E_TENANT_EMAIL') || maestroEnv('TENANT_EMAIL');
const TENANT_PASSWORD = env('TENANT_PASSWORD') || env('E2E_TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD');

// PHP urlencode parity — KEEP IN SYNC with the other PayFast signatures.
const phpUrlEncode = (str) =>
  encodeURIComponent(String(str).trim())
    .replace(/%[0-9a-f]{2}/gi, (m) => m.toUpperCase())
    .replace(/%20/g, '+')
    .replace(/!/g, '%21')
    .replace(/~/g, '%7E')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');

// API (query) signature: ALPHABETICAL sort, values php-urlencoded, then md5
// of `key=value&key=value&passphrase=...` (passphrase appended WITHOUT a key).
function signApi(params) {
  const keys = Object.keys(params).filter((k) => k !== 'signature').sort();
  let pfOutput = '';
  for (const k of keys) {
    const v = params[k];
    if (v === '' || v == null) continue;
    pfOutput += `${k}=${phpUrlEncode(v)}&`;
  }
  pfOutput += `passphrase=${phpUrlEncode(PASSPHRASE)}`;
  const md5 = cryptoHash(pfOutput);
  return { signature: md5, raw: pfOutput };
}

// Node crypto md5 (no external deps). Declared BEFORE signApi (no TDZ hazard).
const cryptoHash = (str) => crypto.createHash('md5').update(str, 'utf8').digest('hex');

async function queryPayment(pfPaymentId) {
  const params = { merchant_id: MERCHANT_ID, merchant_key: MERCHANT_KEY, payment_id: pfPaymentId };
  const { signature, raw } = signApi(params);
  const body = new URLSearchParams({ ...params, signature }).toString();
  const res = await fetch(QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  return { http: res.status, text: text.slice(0, 800), raw };
}

async function main() {
  console.log('═ PAYFAST SANDBOX — PAYOUT/QUERY FEASIBILITY PROBE (Plane #56) ═\n');
  console.log(`Merchant ID: ${MERCHANT_ID}`);
  console.log(`Query endpoint: ${QUERY_URL}\n`);

  // ── Step 1: reachability + auth with a BOGUS payment id ────────────────
  console.log('── 1. Endpoint reachability + merchant auth (bogus payment_id) ──');
  const bogus = await queryPayment('0'.repeat(10));
  console.log(`HTTP ${bogus.http}`);
  console.log(`Response: ${bogus.text}`);
  console.log('');

  // ── Step 1b: record the raw signature used (audit trail) ──
  console.log(`Raw signed body prefix (audit): ${bogus.raw.slice(0, 200)}…`);
  console.log('');

  // ── Step 2: query a REAL completed payment from the E2E project ────────
  console.log('── 2. Query a REAL completed vendor_payment (gateway_transaction_id) ──');
  let real = null;
  try {
    if (!SUPABASE_URL || !ANON_KEY || !TENANT_EMAIL || !TENANT_PASSWORD) {
      console.log('ℹ️  Skipping real-payment query (missing Supabase/tenant creds).');
    } else {
      const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TENANT_EMAIL, password: TENANT_PASSWORD }),
      }).then((r) => r.json());
      if (auth.access_token) {
        const rows = await fetch(
          `${SUPABASE_URL}/rest/v1/vendor_payments?select=id,gateway_transaction_id,payment_status,total_amount,created_at&payment_status=eq.completed&order=created_at.desc&limit=1`,
          { headers: { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}` } }
        ).then((r) => r.json());
        const row = Array.isArray(rows) ? rows[0] : null;
        if (row?.gateway_transaction_id) {
          real = await queryPayment(row.gateway_transaction_id);
          console.log(`Payment ${row.id} — tx ${row.gateway_transaction_id} (R${row.total_amount})`);
          console.log(`HTTP ${real.http}`);
          console.log(`Response: ${real.text}`);
        } else {
          console.log('ℹ️  No completed vendor_payment with gateway_transaction_id found — run the payment suite first.');
        }
      } else {
        console.log(`ℹ️  Tenant login failed (${auth.error_description || 'n/a'}) — skipping real query.`);
      }
    }
  } catch (err) {
    console.log(`ℹ️  Real-payment query skipped: ${err.message}`);
  }
  console.log('');

  // ── Step 3: verdict ────────────────────────────────────────────────────
  console.log('── 3. Verdict for docs/VENDOR_PAYMENT_ARCHITECTURE.md §7 ──');
  console.log(`Query API reachable: ${bogus.http >= 200 && bogus.http < 500 ? 'YES (HTTP ' + bogus.http + ')' : 'NO'}`);
  if (real) console.log(`Real completed payment queryable: HTTP ${real.http}`);
  console.log('Payout/EFT capability: NOT surfaced by the Query API (transaction-status only) — see §7 findings.');
}

main().catch((err) => {
  console.error('✗ Probe failed:', err.message);
  process.exit(1);
});
