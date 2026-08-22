// ============================================================================
// SUPABASE EDGE FUNCTION: Process Lease Automation
// ============================================================================
// Handles:
// 1. Auto-convert expired fixed-term leases to month-to-month (CPA s14(2)(d))
// 2. Process pending rent escalations (RHA Reg 5)
//
// Cron Schedule: Daily at 06:00 UTC (08:00 SAST)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ─── Service-role auth helper ─────────────────────────────────────────────
// Matches the pattern in process-vendor-payouts. The pg_cron scheduler
// passes the service-role key as a Bearer token. We compare the raw token
// against SUPABASE_SERVICE_ROLE_KEY with a constant-time comparison to
// prevent timing side-channels. Any logged-in user's JWT will NOT match
// the service-role key, so this blocks unauthorized calls.

function verifyServiceRole(authHeader: string, expectedKey: string): boolean {
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token || !expectedKey) return false;
  if (token.length !== expectedKey.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  }
  return diff === 0;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // CRITICAL: Only allow the service-role key (used by pg_cron scheduler).
    // A logged-in user's JWT will NOT match the raw service-role key string,
    // so this blocks unauthorized calls to MTM conversion and rent escalation.
    if (!verifyServiceRole(authHeader, serviceKey)) {
      return new Response(JSON.stringify({ error: 'Unauthorized: service-role access required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const results = { autoConverted: 0, escalated: 0, errors: [] as string[] };

    // ── 1. Auto-convert expired fixed-term leases to MTM ──────────────────
    // CPA s14(2)(d): Fixed-term auto-converts to MTM on same terms
    const { data: expiredLeases, error: expiredErr } = await supabase
      .from('leases')
      .select('id, tenant_id, owner_id, property_id, monthly_rent')
      .eq('status', 'active')
      .eq('lease_type', 'fixed')
      .lt('end_date', today)
      .eq('auto_converted_to_mtm', false);

    if (!expiredErr && expiredLeases?.length) {
      for (const lease of expiredLeases) {
        try {
          const newEndDate = new Date();
          newEndDate.setMonth(newEndDate.getMonth() + 1);

          const { error: updateErr } = await supabase
            .from('leases')
            .update({
              lease_type: 'month_to_month',
              status: 'month_to_month',
              auto_converted_to_mtm: true,
              converted_to_mtm_at: new Date().toISOString(),
              end_date: newEndDate.toISOString().split('T')[0],
            })
            .eq('id', lease.id);

          if (updateErr) throw updateErr;
          results.autoConverted++;

          // Notify both parties
          await supabase.from('notifications').insert([
            {
              user_id: lease.tenant_id,
              type: 'lease_renewal',
              title: 'Lease Converted to Month-to-Month',
              body: 'Your fixed-term lease has automatically converted to a month-to-month tenancy per CPA s14. The same terms continue. Either party may terminate with 30 days notice.',
            },
            {
              user_id: lease.owner_id,
              type: 'lease_renewal',
              title: 'Lease Converted to Month-to-Month',
              body: `A fixed-term lease has auto-converted to month-to-month per CPA s14. You may terminate with 30 days written notice.`,
            },
          ]);
        } catch (err) {
          results.errors.push(`MTM conversion failed for lease ${lease.id}: ${err}`);
        }
      }
    }

    // ── 2. Process pending rent escalations ────────────────────────────────
    // RHA Reg 5: Rent escalation requires 2 months notice
    const { data: escalationLeases, error: escErr } = await supabase
      .from('leases')
      .select(
        'id, tenant_id, owner_id, monthly_rent, rent_escalation_type, rent_escalation_value, next_escalation_date'
      )
      .in('status', ['active', 'month_to_month'])
      .not('rent_escalation_type', 'is', null)
      .not('next_escalation_date', 'is', null)
      .lte('next_escalation_date', today);

    if (!escErr && escalationLeases?.length) {
      for (const lease of escalationLeases) {
        try {
          const currentRent = lease.monthly_rent;
          let newRent: number;

          switch (lease.rent_escalation_type) {
            case 'fixed_percentage':
              newRent = currentRent * (1 + (lease.rent_escalation_value || 0) / 100);
              break;
            case 'fixed_amount':
              newRent = currentRent + (lease.rent_escalation_value || 0);
              break;
            case 'cpi_linked':
              newRent = currentRent * (1 + (lease.rent_escalation_value || 5) / 100);
              break;
            default:
              continue;
          }

          newRent = Math.round(newRent * 100) / 100;

          // Calculate next escalation date
          const freq = 12; // default annual
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + freq);

          // Build history entry
          const historyEntry = {
            date: today,
            previousRent: currentRent,
            newRent,
            escalationType: lease.rent_escalation_type,
            percentage: ((newRent - currentRent) / currentRent) * 100,
          };

          // Get existing history
          const { data: existingLease } = await supabase
            .from('leases')
            .select('escalation_history')
            .eq('id', lease.id)
            .single();

          const existingHistory = (existingLease?.escalation_history as unknown[]) || [];

          const { error: updateErr } = await supabase
            .from('leases')
            .update({
              monthly_rent: newRent,
              last_escalation_date: today,
              last_escalation_amount: newRent - currentRent,
              escalation_history: [...existingHistory, historyEntry],
              next_escalation_date: nextDate.toISOString().split('T')[0],
            })
            .eq('id', lease.id);

          if (updateErr) throw updateErr;
          results.escalated++;

          // Notify both parties
          await supabase.from('notifications').insert([
            {
              user_id: lease.tenant_id,
              type: 'rent_increase',
              title: 'Rent Escalation Applied',
              body: `Your monthly rent has been adjusted from R ${currentRent.toLocaleString()} to R ${newRent.toLocaleString()} per your lease escalation terms.`,
            },
            {
              user_id: lease.owner_id,
              type: 'rent_increase',
              title: 'Rent Escalation Applied',
              body: `Monthly rent adjusted from R ${currentRent.toLocaleString()} to R ${newRent.toLocaleString()} per lease escalation terms.`,
            },
          ]);
        } catch (err) {
          results.errors.push(`Escalation failed for lease ${lease.id}: ${err}`);
        }
      }
    }

    // ── 3. Send lease expiry notifications (40-80 day window) ──────────────
    // CPA s14(2)(c): Landlord must notify tenant 40-80 business days before expiry
    const expiryWarningDate = new Date();
    expiryWarningDate.setDate(expiryWarningDate.getDate() + 60); // ~60 days from now

    const { data: expiringLeases } = await supabase
      .from('leases')
      .select('id, tenant_id, owner_id, end_date, property:properties!property_id(title)')
      .eq('status', 'active')
      .eq('lease_type', 'fixed')
      .gte('end_date', today)
      .lte('end_date', expiryWarningDate.toISOString().split('T')[0]);

    if (expiringLeases?.length) {
      for (const lease of expiringLeases) {
        // Idempotency: once per lease — skip if ANY prior lease_expiry notification
        // exists for this lease_id (regardless of when it was sent). CPA s14(2)(c)
        // requires notification in the 40-80 day window; we send once and stop.
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'lease_expiry')
          .contains('data', { lease_id: lease.id })
          .limit(1)
          .maybeSingle();

        if (existingNotification) continue; // Already notified for this lease

        const daysUntilExpiry = Math.ceil(
          (new Date(lease.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        const propertyTitle = (lease.property as any)?.title || 'your property';

        // Notify owner (they need to take action)
        await supabase.from('notifications').insert({
          user_id: lease.owner_id,
          type: 'lease_expiry',
          title: 'Lease Expiry Warning',
          body: `The lease for ${propertyTitle} expires in ${daysUntilExpiry} days. Please initiate renewal discussions or issue a CPA notice.`,
          data: { lease_id: lease.id },
        });

        // CPA s14(2)(c): Landlord must notify the tenant before expiry
        await supabase.from('notifications').insert({
          user_id: lease.tenant_id,
          type: 'lease_expiry',
          title: 'Lease Expiry Notice',
          body: `Your lease for ${propertyTitle} expires in ${daysUntilExpiry} days. Please contact your landlord to discuss renewal options.`,
          data: { lease_id: lease.id },
        });
      }
    }

    const hasErrors = results.errors.length > 0;

    return new Response(
      JSON.stringify({
        success: !hasErrors,
        timestamp: new Date().toISOString(),
        autoConverted: results.autoConverted,
        escalated: results.escalated,
        expiryWarnings: expiringLeases?.length || 0,
        errors: results.errors.length > 0 ? results.errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Lease automation error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
