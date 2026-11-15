#!/usr/bin/env node
/**
 * E2E only: the lifecycle chain approves a viewing for a future date, then the
 * tenant must wait for the viewing before applying (CT7-032). Move the
 * fixture tenant's approved viewing of LC_PROPERTY_ID one hour into the past
 * (as the owner, through RLS) so the owner can mark it viewed (02d) and the
 * tenant can apply (03a) in the same run.
 */
import { env, maestroEnv } from '../lib/load-env.mjs';

const URL_ = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const PROPERTY = process.env.LC_PROPERTY_ID;
if (!PROPERTY) throw new Error('LC_PROPERTY_ID is required');

const login = async (role) => {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: env(`${role}_EMAIL`) || maestroEnv(`${role}_EMAIL`),
      password: env(`${role}_PASSWORD`) || maestroEnv(`${role}_PASSWORD`),
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`${role} login failed`);
  return j;
};
const rest = async (token, method, path, body) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]} → ${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};

const tenant = await login('TENANT');
const owner = await login('OWNER');
const rows = await rest(
  owner.access_token,
  'GET',
  `viewing_requests?select=id&property_id=eq.${PROPERTY}&tenant_id=eq.${tenant.user.id}&status=eq.approved`
);
if (!rows.length) throw new Error('no approved viewing to move');
const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
await rest(owner.access_token, 'PATCH', `viewing_requests?id=eq.${rows[0].id}`, {
  confirmed_date: past,
});
console.log(`viewing ${rows[0].id.slice(0, 8)} now took place at ${past}`);
