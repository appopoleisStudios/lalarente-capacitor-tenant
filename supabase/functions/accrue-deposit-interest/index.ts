/* eslint-disable */ // Deno edge function — URL imports are not resolvable by ESLint
// ============================================================================
// SUPABASE EDGE FUNCTION: Accrue Deposit Interest
// ============================================================================
// RHA s5(3)(d): Security deposit must earn interest at the prescribed savings
// rate. All interest belongs to the tenant.
//
// Calls the accrue_deposit_interest() SQL function which:
//   - Calculates monthly compound interest for all active leases
//   - Inserts into deposit_interest_accruals (idempotent)
//   - Updates leases.deposit_total_interest
//
// Triggered automatically by pg_cron on the 1st of each month.
// Can also be called manually via HTTP for backfill / testing.
//
// Cron Schedule: 0 1 1 * * (1st of month at 01:00 UTC = 03:00 SAST)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('💰 Deposit interest accrual triggered');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc('accrue_deposit_interest');

    if (error) {
      console.error('❌ Error calling accrue_deposit_interest:', error);
      throw error;
    }

    const result = data?.[0] ?? {
      processed_count: 0,
      skipped_count: 0,
      total_interest_accrued: 0,
      message: 'No data returned',
    };

    console.log('✅ Interest accrual completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        processed_count: result.processed_count,
        skipped_count: result.skipped_count,
        total_interest_accrued: result.total_interest_accrued,
        message: result.message,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('❌ Function error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// ============================================================================
// DEPLOYMENT
// ============================================================================
/*

1. Deploy:
   npx supabase functions deploy accrue-deposit-interest

2. The pg_cron job is registered by migration 032 and runs automatically.

3. Test manually (or backfill):
   curl -X POST https://[project-id].supabase.co/functions/v1/accrue-deposit-interest \
     -H "Authorization: Bearer [service-role-key]"

4. Verify in Supabase SQL editor:
   SELECT * FROM accrue_deposit_interest();
   SELECT * FROM deposit_interest_accruals ORDER BY created_at DESC LIMIT 10;
   SELECT id, deposit_amount, deposit_total_interest FROM leases WHERE deposit_amount > 0;

*/
