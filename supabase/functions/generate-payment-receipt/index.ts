// ============================================================================
// SUPABASE EDGE FUNCTION: generate-payment-receipt
// ============================================================================
// Plane #62 slice 2 — Receipt PDF on payment completion.
//
// Renders a PDF receipt for a vendor payment and uploads it to the public
// `receipts` storage bucket, persisting the download URL on
// vendor_payments.receipt_url so BOTH the tenant and vendor can retrieve it
// (in-app result screen + notifications / email "View Receipt" button).
//
// The receipt includes (per Plane #62):
//   - Job details        (maintenance request number/title, property, vendor)
//   - Invoice breakdown  (invoice number, line items, subtotal, VAT, total)
//   - Payment confirmation (payment id, gateway tx id, paid_at, status)
//   - Platform fee breakdown (total, platform fee %, gateway fee, vendor payout)
//
// Idempotent: if vendor_payments.receipt_url is already set, the existing URL
// is returned without regenerating. Safe to call from the webhook, the
// reconcile cron, and on-demand from the app.
//
// Auth: service-role key (internal calls from webhook/reconcile) OR a valid
// user token where the caller is a party of the payment (tenant/vendor/owner)
// or a dev_admin.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { jsPDF } from 'npm:jspdf@2.5.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BRAND = {
  name: 'LaLarente',
  primary: [0, 35, 149] as [number, number, number], // #002395
  accent: [255, 184, 28] as [number, number, number], // #FFB81C
};

