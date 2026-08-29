// ============================================================================
// OWNER AUTOPILOT — LAL-123 epic (LAL-127–131)
// Cron + owner/tenant JWT. Does landlord busywork. Does NOT accept quotes or pay.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function verifyServiceRole(authHeader: string, expectedKey: string): boolean {
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !expectedKey || token.length !== expectedKey.length) return false;
  let diff = 0;
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  return diff === 0;
}

async function notify(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  if (!userId) return;
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    data,
    channels: ['in_app'],
    priority: 'high',
    status: 'pending',
  });
}

function daysOverdue(dueDate: string): number {
  return Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
}

function stageForDays(days: number): string | null {
  if (days < 7) return null;
  if (days >= 21) return 'breach_notice';
  if (days >= 14) return 'formal_demand';
  return 'friendly_reminder';
}

const STAGE_ORDER = [
  'friendly_reminder',
  'formal_demand',
  'breach_notice',
  'cure_period',
  'legal_action',
];

type Summary = {
  routed: number;
  quotes_chased: number;
  arrears: number;
  viewing_reminders: number;
  errors: string[];
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST' && req.method !== 'GET')
    return json(405, { error: 'Method not allowed' });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const isCron = verifyServiceRole(authHeader, serviceKey);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    let scopeOwnerId: string | null = body.owner_id ? String(body.owner_id) : null;
    let scopeTenantId: string | null = null;

    if (!isCron) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(token);
      if (authError || !user) return json(401, { error: 'Unauthorized' });
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      const role = (profile as { role?: string } | null)?.role;
      if (role === 'owner') scopeOwnerId = user.id;
      else if (role === 'tenant') scopeTenantId = user.id;
      else return json(403, { error: 'Only owner, tenant, or cron may run autopilot.' });
    }

    const summary: Summary = {
      routed: 0,
      quotes_chased: 0,
      arrears: 0,
      viewing_reminders: 0,
      errors: [],
    };

    await routeUnroutedJobs(supabase, { scopeOwnerId, scopeTenantId, summary });
    await chaseQuotes(supabase, { scopeOwnerId, summary });
    await evaluateArrears(supabase, { scopeOwnerId, scopeTenantId, summary });
    await viewingReminders(supabase, { scopeOwnerId, scopeTenantId, summary });

    return json(200, { success: true, cron: isCron, ...summary });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Internal error' });
  }
});

async function routeUnroutedJobs(
  supabase: SupabaseClient,
  ctx: { scopeOwnerId: string | null; scopeTenantId: string | null; summary: Summary }
) {
  let q = supabase
    .from('maintenance_requests')
    .select(
      'id, title, owner_id, tenant_id, property_id, category_id, status, visibility, vendor_routed_at'
    )
    .eq('status', 'open')
    .is('vendor_routed_at', null)
    .limit(40);
  if (ctx.scopeOwnerId) q = q.eq('owner_id', ctx.scopeOwnerId);
  if (ctx.scopeTenantId) q = q.eq('tenant_id', ctx.scopeTenantId);
  const { data: jobs, error } = await q;
  if (error) {
    ctx.summary.errors.push(error.message);
    return;
  }

  for (const job of jobs || []) {
    try {
      const vendorIds = await resolveVendors(supabase, job.property_id, job.category_id);
      const now = new Date().toISOString();
      if (vendorIds.length > 0) {
        const deadline = new Date(Date.now() + 7 * 86400000).toISOString();
        const { error: invErr } = await supabase.from('vendor_quote_requests').insert(
          vendorIds.map((vendor_id) => ({
            request_id: job.id,
            vendor_id,
            status: 'pending',
            response_deadline: deadline,
            invited_by: job.owner_id,
            invited_by_role: 'owner',
          }))
        );
        if (invErr && invErr.code !== '23505') throw invErr;
        await supabase
          .from('maintenance_requests')
          .update({
            visibility: 'invited',
            vendor_routed_at: now,
            mms_status: 'vendor_routed',
            acknowledged_at: now,
          })
          .eq('id', job.id);
        for (const vid of vendorIds) {
          await notify(
            supabase,
            vid,
            'maintenance_updated',
            'New job to quote',
            `Autopilot invited you to quote on "${job.title}".`,
            { request_id: job.id }
          );
        }
        await notify(
          supabase,
          job.owner_id,
          'maintenance_updated',
          'Autopilot routed a job',
          `Invited ${vendorIds.length} vendor(s) to quote on "${job.title}". You still accept the quote.`,
          { request_id: job.id }
        );
      } else {
        await supabase
          .from('maintenance_requests')
          .update({
            visibility: 'public',
            vendor_routed_at: now,
            mms_status: 'vendor_routed',
            acknowledged_at: now,
          })
          .eq('id', job.id);
        await notify(
          supabase,
          job.owner_id,
          'maintenance_updated',
          'Autopilot listed a job on the open market',
          `"${job.title}" is visible to vendors. Accept a quote when one lands.`,
          { request_id: job.id }
        );
      }
      ctx.summary.routed += 1;
    } catch (e) {
      ctx.summary.errors.push(`${job.id}: ${e instanceof Error ? e.message : 'route failed'}`);
    }
  }
}

