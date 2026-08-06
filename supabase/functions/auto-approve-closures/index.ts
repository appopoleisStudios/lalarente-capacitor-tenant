/* eslint-disable */ // Deno edge function — URL imports are not resolvable by ESLint
// ============================================================================
// SUPABASE EDGE FUNCTION: Auto-Approve Closures
// ============================================================================
// Plane #62 — Auto-escalation cron.
// Hourly. Auto-approves tenant verification when the tenant has been
// unresponsive for 72h (auto_approve_at deadline passed) and has not
// acknowledged (tenant_ack_at IS NULL). Notifies owner, tenant and vendor.
//
// Mirrors the app-side autoApproveExpiredClosures() logic (which only updates
// the row and had TODO notifications) as a reliable server-side cron with the
// notifications wired in.
//
// Cron Schedule: 0 * * * * (every hour at minute 0)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function notify(supabase, userId, title, body, data) {
  if (!userId) return;
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'maintenance_updated',
      title,
      body,
      data: data || {},
    });
  } catch (err) {
    console.error(`⚠️ Failed to notify ${userId}:`, err); // non-fatal
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing env vars');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date().toISOString();
    console.log('🕐 Auto-approve closures triggered');

    // Closures pending tenant verification whose 72h deadline has passed and
    // the tenant has not acknowledged. Join the request for owner/tenant/vendor.
    const { data: expired, error: fetchError } = await supabase
      .from('closure_reports')
      .select(
        `
        id,
        maintenance_request_id,
        tenant_verification_status,
        auto_approve_at,
        maintenance_requests!inner(
          owner_id,
          tenant_id,
          selected_vendor_id
        )
      `
      )
      .eq('tenant_verification_status', 'pending_tenant')
      .lte('auto_approve_at', now)
      .is('tenant_ack_at', null)
      .limit(50); // bounded batches per run

    if (fetchError) throw fetchError;

    const rows = expired || [];
    console.log(`📋 Found ${rows.length} closures past auto-approve deadline`);

    let autoApproved = 0;
    for (const closure of rows) {
      const mr = closure.maintenance_requests;
      const { error: updateError } = await supabase
        .from('closure_reports')
        .update({
          tenant_verification_status: 'auto_approved',
          tenant_ack_at: now,
          tenant_notes: 'Auto-approved after 72 hours - tenant unresponsive',
          status: 'pending',
        })
        .eq('id', closure.id)
        .eq('tenant_verification_status', 'pending_tenant'); // status guard (cron-overlap safety)

      if (updateError) {
        console.error(`❌ Failed to auto-approve ${closure.id}:`, updateError);
        continue;
      }
      autoApproved++;

      // Auto-approval semantically accepts the completed work — mark the
      // request completed so the generate-work-order-report completion gate
      // (status IN completed/closed) passes. Without this the Plane #68
      // report trigger below would always 409 and never fire.
      const { error: mrError } = await supabase
        .from('maintenance_requests')
        .update({
          status: 'completed',
          completed_date: now,
          closure_approved_at: now,
        })
        .eq('id', closure.maintenance_request_id)
        .eq('status', 'in_progress'); // only promote in-flight requests
      if (mrError) {
        console.error(`❌ Failed to mark ${closure.maintenance_request_id} completed:`, mrError);
      }

      await notify(
        supabase,
        mr?.owner_id,
        'Closure Auto-Approved',
        'Tenant did not respond within 72 hours, so the completed work was auto-approved.',
        { closure_id: closure.id, maintenance_request_id: closure.maintenance_request_id }
      );
      await notify(
        supabase,
        mr?.tenant_id,
        'Work Auto-Approved',
        'You did not confirm the completed work within 72 hours, so it was auto-approved.',
        { closure_id: closure.id, maintenance_request_id: closure.maintenance_request_id }
      );
      await notify(
        supabase,
        mr?.selected_vendor_id,
        'Closure Auto-Approved',
        'The tenant did not respond within 72 hours — the completed work was auto-approved.',
        { closure_id: closure.id, maintenance_request_id: closure.maintenance_request_id }
      );

      // Plane #68 — after auto-approval the work is effectively complete, so
      // generate + email the Work Order completion report to Owner + Tenant.
      // Fire-and-forget: a report failure must not fail the cron batch.
      try {
        await fetch(`${supabaseUrl}/functions/v1/generate-work-order-report`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ maintenance_request_id: closure.maintenance_request_id }),
        });
      } catch (reportErr) {
        console.error(
          `⚠️ Failed to trigger work order report for ${closure.maintenance_request_id}:`,
          reportErr
        );
      }
    }

    console.log(`✅ Auto-approved ${autoApproved} closures`);
    return new Response(
      JSON.stringify({ success: true, auto_approved: autoApproved, timestamp: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('❌ auto-approve-closures error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// ============================================================================
// DEPLOYMENT / CRON
// ============================================================================
// 1. Deploy:
//    npx supabase functions deploy auto-approve-closures
// 2. Schedule hourly via pg_cron (Supabase Dashboard → Database → Cron Jobs):
//    SELECT cron.schedule(
//      'auto-approve-closures',
//      '0 * * * *',
//      $$SELECT net.http_post(
//        url := 'https://[project-ref].supabase.co/functions/v1/auto-approve-closures',
//        headers := jsonb_build_object(
//          'Authorization', 'Bearer [service-role-key]',
//          'Content-Type', 'application/json'
//        )
//      )$$
//    );
// 3. Test:
//    curl -X POST https://[project-ref].supabase.co/functions/v1/auto-approve-closures \
//      -H "Authorization: Bearer [service-role-key]"
// ============================================================================
