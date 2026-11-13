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
  }
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
    ownerId
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
  properties: PropertyStatementSection[]
): string {
  const today = fmtDate(new Date().toISOString());

  const propertySections = properties
    .map((prop, idx) => {
      const isLast = idx === properties.length - 1;

      // Income & Expenses rows
      const expenseRows = prop.expenseItems
        .map(
          (e) => `
      <tr>
        <td>${fmtDate(e.date)}</td>
        <td>${e.description}</td>
        <td class="right"></td>
        <td class="right">R ${fmtZAR(e.amount)}</td>
      </tr>`
        )
        .join('');

      const totalIncome = prop.rentCollected;
      const totalExpenses = prop.totalExpenses;

      // Invoice rows
      const invoiceRows = prop.invoiceItems
        .map(
          (i) => `
      <tr>
        <td>${fmtDate(i.date)}</td>
        <td>${i.ref}</td>
        <td>${i.description}</td>
        <td class="right">R ${fmtZAR(i.amountExcl)}</td>
        <td class="right">R ${fmtZAR(i.vat)}</td>
        <td class="right">R ${fmtZAR(i.total)}</td>
      </tr>`
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
    })
    .join('');

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
  taxYearLabel: string; // e.g. "2024/2025"
  startDate: string; // "2024-03-01"
  endDate: string; // "2025-02-28"
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

  const breakdownRows = data.propertyBreakdown
    .map(
      (pb) => `
    <tr>
      <td>${pb.propertyTitle}</td>
      <td class="right">R ${fmtZAR(pb.grossIncome)}</td>
      <td class="right">R ${fmtZAR(pb.deductions)}</td>
      <td class="right" style="color: ${pb.net >= 0 ? '#007A4D' : '#DC2626'}; font-weight: 700;">
        R ${fmtZAR(pb.net)}
      </td>
    </tr>`
    )
    .join('');

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
    ${
      data.propertyBreakdown.length > 0
        ? `
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
    `
        : ''
    }

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
  year: number
): Promise<string> {
  const monthStart = new Date(year, month, 1).toISOString();
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
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
    .select(
      `
      id, monthly_rent, end_date, deposit_amount,
      properties!leases_property_id_fkey(id, title, address, city),
      profiles!leases_tenant_id_fkey(full_name)
    `
    )
    .eq('owner_id', ownerId)
    .in('status', ['active', 'signed']);

  if (!leases?.length) {
    throw new Error('No active leases found for this period.');
  }

  const propertyIds = leases.map((l) => (l as any).properties?.id).filter(Boolean);

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

  let posByProperty: Record<
    string,
    { date: string; ref: string; description: string; amount: number }[]
  > = {};

  if (maintenanceRequests?.length) {
    const requestIds = maintenanceRequests.map((r) => r.id);
    const reqPropertyMap: Record<string, string> = {};
    const reqDescMap: Record<string, string> = {};
    maintenanceRequests.forEach((r) => {
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
      const contractIds = contracts.map((c) => c.id);
      const contractReqMap: Record<string, string> = {};
      contracts.forEach((c) => {
        if (c.id) contractReqMap[c.id] = c.maintenance_request_id || '';
      });

      const { data: pos } = await supabase
        .from('purchase_orders')
        .select('id, contract_id, total_amount, created_at')
        .in('contract_id', contractIds)
        .in('status', ['paid', 'completed'])
        .gte('created_at', monthStart)
        .lte('created_at', monthEnd);

      pos?.forEach((po) => {
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
  const propertySections: PropertyStatementSection[] = leases.map((lease) => {
    const prop = (lease as any).properties;
    const tenant = (lease as any).profiles;
    const propId = prop?.id || '';

    const propAddress = [prop?.address, prop?.city].filter(Boolean).join(', ') || 'Address not set';

    const rentCollected = (payments || [])
      .filter((p) => p.property_id === propId)
      .reduce((s, p) => s + (p.amount || 0), 0);

    const depositBalance = (lease as any).deposit_amount || 0;

    const pos = posByProperty[propId] || [];
    const totalExpenses = pos.reduce((s, po) => s + po.amount, 0);

    const rentBilled = lease.monthly_rent || 0;
    const tenantOutstanding = Math.max(0, rentBilled - rentCollected);

    const expenseItems: ExpenseItem[] = pos.map((po) => ({
      date: po.date,
      description: po.description,
      amount: po.amount,
    }));

    const invoiceItems: InvoiceItem[] = pos.map((po) => ({
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
  ownerId: string
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
  vendorInvoices: VendorInvoiceRow[]
): string {
  const today = fmtDate(new Date().toISOString());
  const isRent = tab === 'rent';

  const title = isRent ? 'Rent Invoices' : 'Vendor Invoices';
  const total = isRent
    ? rentInvoices.filter((i) => i.status === 'completed').reduce((s, i) => s + i.amount, 0)
    : vendorInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);

  const rows = isRent
    ? rentInvoices
        .map(
          (i) => `
      <tr>
        <td>${i.tenant_name}</td>
        <td>${i.property_title}</td>
        <td>${fmtDate(i.due_date)}</td>
        <td>${i.paid_date ? fmtDate(i.paid_date) : '—'}</td>
        <td class="right"><strong>R ${fmtZAR(i.amount)}</strong></td>
        <td style="text-align:center;">
          <span style="background:${i.status === 'completed' ? '#dcfce7' : '#fef9c3'};color:${i.status === 'completed' ? '#166534' : '#854d0e'};padding:2px 8px;border-radius:4px;font-size:8.5pt;">${i.status}</span>
        </td>
      </tr>`
        )
        .join('')
    : vendorInvoices
        .map(
          (po) => `
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
      </tr>`
        )
        .join('');

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
      ${
        (isRent ? rentInvoices.length : vendorInvoices.length) === 0
          ? '<p style="font-size:9pt;color:#888;padding:8px 0;">No invoices to display.</p>'
          : `<table><thead>${thead}</thead><tbody>${rows}</tbody></table>`
      }
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
  invoice: RentInvoiceRow
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
  po: VendorInvoiceRow
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
  vendorInvoices: VendorInvoiceRow[]
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
// Layout follows the client's move-in inspection template
// (docs/106 - Flats Cerise … Move In Inspection … FULL.pdf): cover with lead
// photo, contents, actions required (+ photos), per-area tables with Ref x.y,
// photo grids captioned "Ref #x.y", keys, declaration, signatures, appendix
// (comment summary + status overview).
// One deliberate difference: the app records ONE condition per item, so the
// table shows that condition instead of inventing Clean/Undamaged/Working.

interface ReportItem {
  name: string;
  condition: string;
  notes: string;
  photoDataUris: string[];
}

interface RoomReportSection {
  name: string;
  overallCondition: string;
  notes: string;
  items: ReportItem[];
  photoDataUris: string[];
}

const CONDITION_LABEL: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  damaged: 'Damaged',
};

function conditionColor(c: string): string {
  const m: Record<string, string> = {
    excellent: '#3E8E41',
    good: '#6AA84F',
    fair: '#B7950B',
    poor: '#E07B00',
    damaged: '#CC0000',
  };
  return m[c] || '#6B7280';
}

const escHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Turns a photo/signature reference into an embeddable data URI. Remote files
 * are downloaded first — expo-print does not reliably wait for remote <img>s,
 * so linked photos went missing from the PDF. Returns null when unavailable
 * (e.g. an old file:// path from another device).
 */
async function toDataUri(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  try {
    let local = uri;
    if (/^https?:\/\//.test(uri)) {
      const target = `${FileSystem.cacheDirectory}pdf-${Math.random().toString(36).slice(2)}`;
      const res = await FileSystem.downloadAsync(uri, target);
      if (res.status >= 400) return null;
      local = res.uri;
    }
    const base64 = await FileSystem.readAsStringAsync(local, { encoding: 'base64' as any });
    const mime = /\.png(\?|$)/i.test(uri) ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

/** Signatures live in the private `signatures` bucket — sign the URL first. */
async function signatureDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const m = /\/signatures\/(.+?)(\?|$)/.exec(url);
  if (!m) return toDataUri(url);
  const { data } = await supabase.storage.from('signatures').createSignedUrl(m[1], 300);
  return toDataUri(data?.signedUrl ?? url);
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface InspectionReportInput {
  type: string;
  scheduled_date: string;
  completed_date: string | null;
  overall_condition: string | null;
  owner_signed_at: string | null;
  tenant_signed_at: string | null;
  property: { title: string; address: string | null; city: string | null } | null;
  owner: { full_name: string; email: string | null; phone: string | null } | null;
  tenant: { full_name: string; email: string | null; phone: string | null } | null;
  coverPhoto: string | null;
  ownerSignature: string | null;
  tenantSignature: string | null;
}

function buildInspectionReportHtml(
  insp: InspectionReportInput,
  rooms: RoomReportSection[],
  keys: { physicalKeys: number; accessCards: number; remoteControls: number },
  generalNotes: string,
  tenantComments: { room: string; text: string; createdAt: string }[] = []
): string {
  const typeLabel =
    insp.type === 'move_in' ? 'Move In' : insp.type === 'move_out' ? 'Move Out' : 'Periodic';
  // Who usually fixes defects found: landlord at move-in, tenant at move-out.
  const responsibility =
    insp.type === 'move_in' ? 'Landlord' : insp.type === 'move_out' ? 'Tenant' : 'Investigate';
  const address =
    [insp.property?.title, insp.property?.address, insp.property?.city]
      .filter(Boolean)
      .map((v) => escHtml(String(v).trim()))
      .join(', ') || '—';
  const inspDateTime = fmtDateTime(insp.completed_date || insp.scheduled_date);
  const photoStamp = fmtDateTime(insp.completed_date || insp.scheduled_date);

  // Ref numbering like the template: area n, items n.1, n.2 …
  const numbered = rooms.map((room, r) => ({
    ...room,
    ref: `${r + 1}`,
    items: room.items.map((item, i) => ({ ...item, ref: `${r + 1}.${i + 1}` })),
    comments: tenantComments.filter((c) => c.room === room.name),
  }));

  const actions = numbered.flatMap((room) =>
    room.items
      .filter((item) => item.condition === 'poor' || item.condition === 'damaged')
      .map((item) => ({ ...item, room: room.name }))
  );

  const photoGrid = (photos: { uri: string; ref: string }[]) =>
    photos.length === 0
      ? ''
      : `<div class="photo-grid">${photos
          .map(
            (p) => `<div class="photo-cell">
              <div class="photo-frame"><img src="${p.uri}" /><span class="stamp">${photoStamp}</span></div>
              <div class="photo-ref">Ref #${p.ref}</div>
            </div>`
          )
          .join('')}</div>`;

  const bar = `<div class="running">${address}</div>`;

  // Contents
  const contents = `<div class="page">
    ${bar}
    <div class="box-title">Contents</div>
    <div class="toc">
      ${actions.length ? '<div class="toc-row">Actions</div>' : ''}
      <div class="toc-row">Areas</div>
      ${numbered.map((r) => `<div class="toc-row sub">${r.ref}. ${escHtml(r.name)}</div>`).join('')}
      <div class="toc-row">Keys</div>
      <div class="toc-row">Declaration</div>
      <div class="toc-row">Appendix</div>
      <div class="toc-row sub">Comment Summary</div>
      <div class="toc-row sub">Status Overview</div>
    </div>
  </div>`;

  // Actions required
  const actionsSection = actions.length
    ? `<div class="page">
      ${bar}
      <table class="grid">
        <thead>
          <tr><th colspan="5" class="table-title">Actions Required</th></tr>
          <tr><th style="width:26%">Ref</th><th style="width:15%">Action Required</th><th style="width:14%">Responsibility</th><th>Comments</th><th style="width:10%">Price</th></tr>
        </thead>
        <tbody>
          ${actions
            .map(
              (a) => `<tr>
                <td><span class="ref-link">${a.ref}</span> ${escHtml(a.room)} » ${escHtml(a.name)}</td>
                <td>${a.condition === 'damaged' ? 'Repair / Replace' : 'Needs Maintenance'}</td>
                <td>${responsibility}</td>
                <td>${escHtml(a.notes || '')}</td>
                <td></td>
              </tr>`
            )
            .join('')}
          <tr class="total"><td colspan="4">Total</td><td>R 0,00</td></tr>
        </tbody>
      </table>
      ${photoGrid(actions.flatMap((a) => a.photoDataUris.map((uri) => ({ uri, ref: a.ref }))))}
    </div>`
    : '';

  // Areas
  const areas = numbered
    .map((room) => {
      const rows = room.items
        .map(
          (item) => `<tr>
            <td class="ref">${item.ref}</td>
            <td>${escHtml(item.name)}</td>
            <td><span style="color:${conditionColor(item.condition)};font-weight:700;">${
              CONDITION_LABEL[item.condition] || escHtml(item.condition || '—')
            }</span></td>
            <td>${escHtml(item.notes || '')}</td>
          </tr>`
        )
        .join('');
      const photos = [
        ...room.photoDataUris.map((uri) => ({ uri, ref: room.ref })),
        ...room.items.flatMap((item) => item.photoDataUris.map((uri) => ({ uri, ref: item.ref }))),
      ];
      const extra = [
        room.notes
          ? `<div class="note"><strong>Area notes:</strong> ${escHtml(room.notes)}</div>`
          : '',
        room.comments.length
          ? `<div class="note"><strong>Tenant comments:</strong><ul>${room.comments
              .map(
                (c) =>
                  `<li>${escHtml(c.text)} <span class="muted">(${fmtDate(c.createdAt)})</span></li>`
              )
              .join('')}</ul></div>`
          : '',
      ].join('');
      return `<div class="page">
        ${bar}
        <table class="grid">
          <thead>
            <tr><th colspan="4" class="table-title">${room.ref}. ${escHtml(room.name.toUpperCase())}
              <span class="area-cond" style="color:${conditionColor(room.overallCondition)}">${
                CONDITION_LABEL[room.overallCondition] || ''
              }</span></th></tr>
            <tr><th style="width:7%">Ref</th><th style="width:25%">Name</th><th style="width:16%">Condition</th><th>Comments</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${extra}
        ${photoGrid(photos)}
      </div>`;
    })
    .join('');

  // Keys
  const keysRef = numbered.length + 1;
  const keysSection = `<table class="grid keys">
    <thead>
      <tr><th colspan="3" class="table-title">${keysRef}. KEYS</th></tr>
      <tr><th style="width:7%">Ref</th><th style="width:40%">Name</th><th>Quantity</th></tr>
    </thead>
    <tbody>
      <tr><td class="ref">${keysRef}.1</td><td>House keys</td><td>${keys.physicalKeys}</td></tr>
      <tr><td class="ref">${keysRef}.2</td><td>Access cards / tags</td><td>${keys.accessCards}</td></tr>
      <tr><td class="ref">${keysRef}.3</td><td>Remotes</td><td>${keys.remoteControls}</td></tr>
    </tbody>
  </table>
  ${generalNotes ? `<div class="note"><strong>General notes:</strong> ${escHtml(generalNotes)}</div>` : ''}`;

  const sigBox = (
    who: string,
    name: string | undefined,
    signedAt: string | null,
    image: string | null
  ) => `<div class="sig-box">
      <div class="sig-who">Signed by the ${who}</div>
      ${
        signedAt
          ? `${image ? `<img class="sig-img" src="${image}" />` : '<div class="sig-img-missing">Signed electronically</div>'}
             <div class="sig-name">${escHtml((name || '').toUpperCase())}</div>
             <div class="sig-date">${fmtDateTime(signedAt)}</div>`
          : `<div class="sig-line">Signatures</div><div class="sig-line">Print Name</div><div class="sig-line">Date &nbsp;&nbsp;&nbsp; / &nbsp;&nbsp;&nbsp; /</div>`
      }
    </div>`;

  const declaration = `<div class="page">
    ${bar}
    ${keysSection}
    <div class="box-title">Declaration</div>
    <p class="declaration">I/We the undersigned, affirm that if I/we do not comment on the Inspection in writing
    within seven days of receipt of this Inspection then I/we accept the Inspection as being an accurate record
    of the contents and condition of the property.</p>
    <p class="declaration muted">Completed in accordance with the Rental Housing Act 50 of 1999, section 5(3)(e)–(f).
    Both parties are entitled to a signed copy of this report.</p>
    ${sigBox('Tenant', insp.tenant?.full_name, insp.tenant_signed_at, insp.tenantSignature)}
    ${sigBox('Landlord', insp.owner?.full_name, insp.owner_signed_at, insp.ownerSignature)}
  </div>`;

  // Appendix
  const commentRows = [
    ...numbered.flatMap((room) =>
      room.items
        .filter((i) => i.notes)
        .map((i) => ({ ref: i.ref, text: `${room.name} » ${i.name}: ${i.notes}` }))
    ),
    ...numbered.flatMap((room) =>
      room.comments.map((c) => ({ ref: room.ref, text: `Tenant (${room.name}): ${c.text}` }))
    ),
  ];
  const appendix = `<div class="page">
    ${bar}
    <div class="box-title">Appendix</div>
    <table class="grid">
      <thead><tr><th colspan="2" class="table-title">Comment Summary</th></tr>
      <tr><th style="width:12%">Ref</th><th>Comments</th></tr></thead>
      <tbody>${
        commentRows.length
          ? commentRows
              .map((c) => `<tr><td class="ref">${c.ref}</td><td>${escHtml(c.text)}</td></tr>`)
              .join('')
          : '<tr><td colspan="2" class="muted">No comments recorded.</td></tr>'
      }</tbody>
    </table>
    <table class="grid">
      <thead><tr><th colspan="5" class="table-title">Status Overview</th></tr>
      <tr><th style="width:8%">Ref</th><th>Area</th><th style="width:14%">Items</th><th style="width:18%">Needs attention</th><th style="width:12%">Photos</th></tr></thead>
      <tbody>${numbered
        .map((r) => {
          const flagged = r.items.filter(
            (i) => i.condition === 'poor' || i.condition === 'damaged'
          ).length;
          const photos =
            r.photoDataUris.length + r.items.reduce((n, i) => n + i.photoDataUris.length, 0);
          return `<tr><td class="ref">${r.ref}</td><td>${escHtml(r.name)}</td><td>${r.items.length}</td>
            <td style="color:${flagged ? '#CC0000' : '#3E8E41'}">${flagged}</td><td>${photos}</td></tr>`;
        })
        .join('')}</tbody>
    </table>
  </div>`;

  const CSS = `
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #333; background: #fff; }
    .page { page-break-after: always; padding: 8px 4px; }
    .page:last-child { page-break-after: auto; }
    .running { font-size: 8pt; color: #777; margin-bottom: 12px; }
    .cover { text-align: center; page-break-after: always; padding-top: 12px; }
    .cover-photo { width: 78%; height: 330px; object-fit: cover; display: block; margin: 0 auto 26px; }
    .cover-title { font-size: 21pt; font-weight: 700; color: #444; margin-bottom: 22px; }
    .cover-address { font-size: 11pt; color: #444; margin-bottom: 22px; }
    .cover-date { font-size: 11pt; font-weight: 700; color: #444; margin-bottom: 4px; }
    .cover-by { font-size: 11pt; color: #444; }
    .cover-brand { margin-top: 160px; font-size: 9pt; color: #777; letter-spacing: 1px; }
    .box-title { background: #F3F4F8; border: 1px solid #E5E7EB; padding: 10px 12px; font-size: 13pt; font-weight: 700; color: #444; margin: 14px 0 12px; }
    .toc-row { padding: 6px 4px; border-bottom: 1px dotted #ccc; }
    .toc-row.sub { padding-left: 22px; }
    table.grid { width: 100%; border-collapse: collapse; margin-bottom: 14px; border: 1px solid #E5E7EB; }
    table.grid th { background: #F7F8FB; color: #555; font-weight: 700; text-align: left; padding: 8px; font-size: 9pt; border-bottom: 1px solid #E5E7EB; }
    table.grid th.table-title { font-size: 9.5pt; color: #333; }
    table.grid td { padding: 9px 8px; vertical-align: top; border-bottom: 1px solid #F0F0F3; }
    table.grid tbody tr:nth-child(odd) { background: #FBFBFD; }
    td.ref { font-weight: 700; font-size: 8pt; color: #555; }
    .ref-link { color: #1A0DAB; text-decoration: underline; }
    tr.total td { font-weight: 700; }
    .area-cond { float: right; font-size: 9pt; }
    .note { background: #F7F8FB; border-left: 3px solid #C9CDD6; padding: 8px 10px; margin: -6px 0 12px; font-size: 9pt; }
    .note ul { margin: 4px 0 0 16px; }
    .muted { color: #888; }
    .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
    .photo-cell { width: calc(33.333% - 6px); background: #F7F8FB; padding: 0 0 6px; text-align: center; page-break-inside: avoid; }
    .photo-frame { position: relative; }
    .photo-frame img { width: 100%; height: 180px; object-fit: cover; display: block; }
    .stamp { position: absolute; right: 4px; bottom: 4px; background: #000; color: #fff; font-size: 7pt; font-style: italic; padding: 2px 4px; }
    .photo-ref { font-size: 8.5pt; font-style: italic; color: #555; margin-top: 4px; }
    .declaration { font-size: 9pt; line-height: 1.5; margin-bottom: 12px; }
    .sig-box { border: 1px solid #C9CDD6; padding: 12px; margin-bottom: 14px; page-break-inside: avoid; }
    .sig-who { font-style: italic; margin-bottom: 8px; }
    .sig-img { height: 70px; max-width: 260px; object-fit: contain; display: block; margin: 6px 0; }
    .sig-img-missing { color: #3E8E41; font-weight: 700; margin: 10px 0; }
    .sig-name { margin-top: 8px; }
    .sig-date { margin-top: 6px; color: #555; }
    .sig-line { border-bottom: 1px dotted #bbb; padding: 7px 0; color: #555; }
  `;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><style>${CSS}</style></head><body>
  <div class="cover">
    ${insp.coverPhoto ? `<img class="cover-photo" src="${insp.coverPhoto}" />` : ''}
    <div class="cover-title">${typeLabel} Inspection</div>
    <div class="cover-address">${address}</div>
    <div class="cover-date">${inspDateTime}</div>
    <div class="cover-by">Prepared By ${escHtml(insp.owner?.full_name || '—')}</div>
    <div class="cover-brand">Property report created with Lalarente</div>
  </div>
  ${contents}
  ${actionsSection}
  ${areas}
  ${declaration}
  ${appendix}
  </body></html>`;
}

/**
 * Generate and save an inspection report PDF (both owner and tenant can view).
 * Returns the saved document ID.
 */
export async function exportInspectionReportPdf(
  inspectionId: string,
  userId: string
): Promise<string> {
  const { data: insp, error } = await supabase
    .from('inspections')
    .select(
      `
      id, type, scheduled_date, completed_date, overall_condition,
      owner_signed_at, tenant_signed_at, owner_signature_url, tenant_signature_url,
      property_id, lease_id, tenant_id, owner_id,
      rooms,
      property:properties!property_id(title, address, city, images),
      owner:profiles!owner_id(full_name, email, phone),
      tenant:profiles!tenant_id(full_name, email, phone)
    `
    )
    .eq('id', inspectionId)
    .single();

  if (error || !insp) throw new Error('Failed to load inspection data');

  const roomsData = insp.rooms as any;
  const roomsList: any[] = roomsData?.rooms || [];
  const keys = roomsData?.keys || { physicalKeys: 0, accessCards: 0, remoteControls: 0 };
  const generalNotes: string = roomsData?.generalNotes || '';
  const tenantComments = Array.isArray(roomsData?.tenantComments) ? roomsData.tenantComments : [];

  const embedAll = async (uris: string[] | undefined) =>
    (await Promise.all((uris || []).map((u) => toDataUri(u)))).filter(Boolean) as string[];

  const processedRooms: RoomReportSection[] = await Promise.all(
    roomsList.map(async (room: any) => ({
      name: room.name || '',
      overallCondition: room.overallCondition || 'good',
      notes: room.notes || '',
      photoDataUris: await embedAll(room.photos),
      items: await Promise.all(
        (room.items || []).map(async (item: any) => ({
          name: item.name || '',
          condition: item.condition || 'good',
          notes: item.notes || '',
          photoDataUris: await embedAll(item.photos),
        }))
      ),
    }))
  );

  const property = insp.property as any;
  const firstRoomPhoto = processedRooms.find((r) => r.photoDataUris.length)?.photoDataUris[0];
  const [listingCover, ownerSignature, tenantSignature] = await Promise.all([
    toDataUri(Array.isArray(property?.images) ? property.images[0] : null),
    signatureDataUri((insp as any).owner_signature_url),
    signatureDataUri((insp as any).tenant_signature_url),
  ]);

  const html = buildInspectionReportHtml(
    {
      type: insp.type,
      scheduled_date: insp.scheduled_date,
      completed_date: (insp as any).completed_date ?? null,
      overall_condition: insp.overall_condition,
      owner_signed_at: insp.owner_signed_at,
      tenant_signed_at: insp.tenant_signed_at,
      property,
      owner: insp.owner as any,
      tenant: insp.tenant as any,
      coverPhoto: listingCover || firstRoomPhoto || null,
      ownerSignature,
      tenantSignature,
    },
    processedRooms,
    keys,
    generalNotes,
    tenantComments
  );

  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const typeLabel =
    insp.type === 'move_in' ? 'Move-In' : insp.type === 'move_out' ? 'Move-Out' : 'Periodic';
  const propertyTitle = property?.title || 'Property';
  const title = `${typeLabel} Inspection Report — ${propertyTitle}`;

  return saveReportToDocuments(uri, 'inspection_report', title, userId, {
    property_id: insp.property_id ?? undefined,
    lease_id: insp.lease_id ?? undefined,
    tenant_id: insp.tenant_id ?? undefined,
    access_level: 'both',
  });
}
