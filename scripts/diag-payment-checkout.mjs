// Diagnostic v3: reproduce the exact checkout call on the approved invoice
// that has a pending payment, to capture the precise error the app shows.
//
// Credentials come from env or the gitignored .env — never hardcode secrets.
// Tenant login falls back to .maestro/.env (gitignored E2E credentials).
import { env, maestroEnv } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY — set them in env or .env');
  process.exit(1);
}

const TENANT_EMAIL = env('TENANT_EMAIL') || env('E2E_TENANT_EMAIL') || maestroEnv('TENANT_EMAIL');
const TENANT_PASSWORD = env('TENANT_PASSWORD') || env('E2E_TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD');
if (!TENANT_EMAIL || !TENANT_PASSWORD) {
  console.error('❌ Missing TENANT_EMAIL / TENANT_PASSWORD — set them in env, .env, or .maestro/.env');
  process.exit(1);
}
// Placeholder sentinel — MUST be excluded from the override check below,
// because it is itself a valid-format UUID (hex digits) and would otherwise
// be mistaken for a real INVOICE_ID override.
const DEFAULT_INVOICE_ID = '5eae634f-0000-0000-0000-000000000000';
const INVOICE_ID = process.env.INVOICE_ID || DEFAULT_INVOICE_ID;

async function main() {
  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email: TENANT_EMAIL, password: TENANT_PASSWORD }),
  });
  const auth = await authRes.json();
  if (!auth.access_token) { console.log('❌ LOGIN FAILED:', JSON.stringify(auth).slice(0, 300)); process.exit(1); }
  console.log('✅ Logged in as:', auth.user.email);

  // Find the latest APPROVED tenant-payable invoice (RLS restricts to the
  // tenant's own invoices). INVOICE_ID env override wins when provided.
  const H = { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}` };
  // NOTE: auto-find can pick an invoice with a fresh in-flight pending payment,
  // in which case the checkout call returns 409 (already in progress) — the
  // error is printed below; cancel that payment via simulate-vendor-payment-itn.mjs.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const lookup =
    UUID_RE.test(INVOICE_ID) && INVOICE_ID !== DEFAULT_INVOICE_ID
      ? `id=eq.${INVOICE_ID}`
      : 'payer_role=eq.tenant&status=eq.approved&order=created_at.desc&limit=1';
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/maintenance_invoices?select=id,invoice_number,status,payer_role,total_amount,maintenance_request_id&${lookup}`,
    { headers: H }
  ).then(r => r.json());
  console.log('📄 Invoice rows:', JSON.stringify(rows, null, 2).slice(0, 600));

  if (!Array.isArray(rows) || !rows.length) { console.log('❌ invoice not found'); process.exit(1); }
  const invoice = rows[0];
  console.log('\n📄 Using invoice:', invoice.id, invoice.invoice_number, invoice.status, invoice.payer_role, 'R' + invoice.total_amount);

  const returnUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=success`;
  const cancelUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=cancelled`;

  const fnRes = await fetch(`${SUPABASE_URL}/functions/v1/create-vendor-payment-checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.access_token}` },
    body: JSON.stringify({ invoice_id: invoice.id, return_url: returnUrl, cancel_url: cancelUrl }),
  });
  const fnBody = await fnRes.json();
  console.log(`\n🔌 Edge function HTTP ${fnRes.status}`);

  // Print the FULL payfast_redirect_url (never truncated) so the diagnostic
  // output can be handed straight to a browser for a live sandbox payment.
  const fullUrl = fnBody?.payfast_redirect_url;
  if (fullUrl) {
    console.log('\n🔗 FULL PAYFAST URL:');
    console.log(fullUrl);
  }

  // Machine-readable payment id (no space after colon — grep-friendly), so
  // downstream scripts can feed it to simulate-vendor-payment-itn.mjs without
  // scraping the pretty-printed JSON below.
  if (fnBody?.payment_id) {
    console.log(`\nPAYMENT_ID=${fnBody.payment_id}`);
  }

  console.log('📦 Response:', JSON.stringify(fnBody, null, 2).slice(0, 1200));

  if (fnRes.ok) {
    console.log('\n✅ CHECKOUT OK — host:', new URL(fnBody.payfast_redirect_url).hostname);
  } else {
    console.log('\n❌ CHECKOUT FAILED — the user sees:', fnBody.error || fnBody.message || fnBody);
  }
}

main().catch(e => { console.error('Script error:', e); process.exit(1); });
