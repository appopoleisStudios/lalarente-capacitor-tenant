#!/usr/bin/env node
// Schedule the Plane #62 auto-escalation edge functions as pg_cron jobs on the
// live Supabase project via the Management API.
//
// The service-role key is fetched at RUNTIME from the Management API and is
// never written to disk or committed — it only appears in the Authorization
// header of the net.http_post call inside the cron job command.
//
// Usage: node scripts/schedule-auto-crons.mjs
// Env:   SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID (or in .env)
//
// PREREQUISITE: the pg_net extension must be installed (provides net.http_post).
// Apply database/migrations/055_enable_pg_net_for_crons.sql first — without it
// every scheduled run fails with `ERROR: schema "net" does not exist`.
import { env } from './lib/load-env.mjs';

const ACCESS_TOKEN = env('SUPABASE_ACCESS_TOKEN');
const PROJECT_REF = env('SUPABASE_PROJECT_ID');

if (!ACCESS_TOKEN || !PROJECT_REF) {
  console.error('❌ Missing SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_ID');
  process.exit(1);
}

const MGMT = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

/** Fetch the service_role key (used only at runtime, never persisted). */
async function getServiceRoleKey() {
  const res = await fetch(`${MGMT}/api-keys`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`api-keys HTTP ${res.status}: ${await res.text()}`);
  const keys = await res.json();
  const sr = (keys || []).find((k) => k?.name === 'service_role');
  if (!sr?.api_key) throw new Error('service_role key not found');
  return sr.api_key;
}

/** Run arbitrary SQL on the live DB. */
async function runSql(sql) {
  const res = await fetch(`${MGMT}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`query HTTP ${res.status}: ${text.slice(0, 1500)}`);
  return text;
}

// The three crons: name, cron expression, edge function slug.
const JOBS = [
  { name: 'auto-approve-closures', schedule: '0 * * * *', fn: 'auto-approve-closures' },
  { name: 'payment-retry-nudges', schedule: '0 9 * * *', fn: 'payment-retry-nudges' },
  { name: 'reconcile-stuck-payments', schedule: '*/15 * * * *', fn: 'reconcile-stuck-payments' },
];

const serviceKey = await getServiceRoleKey();
console.log(`🔑 service_role key fetched (${serviceKey.length} chars)`);

// Drop any existing jobs with these names, then re-create (idempotent).
const parts = [];
for (const job of JOBS) {
  parts.push(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${job.name}') THEN
    PERFORM cron.unschedule('${job.name}');
  END IF;
END $$;

SELECT cron.schedule(
  '${job.name}',
  '${job.schedule}',
  $$SELECT net.http_post(
    url := 'https://${PROJECT_REF}.supabase.co/functions/v1/${job.fn}',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ${serviceKey}',
      'Content-Type', 'application/json'
    )
  )$$
);
`);
}

await runSql(parts.join('\n'));
console.log('✅ pg_cron jobs scheduled: ' + JOBS.map((j) => `${j.name} (${j.schedule})`).join(', '));

// Verify.
const verify = await runSql(
  `SELECT jobname, schedule, active FROM cron.job WHERE jobname IN (${JOBS.map((j) => `'${j.name}'`).join(', ')}) ORDER BY jobname;`
);
console.log('=== cron.job verification ===');
console.log(verify.slice(0, 1500));
