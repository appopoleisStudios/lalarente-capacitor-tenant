// Lala AI — Supabase Edge Function (Groq + property context)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_MODEL = Deno.env.get('GROQ_MODEL')?.trim() || 'llama-3.1-8b-instant';
const MAX_HISTORY = 12;
const MAX_TEXT_LEN = 2000;

type ChatBody = {
  text?: string;
  role?: string;
  property_id?: string | null;
  history?: { role: string; content: string }[];
};

function fmtProperty(p: Record<string, unknown>): string {
  const title = (p.title as string) || 'Untitled';
  const status = (p.status as string) || '—';
  const rent = p.rent_amount != null ? `R ${p.rent_amount}` : (p.price as string) || '—';
  const address = [p.address, p.city].filter(Boolean).join(', ') || (p.location as string) || '—';
  return `Property: ${title}\n  Status: ${status}\n  Rent/Price: ${rent}\n  Address: ${address}`;
}

function fmtMaintenance(m: Record<string, unknown>): string {
  return `[${m.status}] ${m.title || 'Request'} — ${m.priority || 'normal'} priority (${String(m.created_at || '').slice(0, 10)})`;
}

function fmtLease(l: Record<string, unknown>): string {
  const escVal = l.rent_escalation_value;
  const escType = (l.rent_escalation_type as string) || '';
  const escFreq = l.rent_escalation_frequency_months ?? '—';
  // DB enum (migration 006) is fixed_percentage | fixed_amount | cpi_linked.
  // Map each explicitly — the old `escType === 'fixed'` check never matched, so
  // a fixed_amount of 500 was printed as "500%" (a lying CONTEXT string).
  // cpi_linked has no owner-set value to quote, so print it as CPI-linked only.
  let escalation = 'not specified';
  if (escType === 'fixed_percentage') {
    escalation = `${escVal ?? '—'}% every ${escFreq} month(s)`;
  } else if (escType === 'fixed_amount') {
    escalation = `R ${escVal ?? '—'} every ${escFreq} month(s)`;
  } else if (escType === 'cpi_linked') {
    escalation = `CPI-linked every ${escFreq} month(s)`;
  }
  const deposit =
    l.deposit_amount != null
      ? `R ${l.deposit_amount}${l.deposit_refund_status ? ` (refund ${l.deposit_refund_status}${l.deposit_refund_amount != null ? `, R ${l.deposit_refund_amount}` : ''}${l.deposit_refund_deadline ? `, by ${String(l.deposit_refund_deadline).slice(0, 10)}` : ''})` : ''}`
      : 'not recorded';
  const lines = [
    `Lease: ${l.lease_type || 'standard'} (status ${l.status})`,
    `Period: ${String(l.start_date || '').slice(0, 10)} to ${String(l.end_date || '').slice(0, 10)}`,
    `Rent: R ${l.monthly_rent ?? '—'} per month, due day ${l.payment_due_day ?? '—'}`,
    `Deposit: ${deposit}`,
    `Escalation: ${escalation}`,
    `Early termination: notice ${l.early_termination_notice_period_days ?? '—'} day(s)${l.early_termination_penalty != null ? `, penalty R ${l.early_termination_penalty}` : ''}`,
  ];
  if (l.auto_converted_to_mtm) {
    lines.push(
      'Auto-converted to month-to-month (renewal_count: ' + String(l.renewal_count ?? 0) + ').'
    );
  }
  return lines.join('\n');
}

