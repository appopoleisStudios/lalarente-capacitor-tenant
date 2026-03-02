/**
 * PDF Report Generation — Owner Statement & Tax Statement
 *
 * Uses expo-print to generate HTML → PDF and expo-sharing to share/save.
 * Templates mirror the client-provided PDF templates.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../../../lib/supabase';

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtZAR(amount: number): string {
  return amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Shared CSS ──────────────────────────────────────────────────────────────

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; background: #fff; }
  h2 { font-size: 12pt; font-weight: 700; color: #002395; margin-bottom: 4px; }
  h3 { font-size: 10pt; font-weight: 700; color: #333; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th {
    background: #002395; color: #fff; padding: 7px 10px;
    font-size: 9pt; font-weight: 600; text-align: left;
  }
  thead th.right { text-align: right; }
  tbody td { padding: 6px 10px; font-size: 9pt; border-bottom: 1px solid #eee; vertical-align: top; }
  tbody td.right { text-align: right; }
  tfoot td { padding: 7px 10px; font-size: 9pt; font-weight: 700; border-top: 2px solid #002395; }
  tfoot td.right { text-align: right; }
  .page-break { page-break-after: always; }
  .section { margin-bottom: 22px; }
  .section-title {
    font-size: 12pt; font-weight: 700; color: #002395;
    border-bottom: 2px solid #FFB81C; padding-bottom: 4px; margin-bottom: 10px;
  }
  .section-sub { font-size: 8.5pt; color: #666; margin-bottom: 8px; }
`;

// ─── Owner Statement ──────────────────────────────────────────────────────────

interface ExpenseItem {
  date: string;
  description: string;
  amount: number;
}

interface InvoiceItem {
  date: string;
  ref: string;
  description: string;
  amountExcl: number;
  vat: number;
  total: number;
}

interface PropertyStatementSection {
  propertyTitle: string;
  propertyAddress: string;
  tenantName: string;
  currentRent: number;
  depositBalance: number;
  leaseEndDate: string | null;
  tenantOutstanding: number;
  rentCollected: number;
  expenseItems: ExpenseItem[];
  totalExpenses: number;
  netIncome: number;
  invoiceItems: InvoiceItem[];
}

function buildOwnerStatementHtml(
  ownerName: string,
  period: string,
  properties: PropertyStatementSection[],
): string {
  const today = fmtDate(new Date().toISOString());

  const propertySections = properties.map((prop, idx) => {
    const isLast = idx === properties.length - 1;

    // Income & Expenses rows
    const expenseRows = prop.expenseItems
      .map(
        e => `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td>${e.description}</td>
        <td class="right"></td>
        <td class="right">R ${fmtZAR(e.amount)}</td>
      </tr>`,
      )
      .join('');

    const totalIncome = prop.rentCollected;
    const totalExpenses = prop.totalExpenses;

    // Invoice rows
    const invoiceRows = prop.invoiceItems
      .map(
        i => `
      <tr>
        <td>${fmtDate(i.date)}</td>
        <td>${i.ref}</td>
        <td>${i.description}</td>
        <td class="right">R ${fmtZAR(i.amountExcl)}</td>
        <td class="right">R ${fmtZAR(i.vat)}</td>
        <td class="right">R ${fmtZAR(i.total)}</td>
      </tr>`,
      )
      .join('');

    const invTotal = prop.invoiceItems.reduce((s, i) => s + i.total, 0);
    const invExcl = prop.invoiceItems.reduce((s, i) => s + i.amountExcl, 0);
    const invVat = prop.invoiceItems.reduce((s, i) => s + i.vat, 0);

    return `
    <!-- ═══ PROPERTY: ${prop.propertyTitle} ═══ -->
    <div style="padding: 28px 32px; ${!isLast ? '' : ''}">

      <!-- Header -->
      <div style="background: #002395; color: #fff; padding: 20px 24px; margin-bottom: 0;">
        <div style="font-size: 20pt; font-weight: 700; margin-bottom: 4px;">Owner Statement</div>
        <div style="font-size: 13pt; font-weight: 600;">${prop.propertyTitle}</div>
        <div style="font-size: 9pt; margin-top: 4px; opacity: 0.85;">${period}</div>
      </div>

      <!-- Owner + Property info bar -->
      <div style="background: #f0f4ff; padding: 12px 24px; border-bottom: 3px solid #FFB81C; display: flex; justify-content: space-between; margin-bottom: 24px;">
        <div>
          <div style="font-size: 8.5pt; color: #666; margin-bottom: 2px;">PREPARED FOR</div>
          <div style="font-size: 10pt; font-weight: 700;">${ownerName}</div>
          <div style="font-size: 9pt; color: #555;">${prop.propertyAddress}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8.5pt; color: #666; margin-bottom: 2px;">GENERATED</div>
          <div style="font-size: 9pt; font-weight: 600;">${today}</div>
          <div style="font-size: 8pt; color: #888;">Lalarente Property Manager</div>
        </div>
      </div>

      <!-- Section 1: Income & Expenses -->
      <div class="section" style="margin-bottom: 24px;">
        <div class="section-title">Income and Expenses</div>
        <div class="section-sub">
          Account statement showing all rent income received from tenants as well as all paid expenses.
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:14%">Date</th>
              <th>Description</th>
              <th class="right" style="width:20%">Income</th>
              <th class="right" style="width:20%">Expenses</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td>Rent received for statement period</td>
              <td class="right"><strong>R ${fmtZAR(totalIncome)}</strong></td>
              <td></td>
            </tr>
            ${expenseRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="text-align: right;">Totals</td>
              <td class="right">R ${fmtZAR(totalIncome)}</td>
              <td class="right">R ${fmtZAR(totalExpenses)}</td>
            </tr>
            <tr>
              <td colspan="3" style="text-align: right; font-size: 10pt;">
                Net Operating Income
              </td>
              <td class="right" style="color: ${prop.netIncome >= 0 ? '#007A4D' : '#DC2626'}; font-size: 11pt;">
                R ${fmtZAR(prop.netIncome)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Section 2: Invoices -->
      <div class="section" style="margin-bottom: 24px;">
        <div class="section-title">Invoices</div>
        <div class="section-sub">
          List of all invoices and expenses for the statement period.
        </div>
        ${
          prop.invoiceItems.length === 0
            ? '<p style="font-size: 9pt; color: #888; padding: 8px 0;">No invoices for this period.</p>'
            : `<table>
          <thead>
            <tr>
              <th style="width:12%">Date</th>
              <th style="width:14%">Reference</th>
              <th>Description</th>
              <th class="right" style="width:14%">Amount</th>
              <th class="right" style="width:10%">VAT</th>
              <th class="right" style="width:14%">Total</th>
            </tr>
          </thead>
          <tbody>
            ${invoiceRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Totals</td>
              <td class="right">R ${fmtZAR(invExcl)}</td>
              <td class="right">R ${fmtZAR(invVat)}</td>
              <td class="right">R ${fmtZAR(invTotal)}</td>
            </tr>
          </tfoot>
        </table>`
        }
      </div>

      <!-- Section 3: Lease Summary -->
      <div class="section">
        <div class="section-title">Lease Summary (Current Lease)</div>
        <table style="width: 60%;">
          <tbody>
            <tr style="background: #f8f9fa;">
              <td style="font-weight: 600;">Tenant</td>
              <td class="right">${prop.tenantName}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Current Monthly Rent</td>
              <td class="right">R ${fmtZAR(prop.currentRent)}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="font-weight: 600;">Deposit Balance</td>
              <td class="right">R ${fmtZAR(prop.depositBalance)}</td>
            </tr>
            <tr>
              <td style="font-weight: 600;">Lease End Date</td>
              <td class="right">${prop.leaseEndDate ? fmtDate(prop.leaseEndDate) : '—'}</td>
            </tr>
            <tr style="background: #f8f9fa;">
              <td style="font-weight: 600;">Outstanding Balance</td>
              <td class="right" style="color: ${prop.tenantOutstanding > 0 ? '#DC2626' : '#007A4D'};">
                R ${fmtZAR(prop.tenantOutstanding)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer -->
      <div style="margin-top: 32px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 8pt; color: #999; text-align: center;">
        Lalarente Property Manager &nbsp;|&nbsp; Generated ${today} &nbsp;|&nbsp; This statement is for informational purposes only.
      </div>
    </div>
    ${!isLast ? '<div class="page-break"></div>' : ''}
  `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${BASE_CSS}</style>
</head>
<body>
  ${propertySections}
</body>
</html>`;
}

// ─── Tax Statement ────────────────────────────────────────────────────────────

export interface TaxStatementExportData {
  ownerName: string;
  taxYearLabel: string;  // e.g. "2024/2025"
  startDate: string;     // "2024-03-01"
  endDate: string;       // "2025-02-28"
  grossRentalIncome: number;
  maintenanceDeductions: number;
  netTaxableEstimate: number;
  paymentCount: number;
  deductionCount: number;
  propertyBreakdown: {
    propertyTitle: string;
    grossIncome: number;
    deductions: number;
    net: number;
  }[];
}

function buildTaxStatementHtml(data: TaxStatementExportData): string {
  const period = `01 March ${data.taxYearLabel.split('/')[0]} to 28 February ${data.taxYearLabel.split('/')[1]}`;
  const today = fmtDate(new Date().toISOString());

  const breakdownRows = data.propertyBreakdown.map(
    pb => `
    <tr>
      <td>${pb.propertyTitle}</td>
      <td class="right">R ${fmtZAR(pb.grossIncome)}</td>
      <td class="right">R ${fmtZAR(pb.deductions)}</td>
      <td class="right" style="color: ${pb.net >= 0 ? '#007A4D' : '#DC2626'}; font-weight: 700;">
        R ${fmtZAR(pb.net)}
      </td>
    </tr>`,
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${BASE_CSS}</style>
</head>
<body>
  <div style="padding: 28px 32px;">

    <!-- Header -->
    <div style="background: #002395; color: #fff; padding: 20px 24px; margin-bottom: 0;">
      <div style="font-size: 20pt; font-weight: 700; margin-bottom: 4px;">Tax Statement</div>
      <div style="font-size: 11pt; font-weight: 600;">South African Tax Year ${data.taxYearLabel}</div>
      <div style="font-size: 9pt; margin-top: 4px; opacity: 0.85;">${period}</div>
    </div>

    <!-- Owner info bar -->
    <div style="background: #f0f4ff; padding: 12px 24px; border-bottom: 3px solid #FFB81C; display: flex; justify-content: space-between; margin-bottom: 24px;">
      <div>
        <div style="font-size: 8.5pt; color: #666; margin-bottom: 2px;">PREPARED FOR</div>
        <div style="font-size: 10pt; font-weight: 700;">${data.ownerName}</div>
        <div style="font-size: 9pt; color: #555;">Rental Property Portfolio</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 8.5pt; color: #666; margin-bottom: 2px;">GENERATED</div>
        <div style="font-size: 9pt; font-weight: 600;">${today}</div>
        <div style="font-size: 8pt; color: #888;">Lalarente Property Manager</div>
      </div>
    </div>

    <!-- Summary Cards -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: #002395; color: #fff; border-radius: 10px; padding: 14px 16px;">
        <div style="font-size: 8.5pt; opacity: 0.8; margin-bottom: 4px;">GROSS RENTAL INCOME</div>
        <div style="font-size: 16pt; font-weight: 800;">R ${fmtZAR(data.grossRentalIncome)}</div>
        <div style="font-size: 8pt; opacity: 0.7; margin-top: 2px;">${data.paymentCount} payment${data.paymentCount !== 1 ? 's' : ''}</div>
      </div>
      <div style="flex: 1; background: #DC2626; color: #fff; border-radius: 10px; padding: 14px 16px;">
        <div style="font-size: 8.5pt; opacity: 0.8; margin-bottom: 4px;">MAINTENANCE DEDUCTIONS</div>
        <div style="font-size: 16pt; font-weight: 800;">R ${fmtZAR(data.maintenanceDeductions)}</div>
        <div style="font-size: 8pt; opacity: 0.7; margin-top: 2px;">${data.deductionCount} purchase order${data.deductionCount !== 1 ? 's' : ''}</div>
      </div>
      <div style="flex: 1; background: #FFB81C; color: #1a1a1a; border-radius: 10px; padding: 14px 16px;">
        <div style="font-size: 8.5pt; opacity: 0.75; margin-bottom: 4px;">NET TAXABLE ESTIMATE</div>
        <div style="font-size: 16pt; font-weight: 800;">R ${fmtZAR(data.netTaxableEstimate)}</div>
        <div style="font-size: 8pt; opacity: 0.7; margin-top: 2px;">ITR12 Section 4</div>
      </div>
    </div>

    <!-- Income & Expenses table -->
    <div class="section" style="margin-bottom: 24px;">
      <div class="section-title">Income and Expenses</div>
      <div class="section-sub">
        Summary of all rental income received and maintenance deductions for tax year ${data.taxYearLabel}.
      </div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th class="right" style="width: 22%;">Income</th>
            <th class="right" style="width: 22%;">Expenses</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Rent received for tax year period</td>
            <td class="right"><strong>R ${fmtZAR(data.grossRentalIncome)}</strong></td>
            <td></td>
          </tr>
          <tr>
            <td>Maintenance &amp; repair costs (purchase orders)</td>
            <td></td>
            <td class="right">R ${fmtZAR(data.maintenanceDeductions)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td style="text-align: right;">Totals</td>
            <td class="right">R ${fmtZAR(data.grossRentalIncome)}</td>
            <td class="right">R ${fmtZAR(data.maintenanceDeductions)}</td>
          </tr>
          <tr>
            <td colspan="2" style="text-align: right; font-size: 10pt;">Net Operating Income</td>
            <td class="right" style="font-size: 11pt; color: ${data.netTaxableEstimate >= 0 ? '#007A4D' : '#DC2626'};">
              R ${fmtZAR(data.netTaxableEstimate)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Per-property breakdown -->
    ${data.propertyBreakdown.length > 0 ? `
    <div class="section" style="margin-bottom: 24px;">
      <div class="section-title">Per-Property Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th class="right" style="width: 22%;">Gross Income</th>
            <th class="right" style="width: 22%;">Deductions</th>
            <th class="right" style="width: 22%;">Net</th>
          </tr>
        </thead>
        <tbody>
          ${breakdownRows}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="right">R ${fmtZAR(data.grossRentalIncome)}</td>
            <td class="right">R ${fmtZAR(data.maintenanceDeductions)}</td>
            <td class="right" style="color: ${data.netTaxableEstimate >= 0 ? '#007A4D' : '#DC2626'};">
              R ${fmtZAR(data.netTaxableEstimate)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    ` : ''}

    <!-- Disclaimer -->
    <div style="background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 12px 16px; border-radius: 6px; margin-bottom: 24px;">
      <div style="font-size: 8.5pt; font-weight: 700; color: #1D4ED8; margin-bottom: 4px;">⚠ SARS Disclaimer</div>
      <div style="font-size: 8pt; color: #1E40AF; line-height: 1.5;">
        This is an estimate only for SARS ITR12 Section 4 (Rental Income). Bond interest, municipal rates,
        insurance premiums, and levies are NOT included — add these manually. Consult a registered tax
        practitioner before submitting your ITR12. South African tax year: 1 March – 28/29 February.
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid #ddd; padding-top: 10px; font-size: 8pt; color: #999; text-align: center;">
      Lalarente Property Manager &nbsp;|&nbsp; Generated ${today} &nbsp;|&nbsp;
      This statement is for informational purposes only. Not a substitute for professional tax advice.
    </div>

  </div>
</body>
</html>`;
}

// ─── Public Export Functions ──────────────────────────────────────────────────

/**
 * Fetch data and export Owner Monthly Statement as a PDF.
 * Called from OwnerMonthlyStatementScreen.
 */
