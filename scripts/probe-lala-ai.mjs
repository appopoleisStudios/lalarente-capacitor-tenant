// Probe Lala AI live — ask realistic data questions as each role and print full replies.
// Usage: node scripts/probe-lala-ai.mjs [--raw]
import { env, maestroEnv } from './lib/load-env.mjs';

const url = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const anon = env('EXPO_PUBLIC_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
const raw = process.argv.includes('--raw');

const accounts = {
  owner: {
    email: env('OWNER_EMAIL') || maestroEnv('OWNER_EMAIL'),
    password: env('OWNER_PASSWORD') || maestroEnv('OWNER_PASSWORD'),
    role: 'owner',
    questions: [
      'What needs my attention right now?',
      'What invoices are pending my approval?',
      'Which properties do I own and what is their status?',
      'How many open maintenance requests do I have and what are they?',
    ],
  },
  tenant: {
    email: env('TENANT_EMAIL') || maestroEnv('TENANT_EMAIL'),
    password: env('TENANT_PASSWORD') || maestroEnv('TENANT_PASSWORD'),
    role: 'tenant',
    questions: [
      'What does my lease say?',
      'How much rent do I owe and when is it due?',
      'What maintenance requests have I raised and what is their status?',
      'Do I have any outstanding vendor payments?',
    ],
  },
  vendor: {
    email: env('VENDOR_EMAIL') || maestroEnv('VENDOR_EMAIL'),
    password: env('VENDOR_PASSWORD') || maestroEnv('VENDOR_PASSWORD'),
    role: 'vendor',
    questions: [
      'What jobs are assigned to me right now?',
      'How much have I earned and what is my payout balance?',
      'What quotes have I submitted recently?',
    ],
  },
};

async function login(email, password) {
  const r = await fetch(url + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!d.access_token) {
    console.log(`  LOGIN FAILED (${r.status}): ${d.error_description || d.msg || 'unknown'}`);
    return null;
  }
  return d.access_token;
}

async function ask(token, role, text) {
  const r = await fetch(url + '/functions/v1/lala-ai-chat', {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, role }),
  });
  const body = await r.text();
  return { status: r.status, body };
}

for (const [role, acct] of Object.entries(accounts)) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`ROLE: ${role}  (${acct.email})`);
  console.log('='.repeat(70));
  const token = await login(acct.email, acct.password);
  if (!token) continue;
  for (const q of acct.questions) {
    const { status, body } = await ask(token, acct.role, q);
    console.log(`\n--- Q: ${q}`);
    console.log(`    [HTTP ${status}]`);
    if (raw) {
      console.log(body);
    } else {
      try {
        const j = JSON.parse(body);
        console.log('    ' + (j.reply || JSON.stringify(j)).split('\n').join('\n    '));
      } catch {
        console.log('    ' + body.slice(0, 300));
      }
    }
  }
}
console.log('\nDONE');
