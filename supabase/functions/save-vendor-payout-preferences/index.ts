// ============================================================================
// SUPABASE EDGE FUNCTION: save-vendor-payout-preferences
// ============================================================================
// Saves or updates vendor payout preferences including bank details and
// payout schedule (instant/daily/weekly).
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
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
  account_number?: string; // Will be encrypted by the app layer
  account_type?: 'cheque' | 'savings' | 'transmission';
}

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

    // Account number: in production, encrypt via app layer or pgcrypto.
    // For v1, we store a masked version + hint. The full number should
    // never be stored in plaintext in the database.
    if (body.account_number !== undefined) {
      const acct = body.account_number.replace(/\s/g, '');
      if (acct && acct.length > 4) {
        // Store last 4 digits + encryption hint
        const lastFour = acct.slice(-4);
        updateData.account_number_encrypted = `v1:hint:****${lastFour}`;
      } else if (acct) {
        updateData.account_number_encrypted = `v1:hint:****${acct}`;
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

    // Return sanitised preferences (never return the raw encrypted field)
    const saved = data as any;
    return new Response(
      JSON.stringify({
        vendor_id: saved.vendor_id,
        schedule: saved.schedule,
        bank_account_name: saved.bank_account_name,
        bank_name: saved.bank_name,
        branch_code: saved.branch_code,
        account_type: saved.account_type,
        // Return masked account number
        account_number_masked: saved.account_number_encrypted
          ? `****${saved.account_number_encrypted.slice(-4)}`
          : null,
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
