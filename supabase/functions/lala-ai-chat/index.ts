// Lala AI — Supabase Edge Function (Groq + property context)
// Answers from the user's REAL data (leases, payments, maintenance, quotes,
// POs, earnings) rather than generic app-process descriptions.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { filterContextByTopics, howThisAppWorks, LALA_TOOLS } from './tools.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Groq retired llama-3.1-8b-instant and llama-3.3-70b-versatile (2026-08-16).
// Plane #95: planner must be tool-capable. Groq's documented 70B replacement:
// openai/gpt-oss-120b (override with GROQ_MODEL).
const GROQ_MODEL = Deno.env.get('GROQ_MODEL')?.trim() || 'openai/gpt-oss-120b';
const MAX_HISTORY = 12;
const MAX_TEXT_LEN = 2000;
const MAX_GROQ_RETRIES = 4;
// Backoff schedule for Groq rate limits (429 TPM/RPM) — the free tier window is
// 60s and requests now carry ~1.4k tokens, so short retries cannot clear it.
const GROQ_RETRY_DELAYS_MS = [2500, 5000, 10000];

type ChatBody = {
  text?: string;
  role?: string;
  property_id?: string | null;
  history?: { role: string; content: string }[];
};

// ─── Formatters ────────────────────────────────────────────────────────────

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
    `Interest on arrears (recorded): ${l.interest_on_arrears_rate != null ? `${l.interest_on_arrears_rate}% per year` : 'not recorded'}`,
  ];
  if (l.auto_converted_to_mtm) {
    lines.push(
      'Auto-converted to month-to-month (renewal_count: ' + String(l.renewal_count ?? 0) + ').'
    );
  }
  return lines.join('\n');
}

function fmtRentPayment(p: Record<string, unknown>): string {
  const prop = p.property as { title?: string } | null;
  const where = prop?.title ? ` @ ${prop.title}` : '';
  const due = p.due_date ? ` due ${String(p.due_date).slice(0, 10)}` : '';
  const paid = p.paid_date ? ` paid ${String(p.paid_date).slice(0, 10)}` : '';
  const owed =
    p.amount_outstanding != null && Number(p.amount_outstanding) > 0
      ? ` (R ${p.amount_outstanding} outstanding)`
      : '';
  const overdue = p.days_overdue ? `, ${p.days_overdue}d overdue` : '';
  return `[${p.status}] R ${p.amount ?? '—'}${where}${due}${paid}${owed}${overdue}`;
}

function fmtVendorPayment(p: Record<string, unknown>): string {
  const invoice = p.invoice as { invoice_number?: string | null } | null;
  const job = p.maintenance_request as { title?: string | null } | null;
  const ref = invoice?.invoice_number ? ` INV-${invoice.invoice_number}` : '';
  const jobRef = job?.title ? ` · ${job.title}` : '';
  return `[${p.payment_status}] R ${p.total_amount ?? '—'}${ref}${jobRef} (payout ${p.payout_status ?? '—'})`;
}

function fmtQuote(q: Record<string, unknown>): string {
  const prop = q.property as { title?: string } | null;
  const req = q.request as { title?: string } | null;
  const where = prop?.title ? ` @ ${prop.title}` : '';
  const what = req?.title ? ` · ${req.title}` : '';
  return `[${q.status}] R ${q.total_amount ?? q.subtotal ?? '—'}${what}${where} (${String(q.created_at || '').slice(0, 10)})`;
}

function fmtPO(p: Record<string, unknown>): string {
  return `[${p.status}] ${p.po_number || 'PO'} R ${p.total_amount ?? p.subtotal ?? '—'}${p.work_instructions ? ` · ${p.work_instructions}` : ''}`;
}

// ─── Context builders (REAL user data) ────────────────────────────────────