async function resolveVendors(
  supabase: SupabaseClient,
  propertyId: string | null,
  categoryId: string | null
): Promise<string[]> {
  const ids = new Set<string>();
  if (propertyId) {
    let dq = supabase
      .from('dedicated_vendors')
      .select('vendor_id, category_id')
      .eq('property_id', propertyId)
      .eq('is_active', true);
    const { data: dedicated } = await dq;
    for (const row of dedicated || []) {
      if (!categoryId || !row.category_id || row.category_id === categoryId) ids.add(row.vendor_id);
    }
  }
  if (ids.size === 0 && categoryId) {
    const { data: services } = await supabase
      .from('vendor_services')
      .select('vendor_id')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .limit(8);
    for (const row of services || []) ids.add(row.vendor_id);
  }
  return [...ids].slice(0, 8);
}

async function chaseQuotes(
  supabase: SupabaseClient,
  ctx: { scopeOwnerId: string | null; summary: Summary }
) {
  const cutoff = new Date(Date.now() - 4 * 3600000).toISOString();
  let q = supabase
    .from('maintenance_requests')
    .select('id, title, owner_id, vendor_routed_at')
    .eq('status', 'open')
    .not('vendor_routed_at', 'is', null)
    .lte('vendor_routed_at', cutoff)
    .limit(40);
  if (ctx.scopeOwnerId) q = q.eq('owner_id', ctx.scopeOwnerId);
  const { data: jobs, error } = await q;
  if (error) {
    ctx.summary.errors.push(error.message);
    return;
  }

  for (const job of jobs || []) {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id')
      .eq('request_id', job.id)
      .eq('status', 'submitted')
      .limit(1);
    if (quotes && quotes.length > 0) continue;

    const since = new Date(Date.now() - 12 * 3600000).toISOString();
    const { data: recent } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', job.owner_id)
      .eq('title', 'Autopilot chasing quotes')
      .gte('created_at', since)
      .limit(1);
    if (recent && recent.length > 0) continue;

    const { data: invites } = await supabase
      .from('vendor_quote_requests')
      .select('vendor_id')
      .eq('request_id', job.id)
      .eq('status', 'pending');
    for (const inv of invites || []) {
      await notify(
        supabase,
        inv.vendor_id,
        'maintenance_updated',
        'Quote reminder',
        `Still waiting on a quote for "${job.title}".`,
        { request_id: job.id }
      );
    }
    await notify(
      supabase,
      job.owner_id,
      'maintenance_updated',
      'Autopilot chasing quotes',
      `No quotes yet on "${job.title}". Vendors were nudged.`,
      { request_id: job.id }
    );
    ctx.summary.quotes_chased += 1;
  }
}

