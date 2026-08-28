// ============================================================================
// SUPABASE EDGE FUNCTION: send-vendor-invite-email
// ============================================================================
// LAL-113 — Owner invites an unregistered vendor by email (Resend).
// Never returns success unless Resend accepted the message.
// If the email already belongs to a vendor, returns vendor_exists (client
// should invite-to-quote instead of a join email).
// Auth: caller JWT must be the job owner.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
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

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const requestId = String(body.request_id || body.requestId || '').trim();
    if (!EMAIL_RE.test(email) || !requestId) {
      return new Response(JSON.stringify({ error: 'email and request_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: request, error: reqErr } = await supabase
      .from('maintenance_requests')
      .select('id, title, owner_id')
      .eq('id', requestId)
      .single();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (request.owner_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Only the job owner can invite vendors by email.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: existing } = await supabase
      .from('profiles')
      .select('id, role, email')
      .ilike('email', email)
      .maybeSingle();
    if (existing && (existing as { role?: string }).role === 'vendor') {
      return new Response(
        JSON.stringify({
          vendor_exists: true,
          vendor_id: (existing as { id: string }).id,
          message:
            'This email is already a LalaRente vendor. Invite them to quote from the directory.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
    if (!resendKey) {
      return new Response(
        JSON.stringify({
          error: 'Email is not configured. Invitation was not sent.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fromEmail = Deno.env.get('WORK_ORDER_FROM_EMAIL') || 'reports@lalarente.co.za';
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();
    const ownerName =
      (ownerProfile as { full_name?: string } | null)?.full_name || 'A property owner';
    const jobTitle = request.title || 'a maintenance job';

    const html = `
      <p>Hello,</p>
      <p>${ownerName} invited you to join LalaRente as a vendor and quote on: <strong>${jobTitle}</strong>.</p>
      <p>Create a vendor account in the LalaRente app, then the owner can send you the job to quote.</p>
      <p>If you were not expecting this, you can ignore this email.</p>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `LalaRente <${fromEmail}>`,
        to: [email],
        subject: `${ownerName} invited you to quote on LalaRente`,
        html,
      }),
    });
    const resBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      await supabase.from('vendor_email_invites').insert({
        request_id: requestId,
        invited_by: user.id,
        email,
        status: 'failed',
        error_message: String(resBody?.message || res.status),
      });
      return new Response(
        JSON.stringify({
          error: 'Invitation email failed to send.',
          detail: resBody?.message || res.status,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { error: insErr } = await supabase.from('vendor_email_invites').insert({
      request_id: requestId,
      invited_by: user.id,
      email,
      status: 'sent',
      resend_id: resBody?.id || null,
    });
    if (insErr) {
      console.error('vendor_email_invites insert failed after send', insErr);
    }

    return new Response(JSON.stringify({ success: true, email, resend_id: resBody?.id || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-vendor-invite-email', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
