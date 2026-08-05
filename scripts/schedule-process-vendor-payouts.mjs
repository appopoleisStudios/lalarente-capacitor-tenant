#!/usr/bin/env node
// Schedule the process-vendor-payouts edge function as a daily pg_cron job.
// Follows the exact pattern from schedule-auto-crons.mjs:
// - Fetches the service_role key at RUNTIME from the Management API
// - Bakes it into the cron job SQL command (never persisted to disk)
// - Uses net.http_post inside the cron job to call the edge function
//
// Usage: node scripts/schedule-process-vendor-payouts.mjs
// Env:   SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_ID (or in .env)
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

const serviceKey = await getServiceRoleKey();
console.log(`🔑 service_role key fetched (${serviceKey.length} chars)`);

// ── Schedule the cron job ─────────────────────────────────────────────────
// Daily at 02:00 UTC (= 04:00 SAST). Runs after midnight, before business
// hours, processing overnight.
// The edge function accepts service-role auth (Bearer service_role key) for
// cron-triggered calls in addition to admin JWT for admin dashboard calls.

const JOB_NAME = 'process-vendor-payouts-daily';
const SCHEDULE = '0 2 * * *';
const FN_SLUG = 'process-vendor-payouts';

const sql = `
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = '${JOB_NAME}') THEN
    PERFORM cron.unschedule('${JOB_NAME}');
  END IF;
END $$;

SELECT cron.schedule(
  '${JOB_NAME}',
  '${SCHEDULE}',
  $$SELECT net.http_post(
    url := 'https://${PROJECT_REF}.supabase.co/functions/v1/${FN_SLUG}',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ${serviceKey}',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('method', 'manual_eft')
  )$$
);
`;

await runSql(sql);
console.log(`✅ pg_cron job "${JOB_NAME}" scheduled (${SCHEDULE})`);

// Verify.
const verify = await runSql(
  `SELECT jobname, schedule, active FROM cron.job WHERE jobname = '${JOB_NAME}';`
);
console.log('=== cron.job verification ===');
console.log(verify.slice(0, 800));