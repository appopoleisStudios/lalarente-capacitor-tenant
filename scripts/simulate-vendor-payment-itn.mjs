#!/usr/bin/env node
/**
 * Simulate a signed PayFast ITN for a VENDOR payment.
 *
 * Used by tests to drive a `vendor_payments` row through the real webhook
 * path (payment-webhook edge function) — e.g. to cancel a stale pending row
 * that blocks a fresh checkout, or to verify webhook signature handling.
 *
 * Signature is computed with the EXACT algorithm the webhook verifies:
 *   - params in INSERTION / POST arrival order (NOT alphabetical — that is the
 *     API format and rejects hosted-checkout + real PayFast ITNs)
 *   - phpUrlEncode (space → '+', hex UPPERCASE, '*' left as-is)
 *   - `&passphrase=` appended (phpUrlEncode'd)
 *   - md5
 *
 * Usage:
 *   PAYFAST_PASSPHRASE=<passphrase> node scripts/simulate-vendor-payment-itn.mjs \
 *     <payment_id> cancelled 977.50
 *
 * ⚠️ amount_gross MUST equal the vendor_payments.total_amount for that row.
 *   A mismatch makes the webhook mark the payment 'failed' (AMOUNT_MISMATCH)
 *   rather than 'cancelled' — a stale amount can nuke a pending row into
 *   failed instead of clearing it.
 *
 * Env:
 *   PAYFAST_PASSPHRASE — passphrase (falls back to EXPO_PUBLIC_PAYFAST_PASSPHRASE from .env)
 *   SUPABASE_URL       — defaults to https://vvepwaolnkzfzhzgxlwr.supabase.co
 */
import crypto from 'node:crypto';
import { env } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL — set it in env or .env');
  process.exit(1);
}
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/payment-webhook`;

// NOTE: payment-webhook was redeployed with --no-verify-jwt (required so
// real PayFast ITNs — server-to-server POSTs with no Supabase auth header —
// are accepted). The apikey/Authorization headers below are therefore
// optional belt-and-suspenders; they are harmless and kept for safety.
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!ANON_KEY) {
  console.error('❌ Missing SUPABASE_ANON_KEY — set it in env or .env');
  process.exit(1);
}

const [paymentId, status, amountGross] = process.argv.slice(2);
if (!paymentId || !status || !amountGross) {
  console.error('Usage: simulate-vendor-payment-itn.mjs <payment_id> <status> <amount_gross>');
  process.exit(1);
}

// phpUrlEncode: PHP urlencode parity (space → '+', hex UPPERCASE, and PHP's
// urlencode() ALSO encodes ! ~ * ' ( ) which encodeURIComponent leaves as-is).
// ⚠️ KEEP IN SYNC with supabase/functions/create-vendor-payment-checkout
// and payment-webhook (duplicated byte-for-byte). Edit all copies together.
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

function getPassphrase() {
  return env('PAYFAST_PASSPHRASE') || env('EXPO_PUBLIC_PAYFAST_PASSPHRASE');
}

function computeSignature(params, passphrase) {
  // Insertion order — matches checkout + webhook + PayFast PHP sample.
  let pfOutput = '';
  for (const [k, v] of Object.entries(params)) {
    if (k === 'signature') continue;
    if (v === '' || v == null) continue;
    pfOutput += `${k}=${phpUrlEncode(v)}&`;
  }
  let stringToHash = pfOutput.slice(0, -1);
  if (passphrase) {
    stringToHash += `&passphrase=${phpUrlEncode(passphrase)}`;
  }
  return crypto.createHash('md5').update(stringToHash).digest('hex');
}

async function main() {
  const passphrase = getPassphrase();
  if (!passphrase) {
    console.error('❌ No PAYFAST_PASSPHRASE found (env or .env)');
    process.exit(1);
  }

  // Minimal set of fields the webhook reads for vendor payments
  const params = {
    m_payment_id: paymentId,
    pf_payment_id: `sim-${Date.now()}`,
    payment_status: status,
    amount_gross: String(amountGross),
    fee: '0',
  };
  params.signature = computeSignature(params, passphrase);

  const body = new URLSearchParams(params).toString();

  console.log(`📤 Simulating ${status} ITN for vendor payment ${paymentId} (R${amountGross})`);
  console.log(`   signature=${params.signature}`);

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body,
  });
  const text = await res.text();
  console.log(`🔌 Webhook HTTP ${res.status} — body: ${text}`);
}

main().catch((e) => { console.error('Script error:', e); process.exit(1); });
