/**
 * E2E only: sign in as a fixture user (anon key + password, so every call
 * goes through RLS exactly like the app) and call the REST API.
 * `call` never throws on an HTTP error: it returns { ok, status, body } so a
 * check can assert that the database REFUSED something.
 */
import { env, maestroEnv } from '../lib/load-env.mjs';

const URL_ = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export async function login(role) {
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
  return { token: j.access_token, id: j.user.id };
}

export async function call(user, method, path, body) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${user.token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let parsed = null;
  try {
    parsed = t ? JSON.parse(t) : null;
  } catch {
    parsed = t;
  }
  return { ok: r.ok, status: r.status, body: parsed };
}

/** GET that must succeed. */
export async function get(user, path) {
  const res = await call(user, 'GET', path);
  if (!res.ok) throw new Error(`GET ${path.split('?')[0]} → ${res.status}`);
  return res.body;
}

/** Throws unless the response is an error whose code/message matches. */
export function expectRefused(label, res, { code, message }) {
  const b = res.body || {};
  const codeOk = !code || b.code === code;
  const msgOk = !message || message.test(String(b.message || ''));
  if (res.ok || !codeOk || !msgOk) {
    throw new Error(
      `${label}: expected the database to refuse (${code || ''} ${message || ''}), got ${res.status} ${JSON.stringify(b).slice(0, 200)}`
    );
  }
  console.log(`✓ ${label}: refused (${b.code})`);
}
