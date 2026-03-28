/**
 * PDF Report Generation — Owner Statement & Tax Statement
 *
 * Uses expo-print to generate HTML → PDF and expo-sharing to share/save.
 * Templates mirror the client-provided PDF templates.
 */

import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../../lib/supabase';
import { documentsApi } from '../../documents/api/documentsApi';

// ─── Internal helper ─────────────────────────────────────────────────────────

async function saveReportToDocuments(
  uri: string,
  type: 'owner_statement' | 'tax_statement' | 'invoice' | 'inspection_report',
  title: string,
  ownerId: string,
  opts?: {
    property_id?: string;
    lease_id?: string;
    tenant_id?: string;
    access_level?: 'owner_only' | 'tenant_only' | 'both' | 'admin_only';
  },
): Promise<string> {
  const fileInfo = await FileSystem.getInfoAsync(uri);
  const size = fileInfo.exists && 'size' in fileInfo ? (fileInfo as any).size : 0;

  const doc = await documentsApi.uploadDocument(
    {
      uri,
      name: `${type}_${Date.now()}.pdf`,
      size,
      mimeType: 'application/pdf',
    },
    {
      type,
      title,
      access_level: opts?.access_level ?? 'owner_only',
      owner_id: ownerId,
      property_id: opts?.property_id,
      lease_id: opts?.lease_id,
      tenant_id: opts?.tenant_id,
    },
    ownerId,
  );

  return doc.id;
}

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
): Promise<string> {
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

    // service_contracts is the join between requests and purchase_orders
    const { data: contracts } = await supabase
      .from('service_contracts')
      .select('id, maintenance_request_id')
      .in('maintenance_request_id', requestIds);

    if (contracts?.length) {
      const contractIds = contracts.map(c => c.id);
      const contractReqMap: Record<string, string> = {};
      contracts.forEach(c => { if (c.id) contractReqMap[c.id] = c.maintenance_request_id || ''; });

      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, contract_id, total_amount, created_at')
        .in('contract_id', contractIds)
        .in('status', ['paid', 'completed'])
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      pos?.forEach(po => {
        const reqId = contractReqMap[po.contract_id || ''];
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

  const title = `Owner Statement — ${MONTHS[month]} ${year}`;
  const documentId = await saveReportToDocuments(uri, 'owner_statement', title, ownerId);

  return documentId;
}

/**
 * Export Tax Statement as a PDF.
 * Data is passed in from OwnerTaxReportScreen (already fetched).
 */
export async function exportTaxStatementPdf(
  data: TaxStatementExportData,
  ownerId: string,
): Promise<string> {
  const html = buildTaxStatementHtml(data);

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const title = `Tax Statement ${data.taxYearLabel}`;
  const documentId = await saveReportToDocuments(uri, 'tax_statement', title, ownerId);

  return documentId;
}

// ─── Invoice Export ───────────────────────────────────────────────────────────

export interface RentInvoiceRow {
  id: string;
  tenant_name: string;
  property_title: string;
  amount: number;
  due_date: string | null;
  paid_date: string | null;
  status: string;
}

export interface VendorInvoiceRow {
  id: string;
  po_number: string;
  vendor_name: string;
  property_title: string;
  request_title: string;
  subtotal: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  status: string;
  created_at: string | null;
}

function buildInvoicesHtml(
  ownerName: string,
  tab: 'rent' | 'vendor',
  rentInvoices: RentInvoiceRow[],
  vendorInvoices: VendorInvoiceRow[],
): string {
  const today = fmtDate(new Date().toISOString());
  const isRent = tab === 'rent';

  const title = isRent ? 'Rent Invoices' : 'Vendor Invoices';
  const total = isRent
    ? rentInvoices.filter(i => i.status === 'completed').reduce((s, i) => s + i.amount, 0)
    : vendorInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);

  const rows = isRent
    ? rentInvoices.map(i => `
      <tr>
        <td>${i.tenant_name}</td>
        <td>${i.property_title}</td>
        <td>${fmtDate(i.due_date)}</td>
        <td>${i.paid_date ? fmtDate(i.paid_date) : '—'}</td>
        <td class="right"><strong>R ${fmtZAR(i.amount)}</strong></td>
        <td style="text-align:center;">
          <span style="background:${i.status === 'completed' ? '#dcfce7' : '#fef9c3'};color:${i.status === 'completed' ? '#166534' : '#854d0e'};padding:2px 8px;border-radius:4px;font-size:8.5pt;">${i.status}</span>
        </td>
      </tr>`).join('')
    : vendorInvoices.map(po => `
      <tr>
        <td>${po.po_number}</td>
        <td>${po.vendor_name}</td>
        <td>${po.request_title}</td>
        <td>${po.property_title}</td>
        <td class="right">R ${fmtZAR(po.subtotal || 0)}</td>
        <td class="right">R ${fmtZAR(po.vat_amount || 0)}</td>
        <td class="right"><strong>R ${fmtZAR(po.total_amount || 0)}</strong></td>
        <td style="text-align:center;">
          <span style="background:#ede9fe;color:#4c1d95;padding:2px 8px;border-radius:4px;font-size:8.5pt;">${po.status}</span>
        </td>
      </tr>`).join('');

  const thead = isRent
    ? `<tr>
        <th>Tenant</th><th>Property</th><th>Due Date</th><th>Paid Date</th>
        <th class="right">Amount</th><th style="text-align:center;">Status</th>
       </tr>`
    : `<tr>
        <th>PO #</th><th>Vendor</th><th>Job</th><th>Property</th>
        <th class="right">Subtotal</th><th class="right">VAT</th>
        <th class="right">Total</th><th style="text-align:center;">Status</th>
       </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div style="padding:28px 32px;">
    <div style="background:#002395;color:#fff;padding:20px 24px;margin-bottom:0;">
      <div style="font-size:20pt;font-weight:700;margin-bottom:4px;">${title}</div>
      <div style="font-size:9pt;margin-top:4px;opacity:0.85;">Exported ${today}</div>
    </div>
    <div style="background:#f0f4ff;padding:12px 24px;border-bottom:3px solid #FFB81C;display:flex;justify-content:space-between;margin-bottom:24px;">
      <div>
        <div style="font-size:8.5pt;color:#666;margin-bottom:2px;">PREPARED FOR</div>
        <div style="font-size:10pt;font-weight:700;">${ownerName}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:8.5pt;color:#666;margin-bottom:2px;">${isRent ? 'TOTAL COLLECTED' : 'TOTAL SPEND'}</div>
        <div style="font-size:14pt;font-weight:800;color:#002395;">R ${fmtZAR(total)}</div>
      </div>
    </div>
    <div class="section">
      <div class="section-title">${title}</div>
      ${(isRent ? rentInvoices.length : vendorInvoices.length) === 0
        ? '<p style="font-size:9pt;color:#888;padding:8px 0;">No invoices to display.</p>'
        : `<table><thead>${thead}</thead><tbody>${rows}</tbody></table>`}
    </div>
    <div style="border-top:1px solid #ddd;padding-top:10px;font-size:8pt;color:#999;text-align:center;">
      Lalarente Property Manager &nbsp;|&nbsp; Generated ${today} &nbsp;|&nbsp; For informational purposes only.
    </div>
  </div>
</body>
</html>`;
}

// ─── Single Invoice HTML builders ────────────────────────────────────────────

function buildSingleRentInvoiceHtml(ownerName: string, inv: RentInvoiceRow): string {
  const today = fmtDate(new Date().toISOString());
  const invNumber = `INV-${inv.id.slice(0, 8).toUpperCase()}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div style="padding:28px 32px;">
    <div style="background:#002395;color:#fff;padding:20px 24px;margin-bottom:0;">
      <div style="font-size:20pt;font-weight:700;margin-bottom:4px;">Rent Invoice</div>
      <div style="font-size:11pt;font-weight:600;">${invNumber}</div>
      <div style="font-size:9pt;margin-top:4px;opacity:0.85;">Generated ${today}</div>
    </div>
    <div style="background:#f0f4ff;padding:12px 24px;border-bottom:3px solid #FFB81C;display:flex;justify-content:space-between;margin-bottom:24px;">
      <div>
        <div style="font-size:8.5pt;color:#666;margin-bottom:2px;">FROM</div>
        <div style="font-size:10pt;font-weight:700;">${ownerName}</div>
        <div style="font-size:9pt;color:#555;">Lalarente Property Manager</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:8.5pt;color:#666;margin-bottom:2px;">TO</div>
        <div style="font-size:10pt;font-weight:700;">${inv.tenant_name}</div>
        <div style="font-size:9pt;color:#555;">${inv.property_title}</div>
      </div>
    </div>
    <div class="section" style="margin-bottom:24px;">
      <div class="section-title">Invoice Details</div>
      <table style="width:60%;">
        <tbody>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:600;">Invoice Number</td>
            <td class="right">${invNumber}</td>
          </tr>
          <tr>
            <td style="font-weight:600;">Property</td>
            <td class="right">${inv.property_title}</td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:600;">Tenant</td>
            <td class="right">${inv.tenant_name}</td>
          </tr>
          <tr>
            <td style="font-weight:600;">Due Date</td>
            <td class="right">${fmtDate(inv.due_date)}</td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:600;">Paid Date</td>
            <td class="right">${inv.paid_date ? fmtDate(inv.paid_date) : '—'}</td>
          </tr>
          <tr>
            <td style="font-weight:600;">Status</td>
            <td class="right">
              <span style="background:${inv.status === 'completed' ? '#dcfce7' : '#fef9c3'};color:${inv.status === 'completed' ? '#166534' : '#854d0e'};padding:2px 8px;border-radius:4px;font-size:8.5pt;">${inv.status}</span>
            </td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:700;font-size:11pt;">Amount Due</td>
            <td class="right" style="font-size:14pt;font-weight:800;color:#002395;">R ${fmtZAR(inv.amount)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="border-top:1px solid #ddd;padding-top:10px;font-size:8pt;color:#999;text-align:center;">
      Lalarente Property Manager &nbsp;|&nbsp; Generated ${today} &nbsp;|&nbsp; For informational purposes only.
    </div>
  </div>
</body>
</html>`;
}

function buildSingleVendorInvoiceHtml(ownerName: string, po: VendorInvoiceRow): string {
  const today = fmtDate(new Date().toISOString());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>${BASE_CSS}</style>
</head>
<body>
  <div style="padding:28px 32px;">
    <div style="background:#002395;color:#fff;padding:20px 24px;margin-bottom:0;">
      <div style="font-size:20pt;font-weight:700;margin-bottom:4px;">Purchase Order</div>
      <div style="font-size:11pt;font-weight:600;">${po.po_number}</div>
      <div style="font-size:9pt;margin-top:4px;opacity:0.85;">Generated ${today}</div>
    </div>
    <div style="background:#f0f4ff;padding:12px 24px;border-bottom:3px solid #FFB81C;display:flex;justify-content:space-between;margin-bottom:24px;">
      <div>
        <div style="font-size:8.5pt;color:#666;margin-bottom:2px;">ISSUED BY</div>
        <div style="font-size:10pt;font-weight:700;">${ownerName}</div>
        <div style="font-size:9pt;color:#555;">${po.property_title}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:8.5pt;color:#666;margin-bottom:2px;">VENDOR</div>
        <div style="font-size:10pt;font-weight:700;">${po.vendor_name}</div>
        <div style="font-size:9pt;color:#555;">${po.request_title}</div>
      </div>
    </div>
    <div class="section" style="margin-bottom:24px;">
      <div class="section-title">PO Details</div>
      <table style="width:60%;">
        <tbody>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:600;">PO Number</td>
            <td class="right">${po.po_number}</td>
          </tr>
          <tr>
            <td style="font-weight:600;">Job Description</td>
            <td class="right">${po.request_title}</td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:600;">Property</td>
            <td class="right">${po.property_title}</td>
          </tr>
          <tr>
            <td style="font-weight:600;">Issue Date</td>
            <td class="right">${fmtDate(po.created_at)}</td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:600;">Status</td>
            <td class="right">
              <span style="background:#ede9fe;color:#4c1d95;padding:2px 8px;border-radius:4px;font-size:8.5pt;">${po.status}</span>
            </td>
          </tr>
          <tr><td colspan="2" style="padding:4px 0;"></td></tr>
          <tr>
            <td style="font-weight:600;">Subtotal (excl. VAT)</td>
            <td class="right">R ${fmtZAR(po.subtotal || 0)}</td>
          </tr>
          <tr style="background:#f8f9fa;">
            <td style="font-weight:600;">VAT (15%)</td>
            <td class="right">R ${fmtZAR(po.vat_amount || 0)}</td>
          </tr>
          <tr>
            <td style="font-weight:700;font-size:11pt;">Total Amount</td>
            <td class="right" style="font-size:14pt;font-weight:800;color:#002395;">R ${fmtZAR(po.total_amount || 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="border-top:1px solid #ddd;padding-top:10px;font-size:8pt;color:#999;text-align:center;">
      Lalarente Property Manager &nbsp;|&nbsp; Generated ${today} &nbsp;|&nbsp; For informational purposes only.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Export a single rent invoice as a PDF.
 */
export async function exportSingleRentInvoicePdf(
  ownerName: string,
  ownerId: string,
  invoice: RentInvoiceRow,
): Promise<string> {
  const html = buildSingleRentInvoiceHtml(ownerName, invoice);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const invNumber = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
  const title = `Rent Invoice ${invNumber} — ${invoice.tenant_name}`;
  return saveReportToDocuments(uri, 'invoice', title, ownerId);
}

/**
 * Export a single vendor PO as a PDF.
 */
export async function exportSingleVendorInvoicePdf(
  ownerName: string,
  ownerId: string,
  po: VendorInvoiceRow,
): Promise<string> {
  const html = buildSingleVendorInvoiceHtml(ownerName, po);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const title = `PO ${po.po_number} — ${po.vendor_name}`;
  return saveReportToDocuments(uri, 'invoice', title, ownerId);
}

/**
 * Export Invoices as a PDF.
 * Pass the currently-displayed tab and its data from OwnerInvoicesScreen.
 */
export async function exportInvoicesPdf(
  ownerName: string,
  ownerId: string,
  tab: 'rent' | 'vendor',
  rentInvoices: RentInvoiceRow[],
  vendorInvoices: VendorInvoiceRow[],
): Promise<string> {
  const html = buildInvoicesHtml(ownerName, tab, rentInvoices, vendorInvoices);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const label = tab === 'rent' ? 'Rent Invoices' : 'Vendor Invoices';
  const today = new Date();
  const title = `${label} — ${today.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}`;
  const documentId = await saveReportToDocuments(uri, 'invoice', title, ownerId);

  return documentId;
}

// ─── Inspection Report ────────────────────────────────────────────────────────

interface RoomReportSection {
  name: string;
  overallCondition: string;
  notes: string;
  items: { name: string; condition: string; notes: string; photoDataUris: string[] }[];
  photoDataUris: string[];
}

function conditionColor(c: string): string {
  const m: Record<string, string> = {
    excellent: '#4CAF50', good: '#8BC34A', fair: '#FFC107',
    poor: '#FF9800', damaged: '#F44336',
  };
  return m[c] || '#9CA3AF';
}

function conditionBg(c: string): string {
  const m: Record<string, string> = {
    excellent: '#E8F5E9', good: '#F1F8E9', fair: '#FFFDE7',
    poor: '#FFF3E0', damaged: '#FFEBEE',
  };
  return m[c] || '#F5F5F5';
}

/** Attempt to read a local file URI as a base64 data URI. Returns null if unavailable. */
async function getPhotoBase64(uri: string | undefined): Promise<string | null> {
  if (!uri) return null;
  try {
    if (uri.startsWith('http')) return uri; // remote URL — embed directly
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' as any });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null; // file no longer on device — skip gracefully
  }
}

function buildInspectionReportHtml(
  insp: {
    type: string;
    scheduled_date: string;
    overall_condition: string | null;
    owner_signed_at: string | null;
    tenant_signed_at: string | null;
    property: { title: string; address: string | null; city: string | null } | null;
    owner: { full_name: string; email: string | null; phone: string | null } | null;
    tenant: { full_name: string; email: string | null; phone: string | null } | null;
  },
  rooms: RoomReportSection[],
  keys: { physicalKeys: number; accessCards: number; remoteControls: number },
  generalNotes: string,
): string {
  const today = fmtDate(new Date().toISOString());
  const typeLabel =
    insp.type === 'move_in' ? 'Move-In' :
    insp.type === 'move_out' ? 'Move-Out' : 'Periodic';
  const propertyAddress =
    [insp.property?.address, insp.property?.city].filter(Boolean).join(', ') || '—';
  const inspDate = fmtDate(insp.scheduled_date);

  // Assign global sequential Ref numbers to all items
  let refCounter = 1;
  const roomsWithRefs = rooms.map(room => ({
    ...room,
    items: room.items.map(item => ({ ...item, ref: refCounter++ })),
  }));

  // Collect Actions Required — poor/damaged items
  const actionItems = roomsWithRefs.flatMap(room =>
    room.items
      .filter(item => item.condition === 'poor' || item.condition === 'damaged')
      .map(item => ({ ref: item.ref, room: room.name, name: item.name, condition: item.condition, notes: item.notes }))
  );

  // Condition → tri-column (Clean | Undamaged | Working)
  function triCol(c: string): [string, string, string] {
    switch (c) {
      case 'excellent': case 'good': return ['Y', 'Y', 'Y'];
      case 'fair': return ['Y', 'Y', 'Y'];
      case 'poor':    return ['N', 'N', 'Y'];
      case 'damaged': return ['N', 'N', 'N'];
      default:        return ['Y', 'Y', 'Y'];
    }
  }
  function yCell(v: string): string {
    return v === 'Y'
      ? `<td class="tri-y">Y</td>`
      : `<td class="tri-n">N</td>`;
  }

  // Build per-room HTML
  const roomSections = roomsWithRefs.map((room, rIdx) => {
    const itemRows = room.items.map(item => {
      const [cl, un, wk] = triCol(item.condition);
      const commentText = item.notes || (item.condition === 'fair' ? 'Minor wear' : '');
      return `<tr>
        <td class="ref-cell">${item.ref}</td>
        <td class="name-cell">${item.name}</td>
        ${yCell(cl)}${yCell(un)}${yCell(wk)}
        <td class="comment-cell">${commentText}</td>
      </tr>`;
    }).join('');

    // All photos for this room: item-level + room-level
    const allPhotos: { uri: string; ref: number; label: string }[] = [];
    for (const item of room.items) {
      for (const uri of item.photoDataUris) {
        allPhotos.push({ uri, ref: item.ref, label: item.name });
      }
    }
    for (const uri of room.photoDataUris) {
      allPhotos.push({ uri, ref: 0, label: room.name });
    }

    const photoGrid = allPhotos.length > 0
      ? `<div class="photo-section">
          <div class="photo-section-label">Photos</div>
          <div class="photo-grid">
            ${allPhotos.map(p => `
              <div class="photo-cell">
                <img src="${p.uri}" class="photo-img" />
                <div class="photo-caption">${p.ref > 0 ? `Ref ${p.ref} — ` : ''}${p.label}</div>
                <div class="photo-date">${inspDate}</div>
              </div>`).join('')}
          </div>
        </div>`
      : '';

    const isLastRoom = rIdx === rooms.length - 1;
    return `<div class="room-section${isLastRoom ? '' : ' pbk'}">
      <div class="room-header">
        <span class="room-header-name">${room.name}</span>
        <span class="room-header-badge" style="background:${conditionBg(room.overallCondition)};color:${conditionColor(room.overallCondition)};">${room.overallCondition.toUpperCase()}</span>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th class="th-ref">Ref</th>
            <th class="th-name">Name</th>
            <th class="th-tri">Clean</th>
            <th class="th-tri">Undamaged</th>
            <th class="th-tri">Working</th>
            <th>Comments</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      ${room.notes ? `<div class="room-notes"><strong>Notes:</strong> ${room.notes}</div>` : ''}
      ${photoGrid}
    </div>`;
  }).join('');

  // Actions Required section
  const actionsSection = actionItems.length > 0
    ? `<div class="actions-section pbk">
        <div class="section-header">ACTIONS REQUIRED</div>
        <table class="items-table">
          <thead>
            <tr>
              <th class="th-ref">Ref</th>
              <th class="th-name">Room</th>
              <th class="th-name">Item</th>
              <th class="th-tri">Condition</th>
              <th>Action Required</th>
              <th class="th-tri">Responsibility</th>
            </tr>
          </thead>
          <tbody>
            ${actionItems.map(a => `<tr>
              <td class="ref-cell">${a.ref}</td>
              <td style="font-size:8.5pt;">${a.room}</td>
              <td style="font-size:8.5pt;">${a.name}</td>
              <td style="font-size:8pt;text-align:center;color:${conditionColor(a.condition)};font-weight:700;">${a.condition.toUpperCase()}</td>
              <td style="font-size:8.5pt;">${a.notes || 'Assess and repair / replace as necessary'}</td>
              <td style="font-size:8pt;text-align:center;color:#555;">Tenant</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    : '';

  // Keys + general notes
  const keysSection = `<div class="keys-section">
    <div class="section-header">KEY HANDOVER</div>
    <table class="keys-table">
      <thead><tr><th>Item</th><th class="th-count">Quantity</th></tr></thead>
      <tbody>
        <tr><td>Physical Keys</td><td class="count-cell">${keys.physicalKeys}</td></tr>
        <tr><td>Access Cards</td><td class="count-cell">${keys.accessCards}</td></tr>
        <tr><td>Remote Controls</td><td class="count-cell">${keys.remoteControls}</td></tr>
      </tbody>
    </table>
    ${generalNotes ? `<div class="general-notes"><strong>General Notes:</strong> ${generalNotes}</div>` : ''}
  </div>`;

  // Signatures
  const sigOwnerBlock = insp.owner_signed_at
    ? `<div class="sig-signed">✓ Signed: ${fmtDate(insp.owner_signed_at)}</div>`
    : `<div class="sig-line"></div><div class="sig-date-label">Date: ____________________________</div>`;
  const sigTenantBlock = insp.tenant_signed_at
    ? `<div class="sig-signed">✓ Signed: ${fmtDate(insp.tenant_signed_at)}</div>`
    : `<div class="sig-line"></div><div class="sig-date-label">Date: ____________________________</div>`;

  const signaturesSection = `<div class="signatures-section">
    <div class="section-header">DECLARATION &amp; SIGNATURES</div>
    <div class="legal-note">
      This inspection report was completed in accordance with the Rental Housing Act 50 of 1999, Section 5(3)(e)–(f).
      Both parties acknowledge the condition of the property as recorded above and are entitled to a signed copy of this report.
    </div>
    <div class="sig-blocks">
      <div class="sig-block">
        <div class="sig-party">LANDLORD / OWNER</div>
        <div class="sig-name">${insp.owner?.full_name || '—'}</div>
        <div class="sig-contact">${[insp.owner?.email, insp.owner?.phone].filter(Boolean).join(' | ') || ''}</div>
        ${sigOwnerBlock}
      </div>
      <div class="sig-block">
        <div class="sig-party">TENANT</div>
        <div class="sig-name">${insp.tenant?.full_name || '—'}</div>
        <div class="sig-contact">${[insp.tenant?.email, insp.tenant?.phone].filter(Boolean).join(' | ') || ''}</div>
        ${sigTenantBlock}
      </div>
    </div>
  </div>`;

  const CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #1a1a1a; background: #fff; }

    /* ── Cover ── */
    .cover-header { background: #002395; color: #fff; padding: 28px 32px 20px; }
    .cover-logo { font-size: 8.5pt; letter-spacing: 2px; text-transform: uppercase; opacity: 0.7; margin-bottom: 6px; }
    .cover-title { font-size: 22pt; font-weight: 700; line-height: 1.2; }
    .cover-subtitle { font-size: 11pt; font-weight: 600; margin-top: 4px; color: #FFB81C; }
    .cover-gold { height: 4px; background: #FFB81C; }
    .cover-body { padding: 24px 32px; }
    .info-grid { display: flex; gap: 28px; margin-bottom: 22px; }
    .info-col { flex: 1; }
    .info-label { font-size: 7.5pt; font-weight: 700; color: #002395; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .info-value { font-size: 10.5pt; font-weight: 600; color: #111; margin-bottom: 2px; }
    .info-sub { font-size: 8.5pt; color: #555; }
    .cover-meta { border-top: 1px solid #E5E7EB; padding-top: 16px; display: flex; gap: 28px; }
    .cond-badge { display: inline-block; padding: 4px 16px; border-radius: 5px; font-size: 9pt; font-weight: 700; margin-top: 6px; }
    .cover-footer { background: #F8F9FA; padding: 10px 32px; border-top: 1px solid #E5E7EB; font-size: 7.5pt; color: #666; margin-top: 24px; }

    /* ── Section headers ── */
    .section-header { background: #002395; color: #fff; padding: 8px 14px; font-size: 10pt; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 0; }
    .pbk { page-break-after: always; }

    /* ── Room ── */
    .room-section { margin-bottom: 12px; }
    .room-header { background: #1a1a2e; color: #fff; padding: 9px 14px; display: flex; justify-content: space-between; align-items: center; }
    .room-header-name { font-size: 10pt; font-weight: 700; }
    .room-header-badge { font-size: 8pt; font-weight: 700; padding: 3px 10px; border-radius: 4px; }

    /* ── Tables ── */
    .items-table { width: 100%; border-collapse: collapse; }
    .items-table thead th { background: #002395; color: #fff; padding: 6px 8px; font-size: 8.5pt; font-weight: 600; text-align: left; border-right: 1px solid #1a4db5; }
    .items-table tbody td { padding: 5px 8px; font-size: 8.5pt; border-bottom: 1px solid #E5E7EB; border-right: 1px solid #F3F4F6; vertical-align: middle; }
    .items-table tbody tr:nth-child(even) { background: #F8F9FA; }
    .th-ref { width: 36px; text-align: center; }
    .th-name { width: 22%; }
    .th-tri { width: 9%; text-align: center; }
    .th-count { width: 80px; text-align: center; }
    .ref-cell { text-align: center; font-size: 8pt; color: #6B7280; font-weight: 700; }
    .name-cell { font-weight: 500; }
    .comment-cell { font-size: 8pt; color: #555; }
    .tri-y { text-align: center; color: #16a34a; font-weight: 700; font-size: 9.5pt; }
    .tri-n { text-align: center; color: #dc2626; font-weight: 700; font-size: 9.5pt; }

    /* ── Photos ── */
    .photo-section { margin-top: 8px; padding: 8px 4px 4px; border-top: 1px solid #F3F4F6; }
    .photo-section-label { font-size: 7.5pt; font-weight: 700; color: #002395; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .photo-cell { width: calc(33.333% - 6px); }
    .photo-img { width: 100%; height: 110px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd; display: block; }
    .photo-caption { font-size: 7.5pt; font-weight: 600; color: #333; margin-top: 3px; }
    .photo-date { font-size: 7pt; color: #888; }

    /* ── Room notes ── */
    .room-notes { background: #F0F4FF; padding: 7px 12px; font-size: 8.5pt; color: #374151; border-left: 3px solid #002395; }

    /* ── Keys ── */
    .keys-section { margin-bottom: 16px; }
    .keys-table { width: 40%; border-collapse: collapse; margin-bottom: 0; }
    .keys-table thead th { background: #002395; color: #fff; padding: 6px 10px; font-size: 8.5pt; text-align: left; }
    .keys-table tbody td { padding: 7px 10px; font-size: 9pt; border-bottom: 1px solid #E5E7EB; }
    .keys-table tbody tr:nth-child(even) { background: #F8F9FA; }
    .count-cell { text-align: center; font-size: 12pt; font-weight: 700; color: #002395; }
    .general-notes { background: #F9FAFB; border-radius: 4px; padding: 10px 12px; font-size: 8.5pt; color: #374151; line-height: 1.6; margin-top: 10px; }

    /* ── Signatures ── */
    .signatures-section { margin-top: 8px; }
    .legal-note { background: #EFF6FF; border-left: 4px solid #3B82F6; padding: 9px 13px; font-size: 8pt; color: #1E40AF; line-height: 1.6; margin: 10px 0 18px; }
    .sig-blocks { display: flex; gap: 28px; margin-top: 8px; }
    .sig-block { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; }
    .sig-party { font-size: 7.5pt; font-weight: 700; color: #002395; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
    .sig-name { font-size: 11pt; font-weight: 700; color: #111; }
    .sig-contact { font-size: 8pt; color: #6B7280; margin-top: 2px; margin-bottom: 16px; }
    .sig-line { height: 1px; background: #374151; margin: 28px 0 6px; }
    .sig-date-label { font-size: 8pt; color: #555; }
    .sig-signed { color: #16a34a; font-weight: 700; font-size: 9pt; margin-top: 12px; }

    .report-footer { border-top: 1px solid #ddd; padding-top: 8px; margin-top: 20px; font-size: 7.5pt; color: #999; text-align: center; }
    .actions-section { margin-bottom: 0; }
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>${CSS}</style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="pbk">
    <div class="cover-header">
      <div class="cover-logo">Lalarente Property Manager</div>
      <div class="cover-title">Property Inspection Report</div>
      <div class="cover-subtitle">${typeLabel} Inspection</div>
    </div>
    <div class="cover-gold"></div>
    <div class="cover-body">
      <div class="info-grid">
        <div class="info-col">
          <div class="info-label">Property</div>
          <div class="info-value">${insp.property?.title || '—'}</div>
          <div class="info-sub">${propertyAddress}</div>
        </div>
        <div class="info-col">
          <div class="info-label">Inspection Date</div>
          <div class="info-value">${inspDate}</div>
          <div class="info-sub">Generated: ${today}</div>
        </div>
        <div class="info-col">
          <div class="info-label">Type</div>
          <div class="info-value">${typeLabel}</div>
          ${insp.overall_condition
            ? `<div class="cond-badge" style="background:${conditionBg(insp.overall_condition)};color:${conditionColor(insp.overall_condition)};border:2px solid ${conditionColor(insp.overall_condition)};">${insp.overall_condition.toUpperCase()}</div>`
            : ''}
        </div>
      </div>
      <div class="cover-meta">
        <div class="info-col">
          <div class="info-label">Landlord / Owner</div>
          <div class="info-value">${insp.owner?.full_name || '—'}</div>
          <div class="info-sub">${[insp.owner?.email, insp.owner?.phone].filter(Boolean).join(' | ') || ''}</div>
        </div>
        <div class="info-col">
          <div class="info-label">Tenant</div>
          <div class="info-value">${insp.tenant?.full_name || '—'}</div>
          <div class="info-sub">${[insp.tenant?.email, insp.tenant?.phone].filter(Boolean).join(' | ') || ''}</div>
        </div>
        <div class="info-col">
          <div class="info-label">Rooms Inspected</div>
          <div class="info-value">${rooms.length}</div>
          ${actionItems.length > 0
            ? `<div style="color:#dc2626;font-size:8.5pt;font-weight:700;margin-top:4px;">${actionItems.length} action(s) required</div>`
            : `<div style="color:#16a34a;font-size:8.5pt;font-weight:700;margin-top:4px;">No actions required</div>`}
        </div>
      </div>
    </div>
    <div class="cover-footer">
      This report was prepared in accordance with the Rental Housing Act 50 of 1999. Both parties are entitled to a signed copy.
    </div>
  </div>

  <!-- ACTIONS REQUIRED (only when there are flagged items) -->
  ${actionsSection}

  <!-- ROOM-BY-ROOM SECTIONS -->
  ${roomSections}

  <!-- KEY HANDOVER + GENERAL NOTES -->
  ${keysSection}

  <!-- DECLARATION & SIGNATURES -->
  ${signaturesSection}

  <div class="report-footer">
    Lalarente Property Manager &nbsp;|&nbsp; ${typeLabel} Inspection Report &nbsp;|&nbsp; ${inspDate} &nbsp;|&nbsp; RHA 50 of 1999 Compliant
  </div>

</body>
</html>`;
}

/**
 * Generate and save an inspection report PDF.
 * Fetches inspection data, embeds photos as base64 (gracefully skips missing ones),
 * saves to the documents table with access_level 'both'.
 * Returns the saved document ID.
 */
export async function exportInspectionReportPdf(
  inspectionId: string,
  userId: string,
): Promise<string> {
  // 1. Fetch inspection with all relations
  const { data: insp, error } = await supabase
    .from('inspections')
    .select(`
      id, type, scheduled_date, overall_condition,
      owner_signed_at, tenant_signed_at,
      property_id, lease_id, tenant_id, owner_id,
      rooms,
      property:properties!property_id(title, address, city),
      owner:profiles!owner_id(full_name, email, phone),
      tenant:profiles!tenant_id(full_name, email, phone)
    `)
    .eq('id', inspectionId)
    .single();

  if (error || !insp) throw new Error('Failed to load inspection data');

  // 2. Parse rooms
  const roomsData = insp.rooms as any;
  const roomsList: any[] = roomsData?.rooms || [];
  const keys = roomsData?.keys || { physicalKeys: 0, accessCards: 0, remoteControls: 0 };
  const generalNotes: string = roomsData?.generalNotes || '';

  // 3. Convert photos to base64 (graceful fallback for missing files)
  const processedRooms: RoomReportSection[] = await Promise.all(
    roomsList.map(async (room: any) => {
      const roomPhotos = (await Promise.all(
        (room.photos || []).map((uri: string) => getPhotoBase64(uri))
      )).filter(Boolean) as string[];

      const items = await Promise.all(
        (room.items || []).map(async (item: any) => ({
          name: item.name || '',
          condition: item.condition || 'good',
          notes: item.notes || '',
          photoDataUris: (await Promise.all(
            (item.photos || []).map((uri: string) => getPhotoBase64(uri))
          )).filter(Boolean) as string[],
        }))
      );

      return {
        name: room.name || '',
        overallCondition: room.overallCondition || 'good',
        notes: room.notes || '',
        items,
        photoDataUris: roomPhotos,
      };
    })
  );

  // 4. Build HTML
  const html = buildInspectionReportHtml(
    {
      type: insp.type,
      scheduled_date: insp.scheduled_date,
      overall_condition: insp.overall_condition,
      owner_signed_at: insp.owner_signed_at,
      tenant_signed_at: insp.tenant_signed_at,
      property: insp.property as any,
      owner: insp.owner as any,
      tenant: insp.tenant as any,
    },
    processedRooms,
    keys,
    generalNotes,
  );

  // 5. Generate PDF
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  // 6. Save to documents (both owner and tenant can view)
  const typeLabel =
    insp.type === 'move_in' ? 'Move-In' :
    insp.type === 'move_out' ? 'Move-Out' : 'Periodic';
  const propertyTitle = (insp.property as any)?.title || 'Property';
  const title = `${typeLabel} Inspection Report — ${propertyTitle}`;

  return saveReportToDocuments(uri, 'inspection_report', title, userId, {
    property_id: insp.property_id ?? undefined,
    lease_id: insp.lease_id ?? undefined,
    tenant_id: insp.tenant_id ?? undefined,
    access_level: 'both',
  });
}
