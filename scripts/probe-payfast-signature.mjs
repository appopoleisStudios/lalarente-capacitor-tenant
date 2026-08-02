#!/usr/bin/env node
/**
 * Probe PayFast sandbox — confirms the hosted-checkout signature algorithm.
 *
 * Root cause of the 400 "signature does not match" (resolved):
 *   Custom /eng/process uses INSERTION order (PayFast attribute / PHP sample).
 *   Alphabetical sort is the *API* format and always 400s the hosted page.
 *
 * Live proof (merchant + passphrase from .env):
 *   insertion-order → HTTP 302 (payment page)
 *   alphabetical     → HTTP 400 signature mismatch
 *
 * Usage:
 *   node scripts/probe-payfast-signature.mjs   # creds from env or .env
 */
import crypto from 'node:crypto';
import { env } from './lib/load-env.mjs';

const FORM_ACTION = 'https://sandbox.payfast.co.za/eng/process';
// Credentials come from env or the gitignored .env — never hardcode secrets.
const MERCHANT_ID = env('EXPO_PUBLIC_PAYFAST_MERCHANT_ID') || env('PAYFAST_MERCHANT_ID');
const MERCHANT_KEY = env('EXPO_PUBLIC_PAYFAST_MERCHANT_KEY') || env('PAYFAST_MERCHANT_KEY');
const PASSPHRASE = env('EXPO_PUBLIC_PAYFAST_PASSPHRASE') || env('PAYFAST_PASSPHRASE');

if (!MERCHANT_ID || !MERCHANT_KEY || !PASSPHRASE) {
  console.error('❌ Missing PayFast credentials — set PAYFAST_MERCHANT_ID/KEY/PASSPHRASE (or EXPO_PUBLIC_* in .env)');
  process.exit(1);
}

// PHP urlencode parity: space → '+', hex UPPERCASE, and PHP's urlencode()
// ALSO encodes the chars encodeURIComponent leaves unescaped (! ~ * ' ( )).
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

function signInsertionOrder(params, passphrase) {
  let pfOutput = '';
  for (const [k, v] of Object.entries(params)) {
    if (k === 'signature') continue;
    if (v === '' || v == null) continue;
    pfOutput += `${k}=${phpUrlEncode(v)}&`;
  }
  let s = pfOutput.slice(0, -1);
  if (passphrase) s += `&passphrase=${phpUrlEncode(passphrase)}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

function signAlphabetical(params, passphrase) {
  const sorted = Object.fromEntries(
    Object.entries(params)
      .filter(([k, v]) => k !== 'signature' && v !== '' && v != null)
      .sort(([a], [b]) => a.localeCompare(b))
  );
  return signInsertionOrder(sorted, passphrase);
}

// Attribute order matching create-vendor-payment-checkout + PayFast PHP sample
const baseParams = {
  merchant_id: MERCHANT_ID,
  merchant_key: MERCHANT_KEY,
  return_url:
    'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/vendor-payment-redirect?status=success',
  cancel_url:
    'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/vendor-payment-redirect?status=cancelled',
  notify_url:
    'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1/payment-webhook',
  name_first: 'Navin',
  name_last: 'Indraj',
  email_address: 'navin.indraj@yahoo.com',
  m_payment_id: `probe-${Date.now()}`,
  amount: '10.00',
  item_name: 'Maintenance probe',
};

async function post(label, params) {
  const res = await fetch(FORM_ACTION, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
    redirect: 'manual',
  });
  const body = await res.text();
  const snip = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
  console.log(`${label} → HTTP ${res.status} | ${snip}`);
}

const good = { ...baseParams, signature: signInsertionOrder(baseParams, PASSPHRASE) };
const bad = { ...baseParams, signature: signAlphabetical(baseParams, PASSPHRASE) };

await post('INSERTION order (correct)', good);
await post('ALPHABETICAL sort (old bug)', bad);