async function buildTenantContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  propertyId: string | null
): Promise<string> {
  let leaseQuery = supabase
    .from('leases')
    .select(
      'status, lease_type, start_date, end_date, monthly_rent, payment_due_day, renewal_count, auto_converted_to_mtm, ' +
        'deposit_amount, deposit_refund_status, deposit_refund_amount, deposit_refund_deadline, ' +
        'rent_escalation_type, rent_escalation_value, rent_escalation_frequency_months, ' +
        'early_termination_notice_period_days, early_termination_penalty, interest_on_arrears_rate, ' +
        'property:properties(id, title, address, city, rent_amount, status)'
    )
    .eq('tenant_id', userId)
    .in('status', ['active', 'pending_tenant_signature', 'pending_owner_signature'])
    .order('created_at', { ascending: false })
    .limit(5);

  if (propertyId) {
    leaseQuery = leaseQuery.eq('property_id', propertyId);
  }

  const [leaseRes, payRes, vendorPayRes, maintRes] = await Promise.all([
    leaseQuery,
    // Rent payments owed/paid by this tenant
    supabase
      .from('payments')
      .select(
        'amount, amount_outstanding, days_overdue, status, due_date, paid_date, property:properties(title)'
      )
      .eq('tenant_id', userId)
      .order('due_date', { ascending: false })
      .limit(8), // Vendor invoices the tenant owes — filter owed statuses in SQL FIRST, then
    // limit, so an older unpaid invoice is never dropped by a recency cap.
    supabase
      .from('vendor_payments')
      .select(
        'total_amount, payment_status, payout_status, created_at, invoice:invoice_id(invoice_number), maintenance_request:maintenance_request_id(title)'
      )
      .eq('tenant_id', userId)
      .in('payment_status', ['pending', 'processing', 'failed'])
      .order('created_at', { ascending: false })
      .limit(6),
    // Maintenance the tenant raised
    supabase
      .from('maintenance_requests')
      .select('title, status, priority, created_at')
      .eq('tenant_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const parts: string[] = [];

  const leases = leaseRes.data as Record<string, unknown>[] | null;
  if (leases?.length) {
    parts.push(
      'LEASES:\n' +
        leases
          .map((l) => {
            const prop = l.property as Record<string, unknown> | null;
            const propBlock = prop ? fmtProperty(prop) : 'Property details unavailable';
            return `${propBlock}\n${fmtLease(l)}`;
          })
          .join('\n\n')
    );
  } else {
    parts.push('LEASES: none active');
  }

  const payments = payRes.data as Record<string, unknown>[] | null;
  if (payments?.length) {
    const open = payments.filter(
      (p) => p.status === 'pending' || p.status === 'overdue' || Number(p.amount_outstanding) > 0
    );
    parts.push(
      'RENT PAYMENTS:\n' +
        payments.map((p) => fmtRentPayment(p)).join('\n') +
        (open.length
          ? `\nOpen: ${open.length} (${open.filter((p) => p.status === 'overdue').length} overdue)`
          : '')
    );
  } else {
    parts.push('RENT PAYMENTS: none recorded');
  }
  const owedVendor = vendorPayRes.data as Record<string, unknown>[] | null;
  if (owedVendor?.length) {
    parts.push(
      'VENDOR PAYMENTS YOU OWE:\n' + owedVendor.map((p) => fmtVendorPayment(p)).join('\n')
    );
  } else {
    parts.push('VENDOR PAYMENTS: none currently owed');
  }

  const maint = maintRes.data as Record<string, unknown>[] | null;
  if (maint?.length) {
    const openMaint = maint.filter(
      (m) => !['completed', 'cancelled', 'closed'].includes(String(m.status))
    );
    parts.push(
      'MAINTENANCE YOU RAISED:\n' +
        maint.map((m) => fmtMaintenance(m)).join('\n') +
        (openMaint.length ? `\nOpen: ${openMaint.length}` : '')
    );
  } else {
    parts.push('MAINTENANCE YOU RAISED: none');
  }

  const { data: arrears } = await supabase
    .from('arrears_escalations')
    .select('stage, amount_owed, interest_accrued, total_owed, escalated_at')
    .eq('tenant_id', userId)
    .is('resolved_at', null)
    .order('escalated_at', { ascending: false })
    .limit(8);
  if (arrears?.length) {
    parts.push(
      'ARREARS:\n' +
        arrears
          .map(
            (a: Record<string, unknown>) =>
              `  [${a.stage}] owed R ${a.amount_owed} + interest R ${a.interest_accrued} = R ${a.total_owed}`
          )
          .join('\n')
    );
  } else {
    parts.push('ARREARS: none open');
  }

  const propIds = (leases || [])
    .map((l) => (l.property as { id?: string } | null)?.id)
    .filter(Boolean) as string[];
  if (propIds.length) {
    const { data: invs } = await supabase
      .from('maintenance_invoices')
      .select('invoice_number, status, total_amount, payer_role')
      .in('property_id', propIds)
      .eq('payer_role', 'tenant')
      .order('created_at', { ascending: false })
      .limit(6);
    parts.push(
      invs?.length
        ? 'MAINTENANCE INVOICES (you are payer):\n' +
            invs
              .map(
                (inv: Record<string, unknown>) =>
                  `  [${inv.status}] ${inv.invoice_number} R ${inv.total_amount}`
              )
              .join('\n')
        : 'MAINTENANCE INVOICES: none'
    );
  }

  return parts.join('\n\n');
}

async function buildVendorContext(
  supabase: ReturnType<typeof createClient>,
  vendorId: string
): Promise<string> {
  const [jobRes, poRes, quoteRes, earningsRes] = await Promise.all([
    // Active jobs assigned to this vendor
    supabase
      .from('maintenance_requests')
      .select('title, status, priority, created_at, property:properties(title, address, city)')
      .eq('selected_vendor_id', vendorId)
      .in('status', ['assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(6),
    // Purchase orders for this vendor (purchase_orders has NO vendor_id column;
    // link via maintenance_requests.po_id -> purchase_orders.id, confirmed live FK)
    supabase
      .from('maintenance_requests')
      .select('po:po_id(po_number, status, total_amount, subtotal, created_at, work_instructions)')
      .eq('selected_vendor_id', vendorId)
      .not('po_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(6),
    // Quotes this vendor has submitted
    supabase
      .from('quotes')
      .select(
        'status, subtotal, total_amount, created_at, request:request_id(title), property:properties(title)'
      )
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(6), // Earnings / payout status from vendor_payments — NO row limit: totals must
    // be exact across ALL transactions (get-vendor-earnings does the same). The
    // display slice below caps the 'Recent:' line instead.
    supabase
      .from('vendor_payments')
      .select(
        'total_amount, vendor_payout, platform_fee, payout_fee, payment_status, payout_status, paid_at, invoice:invoice_id(invoice_number), maintenance_request:maintenance_request_id(title)'
      )
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false }),
  ]);

  const parts: string[] = [];

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
  parts.push(`ACTIVE JOBS:\n${activeJobs}`);
  const poRows = (poRes.data || []) as Array<{ po?: Record<string, unknown> | null }>;
  const purchaseOrders =
    poRows
      .filter((r) => r.po)
      .map((r) => `  ${fmtPO(r.po!)} | ${String(r.po?.created_at || '').slice(0, 10)}`)
      .join('\n') || 'No purchase orders.';
  parts.push(`PURCHASE ORDERS:\n${purchaseOrders}`);

  const quotes =
    quoteRes.data?.map((q: Record<string, unknown>) => `  ${fmtQuote(q)}`).join('\n') ||
    'No quotes submitted.';
  parts.push(`QUOTES SUBMITTED:\n${quotes}`);

  // Earnings summary from vendor_payments (mirrors get-vendor-earnings)
  const vps = (earningsRes.data || []) as Record<string, unknown>[];
  const completed = vps.filter((p) => p.payment_status === 'completed');
  const totalEarned = completed.reduce((s, p) => s + Number(p.vendor_payout || 0), 0);
  const pendingPayouts = completed.filter((p) => p.payout_status === 'pending');
  const pendingTotal = pendingPayouts.reduce((s, p) => s + Number(p.vendor_payout || 0), 0);
  parts.push(
    `EARNINGS:\n` +
      (vps.length
        ? `  Total earned (net): R ${totalEarned.toFixed(2)}\n` +
          `  Pending payout: ${pendingPayouts.length} payment(s) totalling R ${pendingTotal.toFixed(2)}\n` +
          `  Recent: ${vps
            .slice(0, 6)
            .map((p) => fmtVendorPayment(p))
            .join(' | ')}`
        : `  No earnings recorded yet.`)
  );

  const { data: invs } = await supabase
    .from('maintenance_invoices')
    .select('invoice_number, status, total_amount, payer_role')
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(8);
  parts.push(
    invs?.length
      ? 'MAINTENANCE INVOICES:\n' +
          invs
            .map(
              (inv: Record<string, unknown>) =>
                `  [${inv.status}] ${inv.invoice_number} R ${inv.total_amount}`
            )
            .join('\n')
      : 'MAINTENANCE INVOICES: none'
  );

  return parts.join('\n\n');
}

async function buildOwnerContext(
  supabase: ReturnType<typeof createClient>,
  ownerId: string
): Promise<string> {
  const [propRes, maintRes, leaseRes, rentPayRes, quoteRes, poRes] = await Promise.all([
    supabase
      .from('properties')
      .select('title, status, rent_amount, address, city')
      .eq('owner_id', ownerId)
      .limit(10),
    supabase
      .from('maintenance_requests')
      .select(
        'title, status, priority, created_at, po:po_id(po_number, status, total_amount, subtotal, created_at, work_instructions)'
      )
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('leases')
      .select(
        'status, lease_type, start_date, end_date, monthly_rent, payment_due_day, renewal_count, auto_converted_to_mtm, ' +
          'deposit_amount, deposit_refund_status, deposit_refund_amount, deposit_refund_deadline, ' +
          'rent_escalation_type, rent_escalation_value, rent_escalation_frequency_months, ' +
          'early_termination_notice_period_days, early_termination_penalty, interest_on_arrears_rate, ' +
          'tenant:profiles!tenant_id(full_name), property:properties(title)'
      )
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .limit(6),
    // Rent payments on this owner's properties
    supabase
      .from('payments')
      .select(
        'amount, amount_outstanding, days_overdue, status, due_date, paid_date, tenant:profiles!tenant_id(full_name), property:properties(title)'
      )
      .eq('owner_id', ownerId)
      .order('due_date', { ascending: false })
      .limit(10),
    // Quotes awaiting owner decision
    supabase
      .from('quotes')
      .select(
        'status, subtotal, total_amount, created_at, request:request_id(title), property:properties(title)'
      )
      .eq('owner_id', ownerId)
      .in('status', ['submitted', 'requested', 'revision_requested'])
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  const parts: string[] = [];

  const properties =
    propRes.data?.map((p) => fmtProperty(p as Record<string, unknown>)).join('\n') ||
    'No properties.';
  parts.push(`PROPERTIES:\n${properties}`);

  const maintenance =
    maintRes.data?.map((m) => fmtMaintenance(m as Record<string, unknown>)).join('\n') ||
    'No maintenance requests.';
  const openMaint =
    maintRes.data?.filter(
      (m) => !['completed', 'cancelled', 'closed'].includes(String(m.status))
    ) || [];
  parts.push(
    `MAINTENANCE:\n${maintenance}${openMaint.length ? `\nOpen: ${openMaint.length}` : ''}`
  );

  const leases =
    leaseRes.data
      ?.map((l: Record<string, unknown>) => {
        const tenant = l.tenant as { full_name?: string } | null;
        const prop = l.property as { title?: string } | null;
        return `  - ${prop?.title || '?'} (${tenant?.full_name || 'Tenant'}):\n${fmtLease(l).replace(/^/gm, '      ')}`;
      })
      .join('\n') || 'No active leases.';
  parts.push(`ACTIVE LEASES:\n${leases}`);

  // Rent payments (actuals)
  const rentPays = rentPayRes.data as Record<string, unknown>[] | null;
  if (rentPays?.length) {
    const overdue = rentPays.filter((p) => p.status === 'overdue' || Number(p.days_overdue) > 0);
    const pending = rentPays.filter((p) => p.status === 'pending' || p.status === 'partial');
    parts.push(
      'RENT COLLECTIONS:\n' +
        rentPays
          .map((p) => {
            const tenant = p.tenant as { full_name?: string } | null;
            const prop = p.property as { title?: string } | null;
            const label = [tenant?.full_name, prop?.title].filter(Boolean).join(' @ ');
            return `  [${p.status}] R ${p.amount ?? '—'} ${label ? `(${label})` : ''}${p.due_date ? ` due ${String(p.due_date).slice(0, 10)}` : ''}${p.paid_date ? ` paid ${String(p.paid_date).slice(0, 10)}` : ''}${Number(p.days_overdue) > 0 ? `, ${p.days_overdue}d overdue` : ''}`;
          })
          .join('\n') +
        (overdue.length || pending.length
          ? `\nNeeds attention: ${overdue.length} overdue, ${pending.length} pending`
          : '')
    );
  } else {
    parts.push('RENT COLLECTIONS: none recorded');
  }

  // Quotes awaiting decision
  const pendingQuotes = quoteRes.data as Record<string, unknown>[] | null;
  parts.push(
    pendingQuotes?.length
      ? `QUOTES AWAITING YOUR DECISION:\n${pendingQuotes.map((q) => `  ${fmtQuote(q)}`).join('\n')}`
      : 'QUOTES AWAITING YOUR DECISION: none'
  );

  // Purchase orders (linked via maintenance_requests.po_id -> purchase_orders.id;
  // purchase_orders has no owner_id column)
  const poRows = (maintRes.data || []) as Array<{ po?: Record<string, unknown> | null }>;
  const pos = poRows.filter((r) => r.po).map((r) => r.po!);
  const seenPo = new Set<string>();
  const uniquePos = pos.filter((p) => {
    const k = String(p.po_number as string);
    if (seenPo.has(k)) return false;
    seenPo.add(k);
    return true;
  });
  parts.push(
    uniquePos.length
      ? `PURCHASE ORDERS:\n${uniquePos.map((p) => `  ${fmtPO(p)} | ${String(p.created_at || '').slice(0, 10)}`).join('\n')}`
      : 'PURCHASE ORDERS: none'
  );

  const { data: arrears } = await supabase
    .from('arrears_escalations')
    .select('stage, amount_owed, interest_accrued, total_owed, tenant_id')
    .eq('owner_id', ownerId)
    .is('resolved_at', null)
    .order('escalated_at', { ascending: false })
    .limit(8);
  parts.push(
    arrears?.length
      ? 'ARREARS:\n' +
          arrears
            .map(
              (a: Record<string, unknown>) =>
                `  [${a.stage}] R ${a.total_owed} (principal R ${a.amount_owed}, interest R ${a.interest_accrued})`
            )
            .join('\n')
      : 'ARREARS: none open'
  );

  const { data: invs } = await supabase
    .from('maintenance_invoices')
    .select('invoice_number, status, total_amount, payer_role')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(8);
  parts.push(
    invs?.length
      ? 'MAINTENANCE INVOICES:\n' +
          invs
            .map(
              (inv: Record<string, unknown>) =>
                `  [${inv.status}] ${inv.invoice_number} R ${inv.total_amount} (payer ${inv.payer_role})`
            )
            .join('\n')
      : 'MAINTENANCE INVOICES: none'
  );

  return parts.join('\n\n');
}

function systemPrompt(role: string): string {
  const who =
    role === 'owner'
      ? 'PROPERTY OWNER'
      : role === 'vendor'
        ? 'SERVICE PROVIDER (vendor)'
        : 'TENANT';
  return (
    'You are Lala, the LaLarente assistant for South African residential rentals. Be professional and concise (max 4 sentences unless listing).\n' +
    `You are speaking with a ${who}.\n` +
    'You have tools: lookup (live rows), how_this_app_works (where to tap), and for OWNERS run_owner_autopilot (route jobs, chase quotes, arrears, viewing reminders — never accept quotes or pay).\n' +
    'For money, dates, statuses, lease terms, jobs, quotes, or earnings: call lookup with the smallest topic list that answers the question. Quote only tool results. Never invent amounts.\n' +
    'For “what happens if I don’t pay rent?” call how_this_app_works topic late_rent AND lookup arrears/lease. Never invent interest rates.\n' +
    'For “how do I…” navigation: call how_this_app_works. Tenant bottom tabs are only Home, Search, Payments, Profile, Lala AI — never mention a Vendor Payments tab.\n' +
    'When an owner asks you to handle maintenance, chase vendors, or run the portfolio: call run_owner_autopilot then summarize counts. Never auto-accept a quote.\n' +
    'Vendor communication is in-app only. Never suggest calling, emailing, WhatsApp, or sharing a vendor phone number with an owner or tenant.\n' +
    'Do not give legal advice. Never invent bank details or payment references.\n' +
    'Screening/credit/FICA: Run screening is RSA ID + affordability + references, not TransUnion — say so if asked.\n' +
    '3D tours are pasted Matterport/Polycam links, not generated from listing photos.'
  );
}

// ─── Groq call with retry/backoff for rate limits (429) and 5xx ───────────
type GroqChatMessage = {
  role: string;
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>;
  tool_call_id?: string;
};

async function callGroq(
  groqKey: string,
  messages: GroqChatMessage[],
  withTools: boolean
): Promise<{ message?: GroqChatMessage; error?: string }> {
  let lastErr = '';
  for (let attempt = 1; attempt <= MAX_GROQ_RETRIES; attempt++) {
    let groqRes: Response;
    try {
      groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
          ...(withTools ? { tools: LALA_TOOLS, tool_choice: 'auto' } : {}),
        }),
      });
    } catch (e) {
      lastErr = `network: ${e instanceof Error ? e.message : 'unknown'}`;
      if (attempt < MAX_GROQ_RETRIES) {
        await new Promise((r) => setTimeout(r, GROQ_RETRY_DELAYS_MS[attempt - 1] ?? 3000));
        continue;
      }
      break;
    }

    if (groqRes.ok) {
      const groqJson = await groqRes.json();
      const message = groqJson?.choices?.[0]?.message as GroqChatMessage | undefined;
      if (message && (message.content || message.tool_calls?.length)) {
        return { message };
      }
      lastErr = 'empty AI response';
      if (attempt < MAX_GROQ_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      break;
    }

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
    lastErr = `HTTP ${groqRes.status}: ${errSummary}`;
    console.error('Groq error:', groqRes.status, errSummary);

    // Retry only rate limits and server errors; 4xx (except 429) are not retryable.
    const retryable = groqRes.status === 429 || groqRes.status >= 500;
    if (!retryable || attempt >= MAX_GROQ_RETRIES) break;
    await new Promise((r) => setTimeout(r, GROQ_RETRY_DELAYS_MS[attempt - 1] ?? 3000));
  }
  return { error: lastErr || 'AI provider error' };
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

    const messages: GroqChatMessage[] = [{ role: 'system', content: systemPrompt(role) }];

    for (const turn of (body.history ?? []).slice(-MAX_HISTORY)) {
      if (turn?.role === 'user' || turn?.role === 'assistant') {
        messages.push({
          role: turn.role,
          content: String(turn.content ?? '').slice(0, MAX_TEXT_LEN),
        });
      }
    }
    messages.push({ role: 'user', content: text });

    let fullContext: string | null = null;
    async function loadFullContext(): Promise<string> {
      if (fullContext) return fullContext;
      fullContext =
        role === 'owner'
          ? await buildOwnerContext(admin, user.id)
          : role === 'vendor'
            ? await buildVendorContext(admin, user.id)
            : await buildTenantContext(admin, user.id, body.property_id ?? null);
      return fullContext;
    }

    let reply = '';
    let lastError = '';
    for (let round = 0; round < 4; round++) {
      const { message, error } = await callGroq(groqKey, messages, true);
      if (!message) {
        lastError = error || 'AI provider error';
        break;
      }
      const toolCalls = message.tool_calls || [];
      if (!toolCalls.length) {
        reply = String(message.content || '').trim();
        break;
      }
      messages.push({
        role: 'assistant',
        content: message.content ?? null,
        tool_calls: toolCalls,
      });
      for (const call of toolCalls) {
        const name = call.function?.name || '';
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.function?.arguments || '{}');
        } catch {
          args = {};
        }
        let result = 'tool error';
        if (name === 'lookup') {
          const topics = Array.isArray(args.topics) ? args.topics.map(String) : [];
          result = filterContextByTopics(await loadFullContext(), topics);
        } else if (name === 'how_this_app_works') {
          result = howThisAppWorks(role, String(args.topic || ''));
        } else if (name === 'run_owner_autopilot') {
          if (role !== 'owner' && role !== 'admin') {
            result = 'Autopilot is an owner tool. Tenants and vendors cannot run it.';
          } else {
            const autoRes = await fetch(`${supabaseUrl}/functions/v1/owner-autopilot`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ owner_id: user.id }),
            });
            const autoBody = await autoRes.json().catch(() => ({}));
            result = JSON.stringify(autoBody).slice(0, 4000);
          }
        } else {
          result = `unknown tool ${name}`;
        }
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result.slice(0, 8000),
        });
      }
    }

    if (!reply) {
      const ctx = await loadFullContext();
      const fallback: GroqChatMessage[] = [
        { role: 'system', content: systemPrompt(role) },
        {
          role: 'user',
          content: `${text}\n\nLOOKUP RESULT:\n${ctx.slice(0, 6000)}`,
        },
      ];
      const again = await callGroq(groqKey, fallback, false);
      reply = String(again.message?.content || '').trim();
      lastError = again.error || lastError;
    }

    if (!reply) {
      return new Response(JSON.stringify({ error: lastError || 'AI provider error' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ reply }), {
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
