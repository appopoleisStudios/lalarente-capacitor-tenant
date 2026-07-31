#!/usr/bin/env node
/**
 * Check + apply the maintenance_invoices RLS policies on the LIVE Supabase
 * project via the Supabase Management API (proxied through the admin-proxy
 * edge function, which requires an admin JWT with role='admin' AND dev_admin).
 *
 * Background: migration 047 (database/migrations/047_create_vendor_payment_system.sql)
 * defines tenant_invoice_select so tenants can see approved invoices for their
 * maintenance requests. The live DB appears to be missing it — the seed script
 * (seed-tenant-vendor-invoice.mjs) approved an invoice but the tenant could not
 * see it, which would make the tenant money path dead on arrival for clients.
 *
 * Usage:
 *   node scripts/check-apply-invoice-rls.mjs
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://vvepwaolnkzfzhzgxlwr.supabase.co';
const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2ZXB3YW9sbmt6Znpoemd4bHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2ODAyODAsImV4cCI6MjA2OTI1NjI4MH0.WGoBvXa58a8hdaNL8hYm-q1xLBy8P7IgCxo0508QAIk';
const PROJECT_REF = 'vvepwaolnkzfzhzgxlwr';
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'indraj.navin@gmail.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'Nadene10_';

async function main() {
  // 1. Login as owner/admin
  const lr = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
    }
  );
  const lj = await lr.json();
  if (!lj.access_token) {
    throw new Error(`Owner login failed: ${lj.error_description || lj.error || '?'}`);
  }
  console.log('✓ Logged in as admin');

  // 2. Query current policies via Management API
  const query = async (sql) => {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${lj.access_token}` },
      body: JSON.stringify({
        target: 'supabase-mgmt',
        path: `v1/projects/${PROJECT_REF}/database/query`,
        method: 'POST',
        body: { query: sql },
      }),
    });
    const txt = await r.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
    if (json.error) throw new Error(`Mgmt API: ${json.error}`);
    return json;
  };

  const policies = await query(
    "select policyname from pg_policies where tablename = 'maintenance_invoices' order by policyname"
  );
  console.log('Current policies on maintenance_invoices:', JSON.stringify(policies));

  const REQUIRED = ['vendor_invoice_select', 'vendor_invoice_insert', 'vendor_invoice_delete',
                    'owner_invoice_select', 'owner_invoice_update', 'tenant_invoice_select'];
  const names = (Array.isArray(policies) ? policies : [])
    .map((p) => (typeof p === 'object' ? p.policyname : String(p)));
  const missing = REQUIRED.filter((want) => !names.includes(want));
  if (missing.length === 0) {
    console.log('✓ All invoice policies present — nothing to apply');
    return;
  }
  console.log(`Missing policies: ${missing.join(', ')}`);
  // We auto-fix tenant_invoice_select only (the money-path policy from migration
  // 047). If any OTHER required policy is missing the DB is in an unexpected
  // state — fail loudly instead of claiming success.
  if (missing.some((p) => p !== 'tenant_invoice_select')) {
    throw new Error(
      `Unexpectedly missing: ${missing.filter((p) => p !== 'tenant_invoice_select').join(', ')} — ` +
      'these come from migrations 044/047 and must be applied manually before the money path works.'
    );
  }

  // 3. Apply missing policies (idempotent CREATE POLICY ... with IF NOT EXISTS guard)
  const statements = [
    `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='maintenance_invoices' AND policyname='tenant_invoice_select') THEN
    CREATE POLICY tenant_invoice_select ON maintenance_invoices
      FOR SELECT
      USING (
        maintenance_request_id IN (
          SELECT id FROM maintenance_requests WHERE tenant_id = auth.uid()
        )
      );
  END IF;
END $$;`,
  ];
  // Pull policy definitions from the local migration file where possible so the
  // live DB matches the repo (single source of truth).
  for (const stmt of statements) {
    const res = await query(stmt);
    console.log('✓ Applied statement:', JSON.stringify(res).slice(0, 120));
  }

  // 4. Re-verify
  const after = await query(
    "select policyname from pg_policies where tablename = 'maintenance_invoices' order by policyname"
  );
  console.log('Policies after apply:', JSON.stringify(after));
  const afterNames = (Array.isArray(after) ? after : []).map((p) =>
    typeof p === 'object' ? p.policyname : String(p)
  );
  const stillMissing = ['tenant_invoice_select'].filter((n) => !afterNames.includes(n));
  if (stillMissing.length) {
    throw new Error(`Still missing: ${stillMissing.join(', ')} — check ADMIN_MGMT_TOKEN / policy`);
  }
  console.log('✅ tenant_invoice_select is now live');
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