async function evaluateArrears(
  supabase: SupabaseClient,
  ctx: { scopeOwnerId: string | null; scopeTenantId: string | null; summary: Summary }
) {
  let q = supabase
    .from('payments')
    .select('id, amount, due_date, status, lease_id, tenant_id, owner_id, property_id')
    .eq('status', 'pending')
    .limit(80);
  if (ctx.scopeOwnerId) q = q.eq('owner_id', ctx.scopeOwnerId);
  if (ctx.scopeTenantId) q = q.eq('tenant_id', ctx.scopeTenantId);
  const { data: payments, error } = await q;
  if (error) {
    ctx.summary.errors.push(error.message);
    return;
  }

  for (const payment of payments || []) {
    const days = daysOverdue(payment.due_date);
    const stage = stageForDays(days);
    if (!stage) continue;

    const interest = Math.round(Number(payment.amount) * 0.02 * (days / 365) * 100) / 100;
    const { data: existing } = await supabase
      .from('arrears_escalations')
      .select('id, stage')
      .eq('payment_id', payment.id)
      .neq('stage', 'resolved')
      .order('escalated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const cur = STAGE_ORDER.indexOf(existing.stage);
      const next = STAGE_ORDER.indexOf(stage);
      await supabase
        .from('arrears_escalations')
        .update({
          interest_accrued: interest,
          total_owed: Number(payment.amount) + interest,
          ...(next > cur ? { stage, escalated_at: new Date().toISOString() } : {}),
        })
        .eq('id', existing.id);
      if (next <= cur) continue;
    } else {
      const row: Record<string, unknown> = {
        payment_id: payment.id,
        lease_id: payment.lease_id,
        tenant_id: payment.tenant_id,
        owner_id: payment.owner_id,
        property_id: payment.property_id,
        stage,
        amount_owed: payment.amount,
        interest_accrued: interest,
        total_owed: Number(payment.amount) + interest,
      };
      if (stage === 'breach_notice') {
        const start = new Date();
        const end = new Date(start.getTime() + 20 * 86400000);
        row.cure_period_starts_at = start.toISOString();
        row.cure_period_ends_at = end.toISOString();
      }
      await supabase.from('arrears_escalations').insert(row);
    }

    const label =
      stage === 'friendly_reminder'
        ? 'Friendly rent reminder'
        : stage === 'formal_demand'
          ? 'Formal demand — rent overdue'
          : 'Breach notice — 20-day cure started';
    await notify(
      supabase,
      payment.tenant_id,
      'payment_overdue',
      label,
      `Rent of R ${Number(payment.amount).toFixed(2)} is ${days} day(s) overdue. Autopilot opened a ${stage.replace('_', ' ')} stage.`,
      { payment_id: payment.id }
    );
    await notify(
      supabase,
      payment.owner_id,
      'payment_overdue',
      'Autopilot escalated arrears',
      `Tenant is ${days} day(s) overdue (R ${Number(payment.amount).toFixed(2)}). Stage: ${stage}.`,
      { payment_id: payment.id }
    );
    ctx.summary.arrears += 1;
  }
}

async function viewingReminders(
  supabase: SupabaseClient,
  ctx: { scopeOwnerId: string | null; scopeTenantId: string | null; summary: Summary }
) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 3 * 3600000);
  let q = supabase
    .from('viewing_requests')
    .select(
      'id, owner_id, tenant_id, property_id, status, requested_date, requested_time, confirmed_date, reminder_sent_at'
    )
    .in('status', ['approved', 'confirmed', 'scheduled'])
    .is('reminder_sent_at', null)
    .limit(40);
  if (ctx.scopeOwnerId) q = q.eq('owner_id', ctx.scopeOwnerId);
  if (ctx.scopeTenantId) q = q.eq('tenant_id', ctx.scopeTenantId);
  const { data: rows, error } = await q;
  if (error) {
    ctx.summary.errors.push(error.message);
    return;
  }

  for (const v of rows || []) {
    const when = parseViewingWhen(v.confirmed_date, v.requested_date, v.requested_time);
    if (!when || when < now || when > windowEnd) continue;
    await supabase
      .from('viewing_requests')
      .update({ reminder_sent_at: now.toISOString() })
      .eq('id', v.id);
    const body = `Viewing starts around ${when.toISOString().slice(0, 16).replace('T', ' ')}.`;
    await notify(supabase, v.owner_id, 'viewing_reminder', 'Viewing reminder', body, {
      viewing_id: v.id,
    });
    await notify(supabase, v.tenant_id, 'viewing_reminder', 'Viewing reminder', body, {
      viewing_id: v.id,
    });
    ctx.summary.viewing_reminders += 1;
  }
}

function parseViewingWhen(
  confirmed: string | null,
  requestedDate: string | null,
  requestedTime: string | null
): Date | null {
  if (confirmed) {
    const d = new Date(confirmed);
    return isNaN(d.getTime()) ? null : d;
  }
  if (!requestedDate) return null;
  const t = requestedTime && requestedTime.length >= 4 ? requestedTime : '09:00';
  const d = new Date(`${String(requestedDate).slice(0, 10)}T${t.length === 5 ? t : t.slice(0, 8)}`);
  return isNaN(d.getTime()) ? null : d;
}
