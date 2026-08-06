// ============================================================================
// SUPABASE EDGE FUNCTION: generate-work-order-report
// ============================================================================
// Plane #68 — Work Order completion report emailed to Owner + Tenant.
//
// When vendor work is completed, this function renders a Work Order PDF that
// mirrors the client-provided sample (Cerise 106 work order):
//   - Property header (full address) + "Prepared By <vendor>" + SAST date
//   - Per-area work items table (Ref, Item, Comments, Cost, Additional Notes,
//     Status)
//   - Before/after photos (progress updates → closure after-photos)
//   - 7-day inspection declaration with Agent + Tenant signature blocks
//   - Appendix: comment summary + status overview
//
// It uploads the PDF to the public `work-orders` bucket, persists the URL +
// sent timestamp on maintenance_requests, and (when requested) emails it via
// Resend to the Owner and Tenant as an attachment.
//
// Idempotent: if maintenance_requests.work_order_report_url is already set the
// existing URL is returned without regenerating (unless `force: true`). The
// cached path STILL re-attempts the email if a report exists but was never
// emailed (work_order_report_sent_at IS NULL) — so a completion that happened
// before RESEND_API_KEY was configured is not silently lost.
//
// Completion gate: the request must be `completed` or `closed` (mirrors the
// SA #118 receipt rule — a party can never get a report URL for unfinished
// work).
//
// Auth: service-role key (internal calls from cron / completion triggers) OR a
// valid user token where the caller is a party of the request (owner/tenant/
// vendor) or a dev_admin.
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

// ─── Formatters ─────────────────────────────────────────────────────────────

