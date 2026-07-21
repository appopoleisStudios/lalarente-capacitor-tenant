/* eslint-disable */ // Deno edge function — URL imports are not resolvable by ESLint
// ============================================================================
// SUPABASE EDGE FUNCTION: Auto-Escalate Vendor Payments
// ============================================================================
// Cron-triggered function that calls auto_escalate_vendor_payments() SQL.
// Only processes requests that pass the CRON_SECRET header check.
//
// Auth:
//   Requests must include header `x-cron-secret` matching CRON_SECRET env var.
//   The SQL function itself has EXECUTE revoked from anon/authenticated so
//   only the service_role (used by this function internally) can call it.
//
// Tasks (all handled server-side in the SQL function):
//   1. Auto-approve closure_reports where tenant hasn't responded in 72h
//   2. Cancel stuck vendor_payments (processing for 30+ min — ITN lost)
//   3. Count closures approaching deadline for retry nudges
//
// Cron Schedule: 0 * * * * (every hour at minute 0)
//
// Deployed via: npx supabase functions deploy auto-escalate-vendor-payments
// Env vars required: CRON_SECRET (set in Supabase Edge Function settings)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── Auth: verify cron secret ────────────────────────────────────────────
  // Prevents unauthorized callers from triggering escalations via the
  // public edge function URL. The cron job (or Supabase scheduled function)
  // must pass the correct x-cron-secret header.
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('❌ CRON_SECRET not configured — rejecting all requests');
    return new Response(
      JSON.stringify({ error: 'Server misconfigured: CRON_SECRET not set' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }

  const authHeader = req.headers.get('x-cron-secret');
  if (!authHeader || authHeader !== cronSecret) {
    console.warn('⚠️ Unauthorized escalation attempt');
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    );
  }

  try {
    console.log('🕐 Auto-escalate vendor payments function triggered');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Call the SQL function which handles all three tasks atomically
    const { data, error } = await supabase.rpc('auto_escalate_vendor_payments');

    if (error) {
      console.error('❌ Error calling auto_escalate_vendor_payments:', error);
      throw error;
    }

    // The RPC returns TABLE format
    const result = data?.[0] || {
      auto_approved_closures: 0,
      cancelled_stuck_payments: 0,
      pending_nudge_count: 0,
      message: 'No action taken',
    };

    console.log('✅ Auto-escalation completed:', result);

    return new Response(
      JSON.stringify({
        success: true,
        auto_approved_closures: result.auto_approved_closures,
        cancelled_stuck_payments: result.cancelled_stuck_payments,
        pending_nudge_count: result.pending_nudge_count,
        message: result.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Auto-escalate function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
