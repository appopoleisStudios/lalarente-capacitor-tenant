// Spaced live probe for the REAL-data fix — the exact questions that previously
// returned generic process-speak or 502s. Spaced 12s apart to respect Groq TPM.
// Usage: node scripts/probe-lala-ai-real.mjs
import { env, maestroEnv } from './lib/load-env.mjs';

const url = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const anon = env('EXPO_PUBLIC_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(label, email, pass, role, text) {
  const r = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  const d = await r.json();
  const f = await fetch(url + '/functions/v1/lala-ai-chat', {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: 'Bearer ' + d.access_token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, role }),
  });
  const b = await f.text();
  let j;
  try { j = JSON.parse(b); } catch { j = { raw: b.slice(0, 200) }; }
  const reply = j.reply || j.error || JSON.stringify(j);
  console.log('\n[' + label + '] HTTP ' + f.status);
  console.log('  ' + reply.split('\n').join('\n  '));
  await sleep(12000);
}

await ask('OWNER: pending invoices/quotes',
  maestroEnv('OWNER_EMAIL'), maestroEnv('OWNER_PASSWORD'), 'owner',
  'What invoices or quotes are pending my approval? Give me the actual amounts and what they are for.');
await ask('TENANT: maintenance I raised',
  maestroEnv('TENANT_EMAIL'), maestroEnv('TENANT_PASSWORD'), 'tenant',
  'What maintenance requests have I raised and what is their status?');
await ask('TENANT: vendor payments owed',
  maestroEnv('TENANT_EMAIL'), maestroEnv('TENANT_PASSWORD'), 'tenant',
  'Do I have any outstanding vendor payments? If yes, how much and for what?');
await ask('VENDOR: earnings + jobs',
  maestroEnv('VENDOR_EMAIL'), maestroEnv('VENDOR_PASSWORD'), 'vendor',
  'How much have I earned and what jobs are assigned to me right now?');
await ask('TENANT: rent owed',
  maestroEnv('TENANT_EMAIL'), maestroEnv('TENANT_PASSWORD'), 'tenant',
  'How much rent do I owe and when is it due?');
console.log('\nDONE');