function fmtZAR(amount: number | null | undefined): string {
  const n = Number(amount) || 0;
  return `R ${n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** e.g. "July 29th 2026 08:41 SAST" — ALWAYS Africa/Johannesburg, never UTC. */
function fmtSAST(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  const day = Number(get('day'));
  const ordinal =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';
  return `${get('month')} ${day}${ordinal} ${get('year')} ${get('hour')}:${get('minute')} SAST`;
}

function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fullAddress(property: any): string {
  if (!property) return '—';
  return [property.title, property.address, property.city, property.province, property.postal_code]
    .filter(Boolean)
    .join(', ');
}

// ─── Byte helpers ────────────────────────────────────────────────────────────

/** Chunked Uint8Array → base64 (avoids RangeError from spreading large arrays). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000; // 32 KB per chunk
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64FromArrayBuffer(buf: ArrayBuffer): string {
  return bytesToBase64(new Uint8Array(buf));
}

// ─── Photo helper ────────────────────────────────────────────────────────────

/**
 * Fetch an image (storage URL) and return a jsPDF-safe base64 data URL.
 * Tries the plain URL first (public buckets), then retries with the
 * service-role key in case the object requires auth. Returns null on failure.
 */
async function fetchPhotoBase64(url: string, supabaseServiceKey: string): Promise<string | null> {
  if (!url) return null;
  const mimeOf = (u: string) => {
    const ext = u.split('?')[0].split('.').pop()?.toLowerCase();
    return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  };
  const toDataUrl = async (res: Response) => {
    const buf = await res.arrayBuffer();
    return `data:${mimeOf(url)};base64,${base64FromArrayBuffer(buf)}`;
  };
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) return await toDataUrl(res);
  } catch {
    // fall through to authed retry
  }
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${supabaseServiceKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await toDataUrl(res);
  } catch {
    return null;
  }
}

// ─── PDF builder ─────────────────────────────────────────────────────────────

interface WorkOrderContext {
  request: any;
  property: any;
  vendor: any;
  owner: any;
  tenant: any;
  closure: any;
  invoice: any;
  beforePhotos: string[];
  afterPhotos: string[];
}

async function buildWorkOrderPdf(
  ctx: WorkOrderContext,
  supabaseServiceKey: string
): Promise<ArrayBuffer> {
  const { request, property, vendor, owner, tenant, closure, invoice } = ctx;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = 56;

  const [pr, pg, pb] = BRAND.primary;
  const [ar, ag, ab] = BRAND.accent;

  const footer = () => {
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setDrawColor(226, 228, 234);
      doc.setLineWidth(0.5);
      doc.line(M, H - 40, W - M, H - 40);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 156, 168);
      doc.text(`Property report created with ${BRAND.name}`, M, H - 24);
      doc.text(`Page ${p} of ${pageCount}`, W - M, H - 24, { align: 'right' });
    }
  };

  // ── Page 1: header ─────────────────────────────────────────────────────
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.text('Work Order', M, 44);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(220, 225, 235);
  doc.text(fullAddress(property).slice(0, 90), M, 62);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(request?.id?.slice(0, 8).toUpperCase() || '—', W - M, 44, { align: 'right' });

  y = 122;

  // Prepared-by block
  doc.setFontSize(10);
  doc.setTextColor(130, 136, 148);
  doc.text('Prepared by', M, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(25, 28, 34);
  doc.text(vendor?.full_name || 'Vendor', M + 90, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(130, 136, 148);
  doc.text('Date', W - M - 140, y, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(25, 28, 34);
  const preparedAt =
    closure?.vendor_confirmed_at || request?.completed_date || new Date().toISOString();
  doc.text(fmtSAST(preparedAt), W - M, y, { align: 'right' });
  y += 22;

  // Request summary card
  doc.setFillColor(246, 247, 250);
  doc.roundedRect(M, y, W - M * 2, 64, 4, 4, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 136, 148);
  doc.text('MAINTENANCE REQUEST', M + 12, y + 16);
  doc.text('STATUS', W - M - 100, y + 16, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(25, 28, 34);
  const title = doc.splitTextToSize(
    request?.title || 'Maintenance Request',
    W - M * 2 - 140
  ) as string[];
  doc.text(title, M + 12, y + 32);
  const status = String(request?.status || '').toUpperCase();
  doc.setTextColor(pr, pg, pb);
  doc.text(status, W - M - 100, y + 32, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 136, 148);
  doc.text(
    request?.description
      ? (doc.splitTextToSize(String(request.description), W - M * 2 - 24) as string[]).slice(0, 2)
      : '',
    M + 12,
    y + 46
  );
  y += 96;

  // ── Contents ────────────────────────────────────────────────────────────
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Contents', M, y);
  y += 20;
  const toc = [
    ['Areas', ''],
    ['    Work Completed', ''],
    ['    AFTER', ''],
    ['Declaration', ''],
    ['Appendix', ''],
    ['    Comment Summary', ''],
    ['    Status Overview', ''],
  ];
  doc.setFontSize(10);
  for (const [label] of toc) {
    const isArea = label.trim() === 'Work Completed' || label.trim() === 'AFTER';
    doc.setFont('helvetica', isArea ? 'normal' : 'bold');
    doc.setTextColor(isArea ? 90 : 25, isArea ? 96 : 28, isArea ? 108 : 34);
    doc.text(
      label.startsWith('    ') ? label.trim() : label,
      M + (label.startsWith('    ') ? 14 : 0),
      y
    );
    y += 16;
  }
  y += 20;

  // ── Section 1: Work Completed (invoice line items) ─────────────────────
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('1. Work Completed', M, y);
  y += 8;
  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(2);
  doc.line(M, y, M + 42, y);
  y += 26;

  const lineItems: Array<{
    description: string;
    quantity?: number;
    unit_price?: number;
    total?: number;
    notes?: string;
  }> = Array.isArray(invoice?.line_items) ? invoice.line_items : [];

  // Columns: Ref | Item | Comments | Cost | Additional Notes | Status
  const colRef = M;
  const colItem = M + 50;
  const colComments = M + 200;
  const colCost = W - M - 190;
  const colNotes = W - M - 130;
  const colStatus = W - M - 40;

  const drawTableHeader = () => {
    doc.setFillColor(pr, pg, pb);
    doc.rect(M, y - 14, W - M * 2, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Ref', colRef + 4, y);
    doc.text('Item', colItem, y);
    doc.text('Comments', colComments, y);
    doc.text('Cost', colCost, y, { align: 'right' });
    doc.text('Notes', colNotes, y, { align: 'right' });
    doc.text('Status', colStatus, y, { align: 'right' });
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 44, 52);
    doc.setFontSize(9);
  };

  drawTableHeader();

  const rows =
    lineItems.length > 0
      ? lineItems
      : [
          {
            description: request?.title || 'Maintenance work',
            total: request?.actual_cost ?? invoice?.total_amount,
          },
        ];

  rows.slice(0, 14).forEach((item, idx) => {
    const itemText = doc.splitTextToSize(
      String(item.description || '—'),
      colComments - colItem - 12
    ) as string[];
    const commentText = item.notes || closure?.vendor_closure_notes || '';
    const commentWrapped = commentText
      ? (doc.splitTextToSize(String(commentText), colCost - colComments - 12) as string[])
      : [];
    const rowH = Math.max(itemText.length, commentWrapped.length, 1) * 12 + 8;
    if (y + rowH > H - 60) {
      doc.addPage();
      y = 60;
      drawTableHeader();
    }
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 252);
      doc.rect(M, y - 8, W - M * 2, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.text(`1.${idx + 1}`, colRef + 4, y + 6);
    doc.text(itemText, colItem, y + 6);
    doc.text(commentWrapped, colComments, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtZAR(item.total), colCost, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 136, 148);
    doc.text('—', colNotes, y + 6, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 122, 77);
    doc.text('Completed', colStatus, y + 6, { align: 'right' });
    doc.setTextColor(40, 44, 52);
    y += rowH;
  });
  y += 16;

  // Totals line
  if (invoice) {
    doc.setDrawColor(226, 228, 234);
    doc.setLineWidth(0.5);
    doc.line(M, y, W - M, y);
    y += 16;
    const totals: Array<[string, string, boolean]> = [
      ['Subtotal', fmtZAR(invoice.subtotal), false],
      ['VAT', fmtZAR(invoice.vat_amount), false],
      ['Total', fmtZAR(invoice.total_amount), true],
    ];
    for (const [label, value, strong] of totals) {
      doc.setFont('helvetica', strong ? 'bold' : 'normal');
      doc.setFontSize(strong ? 11 : 9.5);
      doc.setTextColor(strong ? pr : 130, strong ? pg : 136, strong ? pb : 148);
      doc.text(label, W - M - 130, y, { align: 'right' });
      doc.text(value, W - M, y, { align: 'right' });
      y += 16;
    }
  }

  // ── Section 2: BEFORE / AFTER (photos) ──────────────────────────────────
  doc.addPage();
  y = 60;
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('2. AFTER', M, y);
  y += 26;

  const photoGrid = async (label: string, urls: string[], refPrefix: string) => {
    if (!urls || urls.length === 0) return;
    doc.setTextColor(pr, pg, pb);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(label, M, y);
    y += 10;
    doc.setDrawColor(ar, ag, ab);
    doc.setLineWidth(2);
    doc.line(M, y, M + 42, y);
    y += 18;

    const usable = urls.slice(0, 6);
    const cols = 2;
    const gap = 12;
    const imgW = (W - M * 2 - gap) / cols;
    const imgH = imgW * 0.62;
    let rowBaseY = y;

    for (let i = 0; i < usable.length; i++) {
      const col = i % cols;
      if (col === 0) {
        // Start of a new row — page-break check.
        if (rowBaseY + imgH > H - 60) {
          doc.addPage();
          rowBaseY = 60;
        }
        y = rowBaseY; // keep y tracking the current row base for callers
      }
      const x = M + col * (imgW + gap);
      const dataUrl = await fetchPhotoBase64(usable[i], supabaseServiceKey);
      let drew = false;
      if (dataUrl) {
        const fmt = dataUrl.startsWith('data:image/png')
          ? 'PNG'
          : dataUrl.startsWith('data:image/webp')
            ? 'WEBP'
            : 'JPEG';
        try {
          doc.addImage(dataUrl, fmt, x, rowBaseY, imgW, imgH);
          drew = true;
        } catch {
          // unsupported format — placeholder below
        }
      }
      if (!drew) {
        doc.setFillColor(240, 240, 244);
        doc.rect(x, rowBaseY, imgW, imgH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 136, 148);
      doc.text(`Ref #${refPrefix}${i + 1}`, x + 2, rowBaseY + imgH + 12);
      if (col === cols - 1) rowBaseY += imgH + 18;
    }
    if (usable.length % cols !== 0) rowBaseY += imgH + 18; // partial final row
    y = rowBaseY + 14;
  };

  await photoGrid('Before', ctx.beforePhotos, '1.');
  await photoGrid('After', ctx.afterPhotos, '2.');
  if (ctx.beforePhotos.length === 0 && ctx.afterPhotos.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130, 136, 148);
    doc.text('No photos associated with this work order.', M, y + 10);
    y += 30;
  }

  // ── Declaration ──────────────────────────────────────────────────────────
  doc.addPage();
  y = 60;
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Declaration', M, y);
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40, 44, 52);
  const declText = doc.splitTextToSize(
    'I/We the undersigned, affirm that if I/we do not comment on the Inspection in writing within seven days of receipt of this Inspection then I/we accept the Inspection as being an accurate record of the contents and condition of the property.',
    W - M * 2
  ) as string[];
  doc.text(declText, M, y);
  y += declText.length * 14 + 24;

  // Agent signature block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 28, 34);
  doc.text('Pending signing by the Agent', M, y);
  y += 22;
  doc.setDrawColor(180, 186, 196);
  doc.setLineWidth(0.7);
  doc.line(M, y, W - M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 136, 148);
  doc.text(owner?.full_name || 'Agent', M, y + 14);
  doc.text('Date         /         /', W - M, y + 14, { align: 'right' });
  y += 48;

  // Tenant signature block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 28, 34);
  doc.text('Pending signing by the Tenant', M, y);
  y += 22;
  doc.setDrawColor(180, 186, 196);
  doc.setLineWidth(0.7);
  doc.line(M, y, W - M, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130, 136, 148);
  doc.text(tenant?.full_name || 'Tenant', M, y + 14);
  doc.text('Date         /         /', W - M, y + 14, { align: 'right' });
  y += 56;

  // ── Appendix ─────────────────────────────────────────────────────────────
  doc.setTextColor(pr, pg, pb);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Appendix', M, y);
  y += 26;

  // Comment summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 28, 34);
  doc.text('Comment Summary', M, y);
  y += 18;
  const comments: Array<[string, string]> = [];
  if (closure?.vendor_closure_notes)
    comments.push(['Vendor notes', String(closure.vendor_closure_notes)]);
  if (closure?.tenant_notes) comments.push(['Tenant notes', String(closure.tenant_notes)]);
  if (comments.length === 0) comments.push(['Comments', 'No comments recorded.']);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const [ref, comment] of comments) {
    const wrapped = doc.splitTextToSize(comment, W - M * 2 - 80) as string[];
    doc.setTextColor(90, 96, 108);
    doc.text(ref, M, y + 4);
    doc.setTextColor(40, 44, 52);
    doc.text(wrapped, M + 80, y + 4);
    y += Math.max(wrapped.length, 1) * 13 + 6;
  }
  y += 14;

  // Status overview
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(25, 28, 34);
  doc.text('Status Overview', M, y);
  y += 18;
  const statusRows: Array<[string, string]> = [
    ['Work status', String(request?.status || '—').toUpperCase()],
    ['Requested on', fmtDateShort(request?.created_at)],
    ['Scheduled on', fmtDateShort(request?.scheduled_date)],
    ['Completed on', fmtDateShort(request?.completed_date || closure?.vendor_confirmed_at)],
    ['Vendor', vendor?.full_name || '—'],
    ['Owner', owner?.full_name || '—'],
    ['Tenant', tenant?.full_name || '—'],
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const [label, value] of statusRows) {
    doc.setTextColor(130, 136, 148);
    doc.text(label, M, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(25, 28, 34);
    doc.text(value, M + 150, y);
    doc.setFont('helvetica', 'normal');
    y += 15;
  }

  footer();
  return doc.output('arraybuffer') as ArrayBuffer;
}

