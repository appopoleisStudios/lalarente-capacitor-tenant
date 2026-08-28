#!/usr/bin/env node
/**
 * LAL-122 — Continue one live job after Maestro raise → quote → tenant PO → start.
 *
 * Walks the same REQUEST_TITLE through:
 *   progress photos → closure → tenant complete → vendor invoice
 *   → tenant approve → sandbox PayFast ITN (card WebView is not Maestro-fillable)
 *
 * Usage:
 *   REQUEST_TITLE="E2E LiveJob 123" node scripts/walk-maintenance-pipeline.mjs
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { env, maestroEnv } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY');
  process.exit(1);
}

const TENANT_EMAIL = env('TENANT_EMAIL') || maestroEnv('TENANT_EMAIL');
const TENANT_PASSWORD = env('TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD');
const VENDOR_EMAIL = env('VENDOR_EMAIL') || maestroEnv('VENDOR_EMAIL');
const VENDOR_PASSWORD = env('VENDOR_PASSWORD') || maestroEnv('VENDOR_PASSWORD');
const REQUEST_TITLE = process.env.REQUEST_TITLE || '';
if (!REQUEST_TITLE) {
  console.error('❌ REQUEST_TITLE is required (same title Maestro used to raise the job)');
  process.exit(1);
}

const PHOTO_A =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const PHOTO_B =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
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

async function rest(path, { method = 'GET', token, body, prefer = 'return=representation' } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { ...headers(token), Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

async function edge(name, token, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { res, json };
}

function first(rows) {
  if (Array.isArray(rows)) return rows[0] || null;
  return rows || null;
}

async function main() {
  const tenant = await login(TENANT_EMAIL, TENANT_PASSWORD);
  const vendor = await login(VENDOR_EMAIL, VENDOR_PASSWORD);
  const T = tenant.access_token;
  const V = vendor.access_token;
  const titleQ = encodeURIComponent(REQUEST_TITLE);

  let mr = first(
    await rest(
      `maintenance_requests?title=eq.${titleQ}&select=id,title,status,selected_vendor_id,vendor_id,owner_id,tenant_id,property_id,po_id,work_can_start&order=created_at.desc&limit=1`,
      { token: T }
    )
  );
  if (!mr) throw new Error(`No request titled "${REQUEST_TITLE}"`);
  console.log(`✓ Job ${mr.id} status=${mr.status} title="${mr.title}"`);

  const quotes = await rest(
    `quotes?request_id=eq.${mr.id}&select=id,status,total_amount,vendor_id&order=created_at.desc`,
    { token: T }
  );
  const submitted = (quotes || []).find((q) => q.status === 'submitted');
  const approved = (quotes || []).find((q) => q.status === 'approved');
  if (submitted && mr.status === 'open') {
    const { res, json } = await edge('accept-maintenance-quote', T, { quote_id: submitted.id });
    if (!res.ok) throw new Error(`accept-maintenance-quote: ${res.status} ${JSON.stringify(json)}`);
    console.log('✓ Tenant accepted quote + PO issued (edge)');
    mr = first(
      await rest(`maintenance_requests?id=eq.${mr.id}&select=id,title,status,selected_vendor_id,vendor_id,owner_id,tenant_id,property_id,po_id,work_can_start`, {
        token: T,
      })
    );
  } else if (approved) {
    console.log(`✓ Quote already ${approved.status}`);
  } else {
    throw new Error('No submitted/approved quote on this job — Maestro create+quote must run first');
  }

  if (mr.status === 'assigned') {
    const started = await rest(`maintenance_requests?id=eq.${mr.id}`, {
      method: 'PATCH',
      token: V,
      body: {
        status: 'in_progress',
        work_started_at: new Date().toISOString(),
        work_started_by: vendor.user.id,
      },
    });
    const row = first(started);
    if (!row || row.status !== 'in_progress') {
      throw new Error('Vendor could not start work (need assigned + work_can_start + selected_vendor_id)');
    }
    mr = { ...mr, status: 'in_progress' };
    console.log('✓ Vendor started work');
  } else {
    console.log(`✓ Work already ${mr.status}`);
  }

  const existingProgress = await rest(
    `job_progress_updates?maintenance_request_id=eq.${mr.id}&select=id&limit=1`,
    { token: V }
  );
  if (!first(existingProgress)) {
    await rest('job_progress_updates', {
      method: 'POST',
      token: V,
      body: {
        maintenance_request_id: mr.id,
        vendor_id: vendor.user.id,
        update_date: new Date().toISOString().slice(0, 10),
        notes: 'E2E live job: faucet repaired, testing complete.',
        photos: [PHOTO_A],
      },
    });
    console.log('✓ Progress update with photo');
  } else {
    console.log('✓ Progress already present');
  }

  if (mr.status === 'in_progress') {
    const existingClosure = first(
      await rest(`closure_reports?maintenance_request_id=eq.${mr.id}&select=id,status&limit=1`, {
        token: V,
      })
    );
    if (!existingClosure) {
      await rest('closure_reports', {
        method: 'POST',
        token: V,
        body: {
          maintenance_request_id: mr.id,
          completion_notes: 'E2E live job: work complete, two completion photos attached.',
          completion_photos: [PHOTO_A, PHOTO_B],
          status: 'pending',
        },
      });
      await rest(`maintenance_requests?id=eq.${mr.id}`, {
        method: 'PATCH',
        token: V,
        body: { closure_requested_at: new Date().toISOString() },
      });
      console.log('✓ Closure requested');
    } else {
      console.log('✓ Closure already present');
    }

    const now = new Date().toISOString();
    await rest(`closure_reports?maintenance_request_id=eq.${mr.id}`, {
      method: 'PATCH',
      token: T,
      body: {
        tenant_verification_status: 'tenant_approved',
        tenant_ack_at: now,
        tenant_notes: 'E2E live job: tenant confirmed work.',
        status: 'approved',
      },
    });
    await rest(`maintenance_requests?id=eq.${mr.id}`, {
      method: 'PATCH',
      token: T,
      body: {
        status: 'completed',
        completed_date: now,
        closure_approved_at: now,
      },
    });
    mr = { ...mr, status: 'completed' };
    console.log('✓ Tenant confirmed closure — job completed');
  }

  let invoice = first(
    await rest(
      `maintenance_invoices?maintenance_request_id=eq.${mr.id}&select=id,invoice_number,status,payer_role,total_amount&order=created_at.desc&limit=1`,
      { token: V }
    )
  );
  if (!invoice) {
    const subtotal = 850;
    const vat = Math.round(subtotal * 0.15 * 100) / 100;
    const total = Math.round((subtotal + vat) * 100) / 100;
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const invoiceNumber = `INV-LIVE-${date}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;
    invoice = first(
      await rest('maintenance_invoices', {
        method: 'POST',
        token: V,
        body: {
          maintenance_request_id: mr.id,
          vendor_id: vendor.user.id,
          owner_id: mr.owner_id,
          property_id: mr.property_id,
          invoice_number: invoiceNumber,
          status: 'submitted',
          line_items: [{ description: 'Labor - Faucet Repair', quantity: 1, unit_price: subtotal }],
          subtotal,
          vat_amount: vat,
          total_amount: total,
          payer_role: 'tenant',
          notes: 'E2E live job invoice',
        },
      })
    );
    if (!invoice?.id) throw new Error('Vendor invoice insert failed');
    console.log(`✓ Invoice ${invoice.invoice_number} submitted (tenant payer)`);
  } else {
    console.log(`✓ Invoice already ${invoice.status} ${invoice.invoice_number}`);
  }

  if (invoice.status === 'submitted') {
    const approvedInv = first(
      await rest(`maintenance_invoices?id=eq.${invoice.id}`, {
        method: 'PATCH',
        token: T,
        body: {
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: tenant.user.id,
        },
      })
    );
    if (!approvedInv || approvedInv.status !== 'approved') {
      throw new Error('Tenant could not approve invoice');
    }
    invoice = approvedInv;
    console.log('✓ Tenant approved invoice');
  }

  const amount = Number(invoice.total_amount);
  const returnUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=success`;
  const cancelUrl = `${SUPABASE_URL}/functions/v1/vendor-payment-redirect?status=cancelled`;
  const { res: fnRes, json: fnBody } = await edge('create-vendor-payment-checkout', T, {
    invoice_id: invoice.id,
    return_url: returnUrl,
    cancel_url: cancelUrl,
  });
  let paymentId = fnBody.payment_id;
  if (!fnRes.ok) {
    if (fnRes.status === 409 && fnBody.payment_id) {
      paymentId = fnBody.payment_id;
      console.log(`ℹ️ Reusing checkout ${paymentId} (${fnBody.status})`);
      if (fnBody.status === 'completed') {
        console.log('✅ Payment already completed on this live job');
        return;
      }
    } else {
      throw new Error(`Checkout failed (${fnRes.status}): ${JSON.stringify(fnBody)}`);
    }
  } else {
    console.log(`✓ Checkout ${paymentId}`);
  }

  const simulateScript = fileURLToPath(new URL('./simulate-vendor-payment-itn.mjs', import.meta.url));
  const simOut = execFileSync('node', [simulateScript, paymentId, 'COMPLETE', amount.toFixed(2)], {
    encoding: 'utf8',
    env: process.env,
  }).trim();
  console.log(simOut);
  if (simOut.includes('AMOUNT_MISMATCH') || simOut.includes('INVALID SIGNATURE')) {
    throw new Error(`ITN rejected: ${simOut.slice(-200)}`);
  }

  const deadline = Date.now() + 20000;
  let last;
  while (Date.now() < deadline) {
    const { json } = await edge('get-vendor-payment-status', T, { payment_id: paymentId });
    last = json;
    if (json.payment_status === 'completed') break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (last?.payment_status !== 'completed') {
    throw new Error(`Payment not completed: ${JSON.stringify(last)}`);
  }
  console.log(
    `✅ LIVE JOB PAID — ${REQUEST_TITLE} invoice ${invoice.invoice_number} payment ${paymentId} R${last.total_amount}`
  );
}

main().catch((err) => {
  console.error('✗ walk-maintenance-pipeline failed:', err.message);
  process.exit(1);
});
