// ============================================================================
// SUPABASE EDGE FUNCTION: accept-maintenance-quote
// ============================================================================
// LAL-120 — Job owner OR job tenant may accept a submitted quote.
// Service role issues the PO, sets work_can_start, stamps sent_to_vendor_at
// so the vendor can Start Work immediately (no separate "send PO" click).
// Auth: caller JWT.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
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
      return json(401, { error: 'Unauthorized' });
    }

    const body = await req.json().catch(() => ({}));
    const quoteId = String(body.quote_id || body.quoteId || '').trim();
    if (!quoteId) {
      return json(400, { error: 'quote_id is required' });
    }

    const { data: quote, error: quoteErr } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();
    if (quoteErr || !quote) {
      return json(404, { error: 'Quote not found' });
    }
    if (!quote.request_id) {
      return json(400, { error: 'Quote is not linked to a maintenance job' });
    }
    if (quote.status !== 'submitted') {
      return json(409, { error: `This quote is ${quote.status}, not waiting for acceptance` });
    }

    const { data: request, error: reqErr } = await supabase
      .from('maintenance_requests')
      .select('id, title, tenant_id, owner_id, status')
      .eq('id', quote.request_id)
      .single();
    if (reqErr || !request) {
      return json(404, { error: 'Job not found' });
    }

    const isOwner = request.owner_id === user.id;
    const isTenant = request.tenant_id === user.id;
    if (!isOwner && !isTenant) {
      return json(403, { error: 'Only the job owner or tenant can accept a quote.' });
    }

    const now = new Date().toISOString();
    const { data: updatedQuote, error: updateQuoteError } = await supabase
      .from('quotes')
      .update({ status: 'approved', updated_at: now })
      .eq('id', quoteId)
      .eq('status', 'submitted')
      .select()
      .single();
    if (updateQuoteError || !updatedQuote) {
      return json(409, { error: 'Quote was already accepted or changed' });
    }

    await supabase
      .from('quotes')
      .update({
        status: 'rejected',
        revision_reason: 'Another quote was accepted',
        updated_at: now,
      })
      .eq('request_id', quote.request_id)
      .eq('status', 'submitted')
      .neq('id', quoteId);

    const date = now.slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    const poNumber = `PO-${date}-${random}`;

    const { data: newPO, error: poError } = await supabase
      .from('purchase_orders')
      .insert({
        contract_id: quote.contract_id,
        po_number: poNumber,
        currency: 'ZAR',
        subtotal: quote.subtotal,
        vat_amount: quote.vat_amount,
        platform_fee_amount: 0,
        total_amount: quote.total_amount,
        status: 'issued',
        revision_number: 1,
        sent_to_vendor_at: now,
        sent_by: user.id,
      })
      .select()
      .single();
    if (poError || !newPO) {
      return json(500, { error: poError?.message || 'Failed to create purchase order' });
    }

    const { error: linkError } = await supabase
      .from('maintenance_requests')
      .update({
        selected_quote_id: quoteId,
        selected_vendor_id: quote.vendor_id,
        vendor_id: quote.vendor_id,
        status: 'assigned',
        mms_status: 'po_issued',
        work_can_start: true,
        po_id: newPO.id,
      })
      .eq('id', quote.request_id);
    if (linkError) {
      return json(500, { error: linkError.message || 'Failed to assign vendor / PO' });
    }

    const amount = Number(quote.total_amount || 0);
    const amountLabel = `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
    const actor = isTenant ? 'tenant' : 'owner';

    await supabase.from('notifications').insert({
      user_id: quote.vendor_id,
      type: 'maintenance_updated',
      title: 'Purchase order issued',
      body: `A ${amountLabel} quote on "${request.title}" was accepted. You can start work.`,
      data: { request_id: quote.request_id, quote_id: quoteId, po_id: newPO.id },
      channels: ['in_app'],
      priority: 'high',
      status: 'pending',
    });

    if (isTenant && request.owner_id) {
      await supabase.from('notifications').insert({
        user_id: request.owner_id,
        type: 'maintenance_updated',
        title: 'Tenant accepted a quote',
        body: `Your tenant accepted a ${amountLabel} quote on "${request.title}" and issued the PO.`,
        data: { request_id: quote.request_id, quote_id: quoteId, po_id: newPO.id },
        channels: ['in_app'],
        priority: 'high',
        status: 'pending',
      });
    }

    return json(200, {
      success: true,
      actor,
      quote: updatedQuote,
      po: newPO,
      message: 'Quote accepted and PO issued. Vendor can start work.',
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Internal error' });
  }
});
