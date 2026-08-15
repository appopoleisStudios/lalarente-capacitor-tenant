#!/usr/bin/env node
/**
 * Seed an optional 3D tour URL (properties.media_3d_url) on the E2E owner's
 * first property (Plane #92 Phase 1). Makes the "View in 3D" CTA appear on the
 * owner + tenant detail screens so the Maestro gate can assert it deterministically.
 *
 * Usage: node scripts/seed-property-3d-tour.mjs
 * Env:   SUPABASE_URL/SUPABASE_ANON_KEY (+ OWNER creds from env/.env/.maestro/.env)
 */
import { env, maestroEnv } from './lib/load-env.mjs';

const SUPABASE_URL = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY') || env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const OWNER_EMAIL = env('OWNER_EMAIL') || env('E2E_OWNER_EMAIL') || maestroEnv('OWNER_EMAIL');
const OWNER_PASSWORD = env('OWNER_PASSWORD') || env('E2E_OWNER_PASSWORD') || maestroEnv('OWNER_PASSWORD');

if (!SUPABASE_URL || !ANON_KEY) {
  console.error('❌ Missing SUPABASE_URL / SUPABASE_ANON_KEY — set them in env or .env');
  process.exit(1);
}
if (!OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('❌ Missing OWNER_EMAIL / OWNER_PASSWORD — set them in env, .env, or .maestro/.env');
  process.exit(1);
}

// Deterministic public 3D tour URL (Matterport sample) used only for the E2E
// gate; owners paste their real tour URL in production.
const TOUR_URL = 'https://my.matterport.com/show/?m=EjJbLb4oBbA';

async function main() {
  // 1. Login as owner
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  }).then((r) => r.json());
  if (!auth.access_token) {
    console.error(`❌ Owner login failed: ${auth.error_description || JSON.stringify(auth)}`);
    process.exit(1);
  }

  // 2. Fetch the owner's first (most recent) property
  const props = await fetch(`${SUPABASE_URL}/rest/v1/properties?owner_id=eq.${auth.user?.id}&order=created_at.desc&limit=1&select=id,title`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${auth.access_token}` },
  }).then((r) => r.json());
  if (!Array.isArray(props) || props.length === 0) {
    console.error('❌ No property found for the owner — cannot seed 3D tour URL');
    process.exit(1);
  }
  const property = props[0];

  // 3. Set media_3d_url
  const res = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property.id}`, {
    method: 'PATCH',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ media_3d_url: TOUR_URL }),
  });
  if (!res.ok) {
    console.error(`❌ Failed to seed media_3d_url (HTTP ${res.status}): ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }

  console.log(`✅ 3D tour URL seeded on "${property.title}" (${property.id})`);
}

main().catch((e) => {
  console.error('✗ Seed failed:', e.message);
  process.exit(1);
});