async function buildTenantContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  propertyId: string | null
): Promise<string> {
  let query = supabase
    .from('leases')
    .select(
      'status, lease_type, start_date, end_date, monthly_rent, payment_due_day, renewal_count, auto_converted_to_mtm, ' +
        'deposit_amount, deposit_refund_status, deposit_refund_amount, deposit_refund_deadline, ' +
        'rent_escalation_type, rent_escalation_value, rent_escalation_frequency_months, ' +
        'early_termination_notice_period_days, early_termination_penalty, ' +
        'property:properties(id, title, address, city, rent_amount, status)'
    )
    .eq('tenant_id', userId)
    .in('status', ['active', 'pending_tenant_signature', 'pending_owner_signature'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (propertyId) {
    query = query.eq('property_id', propertyId);
  }

  const { data: leases } = await query;
  if (!leases?.length) {
    return 'No active lease found for this tenant.';
  }

  return leases
    .map((l: Record<string, unknown>) => {
      const prop = l.property as Record<string, unknown> | null;
      const propBlock = prop ? fmtProperty(prop) : 'Property details unavailable';
      return `${propBlock}\n${fmtLease(l)}`;
    })
    .join('\n\n');
}

async function buildVendorContext(
  supabase: ReturnType<typeof createClient>,
  vendorId: string
): Promise<string> {
  const [jobRes, poRes] = await Promise.all([
    // Active jobs assigned to this vendor
    supabase
      .from('maintenance_requests')
      .select('title, status, priority, created_at, property:properties(title, address, city)')
      .eq('selected_vendor_id', vendorId)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(8),
    // Purchase orders for this vendor
    supabase
      .from('purchase_orders')
      .select('status, total_amount, created_at')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const activeJobs =
    jobRes.data
      ?.map((j: Record<string, unknown>) => {
        const prop = j.property as { title?: string; address?: string; city?: string } | null;
        const loc = prop
          ? `${prop.title || ''} (${[prop.address, prop.city].filter(Boolean).join(', ') || '?'})`
          : '?';
        return `  [${j.status}] ${j.title} — ${loc} | ${String(j.created_at || '').slice(0, 10)}`;
      })
      .join('\n') || 'No active jobs.';
  const purchaseOrders =
    poRes.data
      ?.map((po: Record<string, unknown>) => {
        return `  [${po.status}] R ${po.total_amount ?? '?'} | ${String(po.created_at || '').slice(0, 10)}`;
      })
      .join('\n') || 'No purchase orders.';

  return `ACTIVE JOBS:\n${activeJobs}\n\nPURCHASE ORDERS:\n${purchaseOrders}`;
}

async function buildOwnerContext(
  supabase: ReturnType<typeof createClient>,
  ownerId: string
): Promise<string> {
  const [propRes, maintRes, leaseRes] = await Promise.all([
    supabase
      .from('properties')
      .select('title, status, rent_amount, address, city')
      .eq('owner_id', ownerId)
      .limit(10),
    supabase
      .from('maintenance_requests')
      .select('title, status, priority, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('leases')
      .select(
        'status, lease_type, start_date, end_date, monthly_rent, payment_due_day, renewal_count, auto_converted_to_mtm, ' +
          'deposit_amount, deposit_refund_status, deposit_refund_amount, deposit_refund_deadline, ' +
          'rent_escalation_type, rent_escalation_value, rent_escalation_frequency_months, ' +
          'early_termination_notice_period_days, early_termination_penalty, ' +
          'tenant:profiles!tenant_id(full_name), property:properties(title)'
      )
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .limit(8),
  ]);

  const properties =
    propRes.data?.map((p) => fmtProperty(p as Record<string, unknown>)).join('\n') ||
    'No properties.';
  const maintenance =
    maintRes.data?.map((m) => fmtMaintenance(m as Record<string, unknown>)).join('\n') ||
    'No maintenance requests.';
  const leases =
    leaseRes.data
      ?.map((l: Record<string, unknown>) => {
        const tenant = l.tenant as { full_name?: string } | null;
        const prop = l.property as { title?: string } | null;
        return `  - ${prop?.title || '?'} (${tenant?.full_name || 'Tenant'}):\n${fmtLease(l).replace(/^/gm, '      ')}`;
      })
      .join('\n') || 'No active leases.';

  return `PROPERTIES:\n${properties}\n\nMAINTENANCE:\n${maintenance}\n\nACTIVE LEASES:\n${leases}`;
}

function systemPrompt(role: string, context: string): string {
  // Merged: #153 lease-term quoting rule + #91 money/action guardrails.
  const base =
    'You are Lala, the LaLarente assistant for South African residential rentals. Be professional, concise (max 4 sentences unless listing). ' +
    'Never invent data not in CONTEXT. If unknown, say to check the app or contact the other party. ' +
    'Do not give legal advice, and never invent bank account numbers, payment references, or contract terms — ' +
    'point users to the in-app screen where they can act (Payments, Pay Vendor, Maintenance, Earnings & Banking).\n\n' +
    'When asked about lease terms (e.g. "what does my lease say", rent, deposit, escalation, notice period, payment due date), ' +
    'quote the actual values from CONTEXT — period, monthly rent, due day, deposit and refund status, escalation, ' +
    'early-termination terms. If a specific term is not present in CONTEXT, say it is not recorded rather than guessing.';

  // Plane #91 — role playbooks teach this app's vocabulary and flows.
  const playbooks: Record<string, string> = {
    tenant:
      "TENANT PLAYBOOK — explain this app's flows: “Pay rent” lives in the Payments tab (rent invoice → PayFast secure checkout). " +
      '“Pay Vendor” is an approved vendor invoice the tenant owes — pay it from the Vendor Payments screen in-app. ' +
      '“Closure confirm” is when the owner approves a completed maintenance job and forwards it to you to verify/close. ' +
      'Maintenance: raise a request from the Maintenance tab with photos. Lease: view terms/expiry from your tenancy shortcuts.',
    owner:
      "OWNER PLAYBOOK — explain this app's flows: “Needs attention” is the dashboard hub of urgent items (closures to review, invoices to approve). " +
      '“Approve an invoice” happens on the invoice screen (Approve/Reject). ' +
      '“Forward a closure” = review vendor closure evidence, approve, forward to the tenant to verify, then the work order report is sent. ' +
      '“Early termination” is negotiated in the Lease Renewal flow. Vendor payouts are vendor-side (Earnings & Banking).',
    vendor:
      "VENDOR PLAYBOOK — explain this app's flows: payouts are driven by completed/approved vendor payments — see Earnings & Banking for balance, schedule, and bank details. " +
      'Contracts live under Profile → Contracts. “Request closure” happens from a job after work is done (with photos). ' +
      'Quotes: submit a quote with price + duration from the job detail. Money questions: point to Earnings & Banking; never invent amounts.',
  };

  const roleLine =
    role === 'owner'
      ? 'You speak with a PROPERTY OWNER.'
      : role === 'vendor'
        ? 'You speak with a SERVICE PROVIDER (vendor) who handles maintenance jobs.'
        : 'You speak with a TENANT.';

  return `${base}\n\n${roleLine}\n\n${playbooks[role] ?? ''}\n\nCONTEXT:\n${context}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const token = authHeader.slice('Bearer '.length);

    const admin = createClient(supabaseUrl, serviceKey);
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(token);
    if (userError || !user) {
      console.error('Invalid session:', userError?.message ?? 'no user');
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as ChatBody;
    const text = (body.text ?? '').trim();
    const role = (body.role ?? 'tenant').toLowerCase();
    if (!text || text.length > MAX_TEXT_LEN) {
      return new Response(JSON.stringify({ error: 'Invalid message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (role !== 'tenant' && role !== 'owner' && role !== 'vendor') {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.role) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const profileRole = String(profile.role);
    if (profileRole !== role && profileRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Role mismatch' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqKey = Deno.env.get('GROQ_API_KEY')?.trim();
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const context =
      role === 'owner'
        ? await buildOwnerContext(admin, user.id)
        : role === 'vendor'
          ? await buildVendorContext(admin, user.id)
          : await buildTenantContext(admin, user.id, body.property_id ?? null);

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt(role, context) },
    ];

    for (const turn of (body.history ?? []).slice(-MAX_HISTORY)) {
      if (turn?.role === 'user' || turn?.role === 'assistant') {
        messages.push({
          role: turn.role,
          content: String(turn.content ?? '').slice(0, MAX_TEXT_LEN),
        });
      }
    }
    messages.push({ role: 'user', content: text });

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        max_tokens: 512,
        temperature: 0.4,
      }),
    });

    if (!groqRes.ok) {
      let errSummary = groqRes.statusText || 'unknown';
      try {
        const errJson = await groqRes.json();
        const msg = errJson?.error?.message ?? errJson?.message;
        if (typeof msg === 'string' && msg.length > 0) {
          errSummary = msg.slice(0, 200);
        }
      } catch {
        /* ignore non-JSON body */
      }
      console.error('Groq error:', groqRes.status, errSummary);
      return new Response(JSON.stringify({ error: 'AI provider error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const groqJson = await groqRes.json();
    const reply = groqJson?.choices?.[0]?.message?.content;
    if (!reply || typeof reply !== 'string') {
      return new Response(JSON.stringify({ error: 'Empty AI response' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ reply: reply.trim() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('lala-ai-chat error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