export async function exportMonthlyStatementPdf(
  ownerId: string,
  month: number,
  year: number,
): Promise<void> {
  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const period = `01 ${MONTHS[month]} ${year} to ${new Date(year, month + 1, 0).getDate()} ${MONTHS[month]} ${year}`;

  // 1. Owner profile
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', ownerId)
    .single();
  const ownerName = ownerProfile?.full_name || 'Property Owner';

  // 2. Active leases with property + tenant details (deposit_amount stored on lease)
  const { data: leases } = await supabase
    .from('leases')
    .select(`
      id, monthly_rent, end_date, deposit_amount,
      properties!leases_property_id_fkey(id, title, address, city),
      profiles!leases_tenant_id_fkey(full_name)
    `)
    .eq('owner_id', ownerId)
    .in('status', ['active', 'signed']);

  if (!leases?.length) {
    throw new Error('No active leases found for this period.');
  }

  const propertyIds = leases.map(l => (l as any).properties?.id).filter(Boolean);

  // 3. Payments for this month
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, paid_date, property_id, status')
    .in('property_id', propertyIds)
    .eq('status', 'completed')
    .gte('paid_date', monthStart)
    .lte('paid_date', monthEnd);

  // 4. POs paid this month (maintenance expenses)
  const { data: maintenanceRequests } = await supabase
    .from('maintenance_requests')
    .select('id, property_id, description')
    .in('property_id', propertyIds)
    .eq('owner_id', ownerId);

  let posByProperty: Record<string, { date: string; ref: string; description: string; amount: number }[]> = {};

  if (maintenanceRequests?.length) {
    const requestIds = maintenanceRequests.map(r => r.id);
    const reqPropertyMap: Record<string, string> = {};
    const reqDescMap: Record<string, string> = {};
    maintenanceRequests.forEach(r => {
      if (r.id) {
        reqPropertyMap[r.id] = r.property_id || '';
        reqDescMap[r.id] = r.description || 'Maintenance';
      }
    });

    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, request_id')
      .in('request_id', requestIds);

    if (quotes?.length) {
      const quoteIds = quotes.map(q => q.id);
      const quoteReqMap: Record<string, string> = {};
      quotes.forEach(q => { if (q.id) quoteReqMap[q.id] = q.request_id || ''; });

      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, contract_id, total_amount, created_at')
        .in('contract_id', quoteIds)
        .in('status', ['paid', 'completed'])
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      pos?.forEach(po => {
        const reqId = quoteReqMap[po.contract_id || ''];
        const propId = reqId ? reqPropertyMap[reqId] : null;
        const desc = reqId ? reqDescMap[reqId] : 'Maintenance';
        if (propId) {
          if (!posByProperty[propId]) posByProperty[propId] = [];
          posByProperty[propId].push({
            date: po.created_at || '',
            ref: `PO-${po.id?.slice(0, 8).toUpperCase()}`,
            description: desc,
            amount: po.total_amount || 0,
          });
        }
      });
    }
  }

  // 6. Build per-property sections
  const propertySections: PropertyStatementSection[] = leases.map(lease => {
    const prop = (lease as any).properties;
    const tenant = (lease as any).profiles;
    const propId = prop?.id || '';

    const propAddress = [prop?.address, prop?.city].filter(Boolean).join(', ') || 'Address not set';

    const rentCollected = (payments || [])
      .filter(p => p.property_id === propId)
      .reduce((s, p) => s + (p.amount || 0), 0);

    const depositBalance = (lease as any).deposit_amount || 0;

    const pos = posByProperty[propId] || [];
    const totalExpenses = pos.reduce((s, po) => s + po.amount, 0);

    const rentBilled = lease.monthly_rent || 0;
    const tenantOutstanding = Math.max(0, rentBilled - rentCollected);

    const expenseItems: ExpenseItem[] = pos.map(po => ({
      date: po.date,
      description: po.description,
      amount: po.amount,
    }));

    const invoiceItems: InvoiceItem[] = pos.map(po => ({
      date: po.date,
      ref: po.ref,
      description: po.description,
      amountExcl: po.amount,
      vat: 0, // self-managed, no VAT registered assumed
      total: po.amount,
    }));

    return {
      propertyTitle: prop?.title || 'Property',
      propertyAddress: propAddress,
      tenantName: tenant?.full_name || 'Tenant',
      currentRent: rentBilled,
      depositBalance,
      leaseEndDate: lease.end_date || null,
      tenantOutstanding,
      rentCollected,
      expenseItems,
      totalExpenses,
      netIncome: rentCollected - totalExpenses,
      invoiceItems,
    };
  });

  const html = buildOwnerStatementHtml(ownerName, period, propertySections);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Owner Statement — ${MONTHS[month]} ${year}`,
      UTI: 'com.adobe.pdf',
    });
  }
}

/**
 * Export Tax Statement as a PDF.
 * Data is passed in from OwnerTaxReportScreen (already fetched).
 */
export async function exportTaxStatementPdf(data: TaxStatementExportData): Promise<void> {
  const html = buildTaxStatementHtml(data);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Tax Statement ${data.taxYearLabel}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