// ─── Resend email helper ─────────────────────────────────────────────────────

async function sendWorkOrderEmail(opts: {
  resendKey: string;
  fromEmail: string;
  toEmails: string[];
  recipientNames: string[];
  requestTitle: string;
  reportUrl: string;
  pdfBytes: ArrayBuffer;
}): Promise<{ ok: boolean; error?: string }> {
  const { resendKey, fromEmail, toEmails, recipientNames, requestTitle, reportUrl, pdfBytes } =
    opts;

  const base64 = base64FromArrayBuffer(pdfBytes);

  const rows = toEmails
    .map(
      (email, i) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;"><strong>${recipientNames[i] || 'Party'}</strong></td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${email}</td></tr>`
    )
    .join('');

  const html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;">
    <div style="background:#002395;color:#fff;padding:24px 28px;border-radius:8px 8px 0 0;">
      <h1 style="margin:0;font-size:20px;">Work Order Completed</h1>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;">Hello,</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;">
        The maintenance work for <strong>${requestTitle}</strong> has been completed.
        Please find the Work Order report attached for your records.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;color:#374151;">
        <tr><td style="padding:8px 12px;background:#f9fafb;font-weight:600;">Recipients</td><td style="padding:8px 12px;background:#f9fafb;"></td></tr>
        ${rows}
      </table>
      <p style="margin:20px 0 0;">
        <a href="${reportUrl}" style="display:inline-block;background:#002395;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;">View Work Order</a>
      </p>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px;">
        If you believe the work order is inaccurate, please respond within 7 days.
      </p>
    </div>
  </div>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: toEmails,
        subject: `Work Order Completed — ${requestTitle}`,
        html,
        attachments: [
          {
            filename: `work-order-${
              String(requestTitle)
                .replace(/[^a-z0-9]+/gi, '-')
                .slice(0, 40)
                .toLowerCase() || 'report'
            }.pdf`,
            content: base64,
          },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

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
    const maintenanceRequestId: string | undefined = body.maintenance_request_id;
    const force = body.force === true;
    const sendEmail = body.send_email !== false; // default true

    if (!maintenanceRequestId) {
      return new Response(JSON.stringify({ error: 'Missing maintenance_request_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch the request with all report context ────────────────────────
    const { data: request, error: reqErr } = await supabase
      .from('maintenance_requests')
      .select(
        `
        id, title, description, status, estimated_cost, actual_cost,
        completed_date, scheduled_date, created_at, property_id, tenant_id, owner_id,
        selected_vendor_id, vendor_id, work_order_report_url, work_order_report_sent_at
      `
      )
      .eq('id', maintenanceRequestId)
      .single();

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: 'Maintenance request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Authz: service role, a party of the request, or dev_admin ────────
    if (!isServiceRole) {
      if (!actor) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const isParty =
        request.owner_id === actor.id ||
        request.tenant_id === actor.id ||
        request.selected_vendor_id === actor.id ||
        request.vendor_id === actor.id;
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

    // ── Completion gate (SA #118 pattern): only completed/closed work. ──
    if (request.status !== 'completed' && request.status !== 'closed') {
      return new Response(
        JSON.stringify({ error: 'Request not completed', status: request.status }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Fetch related context ─────────────────────────────────────────────
    const [property, vendor, owner, tenant] = await Promise.all([
      request.property_id
        ? supabase
            .from('properties')
            .select('title, address, city, province, postal_code')
            .eq('id', request.property_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      request.selected_vendor_id || request.vendor_id
        ? supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', request.selected_vendor_id || request.vendor_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      request.owner_id
        ? supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', request.owner_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      request.tenant_id
        ? supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', request.tenant_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // ── Email recipients (synced: names filtered with emails) ────────────
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('WORK_ORDER_FROM_EMAIL') || 'reports@lalarente.co.za';

    const partyEmails = [
      { email: owner?.data?.email, name: owner?.data?.full_name || 'Owner' },
      { email: tenant?.data?.email, name: tenant?.data?.full_name || 'Tenant' },
    ].filter((p) => Boolean(p.email));
    const toEmails = partyEmails.map((p) => p.email as string);
    const recipientNames = partyEmails.map((p) => p.name);

    // ── Idempotency: report already generated? ───────────────────────────
    if (request.work_order_report_url && !force) {
      // A cached report must still be emailed if it was never sent (e.g. the
      // completion happened before RESEND_API_KEY was configured). Fetch the
      // existing PDF from the public URL and send it.
      let emailed = false;
      let emailError: string | undefined;
      let sentAt = request.work_order_report_sent_at;
      if (sendEmail && resendKey && !request.work_order_report_sent_at && toEmails.length > 0) {
        try {
          const pdfRes = await fetch(request.work_order_report_url, {
            signal: AbortSignal.timeout(15000),
          });
          if (pdfRes.ok) {
            const pdfBytes = await pdfRes.arrayBuffer();
            const result = await sendWorkOrderEmail({
              resendKey,
              fromEmail,
              toEmails,
              recipientNames,
              requestTitle: request.title || 'Maintenance Request',
              reportUrl: request.work_order_report_url,
              pdfBytes,
            });
            emailed = result.ok;
            emailError = result.error;
            if (emailed) {
              sentAt = new Date().toISOString();
              await supabase
                .from('maintenance_requests')
                .update({ work_order_report_sent_at: sentAt })
                .eq('id', request.id);
            }
          } else {
            emailError = `Failed to fetch cached report: HTTP ${pdfRes.status}`;
          }
        } catch (err) {
          emailError = String(err);
        }
        if (!emailed) console.warn('⚠️ Cached work order email failed:', emailError);
      }
      return new Response(
        JSON.stringify({
          report_url: request.work_order_report_url,
          sent_at: sentAt,
          emailed,
          email_error: emailError || null,
          cached: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Closure report — prefer the active (non-rejected) row, mirroring
    // migration 050's partial-unique-index semantics (SA #114 pattern).
    const { data: closure } = await (supabase.from('closure_reports') as any)
      .select(
        `id, status, vendor_closure_notes, vendor_after_photos, tenant_notes,
         tenant_confirmation_photos, completion_notes, completion_photos,
         vendor_confirmed_at, closed_at, created_at`
      )
      .eq('maintenance_request_id', maintenanceRequestId)
      .order('vendor_confirmed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    // Invoice (latest for this request)
    const { data: invoiceRows } = await supabase
      .from('maintenance_invoices')
      .select('id, invoice_number, line_items, subtotal, vat_amount, total_amount, status')
      .eq('maintenance_request_id', maintenanceRequestId)
      .order('created_at', { ascending: false })
      .limit(1);

    const invoice = Array.isArray(invoiceRows) && invoiceRows.length > 0 ? invoiceRows[0] : null;

    // Progress photos (before) — latest update's photos
    const { data: progressRows } = await supabase
      .from('job_progress_updates')
      .select('photos')
      .eq('maintenance_request_id', maintenanceRequestId)
      .not('photos', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    const beforePhotos: string[] = [];
    for (const p of progressRows || []) {
      const photos = (p as any).photos;
      if (Array.isArray(photos)) beforePhotos.push(...photos);
    }

    const afterPhotos: string[] = [
      ...((closure as any)?.vendor_after_photos || []),
      ...((closure as any)?.tenant_confirmation_photos || []),
    ];

    // ── Build + upload the PDF (request is verified completed above) ─────
    const pdfBytes = await buildWorkOrderPdf(
      {
        request,
        property: property?.data ?? null,
        vendor: vendor?.data ?? null,
        owner: owner?.data ?? null,
        tenant: tenant?.data ?? null,
        closure: closure ?? null,
        invoice,
        beforePhotos,
        afterPhotos,
      },
      supabaseServiceKey
    );

    const filePath = `maintenance-requests/${request.id}/work-order.pdf`;
    const { error: uploadErr } = await supabase.storage
      .from('work-orders')
      .upload(filePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      console.error('❌ Work order upload failed:', uploadErr);
      throw uploadErr;
    }

    const { data: publicUrlData } = supabase.storage.from('work-orders').getPublicUrl(filePath);
    const reportUrl = publicUrlData?.publicUrl;

    // ── Email the Owner + Tenant (only when a report URL exists) ──────────
    let emailed = false;
    let emailError: string | undefined;

    if (sendEmail && resendKey && toEmails.length > 0) {
      const emailResult = await sendWorkOrderEmail({
        resendKey,
        fromEmail,
        toEmails,
        recipientNames,
        requestTitle: request.title || 'Maintenance Request',
        reportUrl,
        pdfBytes,
      });
      emailed = emailResult.ok;
      emailError = emailResult.error;
      if (!emailResult.ok) {
        console.warn('⚠️ Work order email failed:', emailResult.error);
      }
    } else if (sendEmail && !resendKey) {
      console.warn('⚠️ RESEND_API_KEY not set — skipping work order email');
    }

    // ── Persist URL + sent timestamp ──────────────────────────────────────
    if (reportUrl) {
      const { error: updErr } = await supabase
        .from('maintenance_requests')
        .update({
          work_order_report_url: reportUrl,
          work_order_report_sent_at: emailed
            ? new Date().toISOString()
            : request.work_order_report_sent_at,
        })
        .eq('id', request.id);
      if (updErr) {
        console.warn('⚠️ Failed to persist work_order_report_url:', updErr);
      }
    }

    console.log(
      `✅ Work order report generated for request ${request.id}: ${reportUrl} (emailed=${emailed})`
    );
    return new Response(
      JSON.stringify({
        report_url: reportUrl,
        emailed,
        email_error: emailError || null,
        cached: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ generate-work-order-report error:', error);
    return new Response(JSON.stringify({ error: 'Internal error', message: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