function fmtZAR(amount: number): string {
  return `R ${(Number(amount) || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Build the receipt PDF (jsPDF) from the fetched payment context. */
function buildReceiptPdf(ctx: {
  payment: any;
  invoice: any;
  request: any;
  property: any;
  tenant: any;
  vendor: any;
}): ArrayBuffer {
  const { payment, invoice, request, property, tenant, vendor } = ctx;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const M = 48; // margin
  let y = 56;

  const [pr, pg, pb] = BRAND.primary;
  const [ar, ag, ab] = BRAND.accent;

  // ── Header band ────────────────────────────────────────────────────────
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(BRAND.name, M, 44);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Payment Receipt', M, 62);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(invoice?.invoice_number || '—', W - M, 44, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 225, 235);
  doc.text('Invoice number', W - M, 58, { align: 'right' });

  y = 128;

  // ── Payment confirmation ───────────────────────────────────────────────
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Payment Confirmed', M, y);
  y += 18;
  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(2);
  doc.line(M, y, M + 42, y);
  y += 22;

  doc.setTextColor(40, 44, 52);
  doc.setFontSize(10);
  const confirmRows: Array<[string, string]> = [
    [
      'Status',
      payment.payment_status === 'completed'
        ? 'COMPLETED'
        : String(payment.payment_status || '').toUpperCase(),
    ],
    ['Amount paid', fmtZAR(payment.total_amount)],
    ['Paid at', fmtDate(payment.paid_at)],
    ['Payment ID', String(payment.id).slice(0, 8) + '…'],
  ];
  if (payment.gateway_transaction_id) {
    confirmRows.push(['Gateway transaction', String(payment.gateway_transaction_id)]);
  }

  const labelW = 150;
  for (const [label, value] of confirmRows) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 136, 148);
    doc.text(label, M, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 28, 34);
    doc.text(value, M + labelW, y);
    y += 18;
  }
  y += 14;

  // ── Job details ────────────────────────────────────────────────────────
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Job Details', M, y);
  y += 26;

  doc.setFontSize(10);
  const jobRows: Array<[string, string]> = [
    ['Request', request?.request_number || '—'],
    ['Job', request?.title || '—'],
    ['Property', property?.title || '—'],
    [
      'Address',
      property?.address ? `${property.address}${property.city ? `, ${property.city}` : ''}` : '—',
    ],
    ['Vendor', vendor?.full_name || '—'],
    ['Tenant', tenant?.full_name || '—'],
  ];
  for (const [label, value] of jobRows) {
    // Wrap long values.
    const wrapped = doc.splitTextToSize(String(value), W - M * 2 - labelW - 12) as string[];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 136, 148);
    doc.text(label, M, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 28, 34);
    doc.text(wrapped, M + labelW, y);
    y += 14 + (wrapped.length - 1) * 12;
  }
  y += 14;

  // ── Invoice breakdown ──────────────────────────────────────────────────
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Invoice Breakdown', M, y);
  y += 22;

  const lineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }> = Array.isArray(invoice?.line_items) ? invoice.line_items : [];

  const colDesc = M;
  const colQty = W - M - 240;
  const colUnit = W - M - 150;
  const colTotal = W - M - 60;
  const tableTop = y;

  // Header row
  doc.setFillColor(246, 247, 250);
  doc.rect(M, tableTop - 14, W - M * 2, 18, 'F');
  doc.setTextColor(90, 96, 108);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DESCRIPTION', colDesc, tableTop);
  doc.text('QTY', colQty, tableTop, { align: 'right' });
  doc.text('UNIT PRICE', colUnit, tableTop, { align: 'right' });
  doc.text('TOTAL', colTotal, tableTop, { align: 'right' });

  y = tableTop + 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 44, 52);
  doc.setFontSize(9.5);

  if (lineItems.length === 0) {
    doc.text('No line items', colDesc, y + 12);
    y += 30;
  } else {
    for (const item of lineItems.slice(0, 12)) {
      const desc = doc.splitTextToSize(
        String(item.description || '—'),
        colQty - colDesc - 12
      ) as string[];
      doc.text(desc, colDesc, y + 10);
      doc.text(String(item.quantity ?? 1), colQty, y + 10, { align: 'right' });
      doc.text(fmtZAR(item.unit_price ?? 0), colUnit, y + 10, { align: 'right' });
      doc.text(fmtZAR(item.total ?? 0), colTotal, y + 10, { align: 'right' });
      y += 16 + (desc.length - 1) * 11;
      if (y > 700) {
        doc.addPage();
        y = 60;
      }
    }
    y += 8;
  }

  // Totals block
  doc.setDrawColor(226, 228, 234);
  doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 14;
  const totalRows: Array<[string, string, boolean]> = [
    ['Subtotal', fmtZAR(invoice?.subtotal ?? 0), false],
    ['VAT', fmtZAR(invoice?.vat_amount ?? 0), false],
    ['Invoice total', fmtZAR(invoice?.total_amount ?? payment.total_amount), true],
  ];
  for (const [label, value, strong] of totalRows) {
    doc.setFont('helvetica', strong ? 'bold' : 'normal');
    doc.setFontSize(strong ? 11 : 9.5);
    doc.setTextColor(strong ? pr : 90, strong ? pg : 96, strong ? pb : 108);
    doc.text(label, W - M - 130, y, { align: 'right' });
    doc.text(value, W - M, y, { align: 'right' });
    y += 16;
  }
  y += 12;

  // ── Platform fee breakdown ─────────────────────────────────────────────
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Platform Fee Breakdown', M, y);
  y += 22;

  const total = Number(payment.total_amount) || 0;
  const platformFee = Number(payment.platform_fee) || 0;
  const gatewayFee = Number(payment.gateway_fee) || 0;
  const vendorPayout = Number(payment.vendor_payout) || 0;

  doc.setFontSize(10);
  const feeRows: Array<[string, string, boolean]> = [
    ['Total paid by tenant', fmtZAR(total), false],
    [`Platform fee (${payment.platform_fee_percent ?? 10}%)`, `− ${fmtZAR(platformFee)}`, false],
    ['Gateway fee (PayFast)', `− ${fmtZAR(gatewayFee)}`, false],
    ['Vendor payout', fmtZAR(vendorPayout), true],
  ];
  for (const [label, value, strong] of feeRows) {
    doc.setFont('helvetica', strong ? 'bold' : 'normal');
    doc.setFontSize(strong ? 11 : 9.5);
    doc.setTextColor(strong ? 25 : 130, strong ? 28 : 136, strong ? 34 : 148);
    doc.text(label, M, y);
    doc.text(value, W - M, y, { align: 'right' });
    y += 16;
  }
  y += 18;

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 228, 234);
  doc.setLineWidth(0.5);
  doc.line(M, 770, W - M, 770);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150, 156, 168);
  doc.text('This is an electronically generated receipt from LaLarente.', M, 788);
  doc.text('Receipt generated: ' + fmtDate(new Date().toISOString()), M, 800);
  doc.text('Payment ID: ' + payment.id, W - M, 788, { align: 'right' });

  return doc.output('arraybuffer') as ArrayBuffer;
}

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    let actor: any = null;

    if (authHeader && token) {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token);
      if (!authErr && user) actor = user;
    }

    const isServiceRole = token === supabaseServiceKey;

    const body = await req.json();
    const vendorPaymentId: string | undefined = body.vendor_payment_id;

    if (!vendorPaymentId) {
      return new Response(JSON.stringify({ error: 'Missing vendor_payment_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch the payment with all receipt context ──────────────────────
    const { data: payment, error: payErr } = await supabase
      .from('vendor_payments')
      .select(
        `
        id, tenant_id, vendor_id, owner_id,
        total_amount, platform_fee, platform_fee_percent, gateway_fee, vendor_payout,
        payment_status, paid_at, gateway_transaction_id, receipt_url,
        invoice:invoice_id(invoice_number, status, line_items, subtotal, vat_amount, total_amount),
        request:maintenance_request_id(request_number, title, property_id),
        tenant:tenant_id(full_name),
        vendor:vendor_id(full_name)
      `
      )
      .eq('id', vendorPaymentId)
      .single();

    if (payErr || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Authz: service role, a party of the payment, or dev_admin ───────
    if (!isServiceRole) {
      if (!actor) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const isParty =
        payment.tenant_id === actor.id ||
        payment.vendor_id === actor.id ||
        payment.owner_id === actor.id;
      if (!isParty) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('dev_admin')
          .eq('id', actor.id)
          .single();
        if (!profile || !(profile as any).dev_admin) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // ── Blocker 1 (SA #118): only completed payments get a receipt. ─────
    // Refuse BEFORE build/upload so a non-completed payment can never get a
    // public PDF URL — only the DB persist used to be guarded, which let a
    // party trigger an upload and receive the URL for a pending/failed row.
    if (payment.payment_status !== 'completed') {
      return new Response(
        JSON.stringify({
          error: 'Payment not completed',
          payment_status: payment.payment_status,
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Idempotency: receipt already generated? ─────────────────────────
    if (payment.receipt_url) {
      return new Response(JSON.stringify({ receipt_url: payment.receipt_url, cached: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch property (join is one level deeper than request) ──────────
    let property: any = null;
    if (payment.request?.property_id) {
      const propRes = await supabase
        .from('properties')
        .select('title, address, city')
        .eq('id', payment.request.property_id)
        .single();
      property = propRes.data;
    }

    // ── Build + upload the PDF (payment is verified 'completed' above) ──
    const pdfBytes = buildReceiptPdf({
      payment,
      invoice: payment.invoice,
      request: payment.request,
      property,
      tenant: payment.tenant,
      vendor: payment.vendor,
    });

    const filePath = `vendor-payments/${payment.id}/receipt.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('receipts')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      console.error('❌ Receipt upload failed:', uploadErr);
      throw uploadErr;
    }

    const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(filePath);
    const receiptUrl = publicUrlData?.publicUrl;

    // ── Persist the URL (only on the completed transition) ──────────────
    if (receiptUrl) {
      const { error: updErr } = await supabase
        .from('vendor_payments')
        .update({ receipt_url: receiptUrl })
        .eq('id', payment.id)
        .eq('payment_status', 'completed')
        .is('receipt_url', null);
      if (updErr) {
        console.warn('⚠️ Failed to persist receipt_url:', updErr);
      }
    }

    console.log(`✅ Receipt generated for vendor payment ${payment.id}: ${receiptUrl}`);
    return new Response(JSON.stringify({ receipt_url: receiptUrl, cached: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ generate-payment-receipt error:', error);
    return new Response(JSON.stringify({ error: 'Internal error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
