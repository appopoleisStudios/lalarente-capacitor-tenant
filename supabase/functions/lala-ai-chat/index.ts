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

async function buildTenantContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  propertyId: string | null
): Promise<string> {
  let query = supabase
    .from('leases')
    .select('status, monthly_rent, end_date, property:properties(id, title, address, city, rent_amount, status)')
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
      return `${propBlock}\n  Lease status: ${l.status}\n  Monthly rent: R ${l.monthly_rent ?? '—'}\n  Ends: ${String(l.end_date || '—').slice(0, 10)}`;
    })
    .join('\n\n');
}

async function buildOwnerContext(
  supabase: ReturnType<typeof createClient>,
  ownerId: string
): Promise<string> {
  const [propRes, maintRes, leaseRes] = await Promise.all([
    supabase.from('properties').select('title, status, rent_amount, address, city').eq('owner_id', ownerId).limit(10),
    supabase
      .from('maintenance_requests')
      .select('title, status, priority, created_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('leases')
      .select('status, monthly_rent, end_date, tenant:profiles!tenant_id(full_name), property:properties(title)')
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .limit(8),
  ]);

  const properties =
    propRes.data?.map((p) => fmtProperty(p as Record<string, unknown>)).join('\n') || 'No properties.';
  const maintenance =
    maintRes.data?.map((m) => fmtMaintenance(m as Record<string, unknown>)).join('\n') ||
    'No maintenance requests.';
  const leases =
    leaseRes.data
      ?.map((l: Record<string, unknown>) => {
        const tenant = l.tenant as { full_name?: string } | null;
        const prop = l.property as { title?: string } | null;
        return `  - ${prop?.title || '?'}: ${tenant?.full_name || 'Tenant'} | R ${l.monthly_rent ?? '?'} | ends ${String(l.end_date || '').slice(0, 10)}`;
      })
      .join('\n') || 'No active leases.';

  return `PROPERTIES:\n${properties}\n\nMAINTENANCE:\n${maintenance}\n\nACTIVE LEASES:\n${leases}`;
}

function systemPrompt(role: string, context: string): string {
  const base =
    'You are Lala, the LaLarente assistant for South African residential rentals. Be professional, concise (max 4 sentences unless listing). Never invent data not in CONTEXT. If unknown, say to check the app or contact the other party. Do not give legal advice.';

  if (role === 'owner') {
    return `${base}\n\nYou speak with a PROPERTY OWNER.\n\nCONTEXT:\n${context}`;
  }
  return `${base}\n\nYou speak with a TENANT.\n\nCONTEXT:\n${context}`;
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
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
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
    if (role !== 'tenant' && role !== 'owner') {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile, error: profileError } = await userClient
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

    const admin = createClient(supabaseUrl, serviceKey);
    const context =
      role === 'owner'
        ? await buildOwnerContext(admin, user.id)
        : await buildTenantContext(admin, user.id, body.property_id ?? null);

    const messages: { role: string; content: string }[] = [
      { role: 'system', content: systemPrompt(role, context) },
    ];

    for (const turn of (body.history ?? []).slice(-MAX_HISTORY)) {
      if (turn?.role === 'user' || turn?.role === 'assistant') {
        messages.push({ role: turn.role, content: String(turn.content ?? '').slice(0, MAX_TEXT_LEN) });
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
      const errText = await groqRes.text();
      console.error('Groq error:', groqRes.status, errText);
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
