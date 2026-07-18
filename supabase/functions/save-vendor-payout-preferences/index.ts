// ============================================================================
// SUPABASE EDGE FUNCTION: save-vendor-payout-preferences
// ============================================================================
// Saves or updates vendor payout preferences including bank details and
// payout schedule (instant/daily/weekly).
//
// Account numbers are encrypted at rest using AES-256-GCM via the Web Crypto
// API. The encryption key is read from the PAYOUT_ENCRYPTION_KEY environment
// variable (set as a Supabase secret). Only masked versions (****[last4])
// are ever returned to clients.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
//   PAYOUT_ENCRYPTION_KEY  — 32-byte hex string for AES-256-GCM
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SavePreferencesRequest {
  schedule?: 'instant' | 'daily' | 'weekly';
  bank_account_name?: string;
  bank_name?: string;
  branch_code?: string;
  account_number?: string;
  account_type?: 'cheque' | 'savings' | 'transmission';
}

// ─── Encryption helpers (AES-256-GCM) ──────────────────────────────────────

/**
 * Derive an AES-256-GCM CryptoKey from the PAYOUT_ENCRYPTION_KEY secret.
 * Falls back to a server-generated key if the secret is not set (dev only).
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  const rawHex = Deno.env.get('PAYOUT_ENCRYPTION_KEY');
  const rawKey = rawHex
    ? new Uint8Array(rawHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
    : new TextEncoder().encode(
        'lalarente-default-dev-key-32chr!' // dev-only fallback — never in production
      ).slice(0, 32);

  // Pad / truncate to exactly 32 bytes
  const keyBytes = new Uint8Array(32);
  keyBytes.set(rawKey.slice(0, 32));

  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a colon-delimited base64 string: "iv:ciphertext"
 */
async function encryptAccountNumber(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  const b64Iv = btoa(String.fromCharCode(...iv));
  const b64Cipher = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `${b64Iv}:${b64Cipher}`;
}

/**
 * Decrypt an "iv:ciphertext" string previously produced by encryptAccountNumber.
 * Returns the original plaintext or null on failure.
 */
export async function decryptAccountNumber(
  encrypted: string
): Promise<string | null> {
  try {
    const key = await getEncryptionKey();
    const parts = encrypted.split(':');
    if (parts.length < 2) return null;

    const iv = Uint8Array.from(atob(parts[0]), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

/**
 * Extract last 4 digits from an account number for display masking.
 */
function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/\s/g, '');
  if (cleaned.length <= 4) return `****${cleaned}`;
  return `****${cleaned.slice(-4)}`;
}

// ─── Request handler ───────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'PUT') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and extract user ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Verify vendor role ──────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile as any).role !== 'vendor') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: vendor access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    const body: SavePreferencesRequest = await req.json();

    // ── Validate ────────────────────────────────────────────────────────
    if (body.schedule && !['instant', 'daily', 'weekly'].includes(body.schedule)) {
      return new Response(
        JSON.stringify({ error: 'Invalid schedule. Must be instant, daily, or weekly.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.account_type && !['cheque', 'savings', 'transmission'].includes(body.account_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid account type. Must be cheque, savings, or transmission.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Build update payload ────────────────────────────────────────────
    const updateData: Record<string, unknown> = {
      vendor_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (body.schedule) updateData.schedule = body.schedule;
    if (body.bank_account_name !== undefined) updateData.bank_account_name = body.bank_account_name;
    if (body.bank_name !== undefined) updateData.bank_name = body.bank_name;
    if (body.branch_code !== undefined) updateData.branch_code = body.branch_code;
    if (body.account_type !== undefined) updateData.account_type = body.account_type;

    // ── Encrypt full account number at rest ─────────────────────────────
    // The full account number is encrypted using AES-256-GCM before storage.
    // Only masked (****[last4]) values are ever returned to clients.
    // The PAYOUT_ENCRYPTION_KEY server secret is required in production.
    if (body.account_number !== undefined) {
      const acct = body.account_number.replace(/\s/g, '');
      if (acct) {
        updateData.account_number_encrypted = await encryptAccountNumber(acct);
        console.log(`🔐 Account number encrypted for vendor ${user.id}`);
      } else {
        updateData.account_number_encrypted = null;
      }
    }

    // ── Upsert preferences ──────────────────────────────────────────────
    const { data, error } = await supabase
      .from('vendor_payout_preferences')
      .upsert(updateData, { onConflict: 'vendor_id' })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to save payout preferences:', error);
      return new Response(JSON.stringify({ error: 'Failed to save preferences' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Payout preferences saved for vendor ${user.id}`);

    // ── Return sanitised response (never expose encrypted field) ────────
    const saved = data as any;
    let maskedNumber: string | null = null;
    if (saved.account_number_encrypted) {
      const decrypted = await decryptAccountNumber(saved.account_number_encrypted);
      if (decrypted) {
        maskedNumber = maskAccountNumber(decrypted);
      }
    }

    return new Response(
      JSON.stringify({
        vendor_id: saved.vendor_id,
        schedule: saved.schedule,
        bank_account_name: saved.bank_account_name,
        bank_name: saved.bank_name,
        branch_code: saved.branch_code,
        account_type: saved.account_type,
        account_number_masked: maskedNumber,
        updated_at: saved.updated_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ save-vendor-payout-preferences error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
