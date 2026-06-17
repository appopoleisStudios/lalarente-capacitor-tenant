import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { uploadLeasePDF } from './storageService';

export interface LeaseData {
  id: string;
  property: {
    title: string;
    address: string;
    city: string;
    province?: string;
    postal_code?: string;
  };
  owner: {
    full_name: string;
    id_number?: string;
    email?: string;
    phone?: string;
  };
  tenant: {
    full_name: string;
    email?: string;
    phone?: string;
    id_number?: string;
    date_of_birth?: string;
  };
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number | null;
  payment_due_day: number | null;
  lease_type: string | null;
  late_fee_amount?: number | null;
  late_fee_grace_days?: number | null;
  interest_on_arrears_rate?: number | null;
  rent_escalation_type: string | null;
  rent_escalation_value: number | null;
  rent_escalation_frequency_months: number | null;
  owner_signature_url: string | null;
  tenant_signature_url: string | null;
  owner_signed_at: string | null;
  tenant_signed_at: string | null;
  executed_at: string | null;
  // Agent / managing agency fields (optional)
  agent_name?: string;
  agent_phone?: string;
  agent_email?: string;
  agent_ffc?: string;
  agency_name?: string;
  agency_reg_no?: string;
  agency_ffc?: string;
  agency_vat?: string;
}

function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getDaySuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

export function generateLeaseHTML(lease: LeaseData): string {
  const leaseTypeDisplay = lease.lease_type === 'fixed' ? 'Fixed Term' : 'Month-to-Month';
  const escalationType = lease.rent_escalation_type === 'percentage' ? '%' : ' (Fixed)';
  const escalationValue = lease.rent_escalation_value || 0;
  const escalationFrequency = lease.rent_escalation_frequency_months || 12;
  const interestRate = lease.interest_on_arrears_rate; // from lease terms, undefined if not set
  const dueDay = lease.payment_due_day || 1;
  const dueDaySuffix = getDaySuffix(dueDay);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Residential Lease Agreement</title>
<style>
  @page { margin: 30px 40px; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: #222;
    padding: 30px 40px;
  }
  .header {
    text-align: center;
    border-bottom: 3px solid #002395;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .header h1 {
    color: #002395;
    font-size: 20pt;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .header .subtitle {
    color: #555;
    font-size: 9pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }
  .header p { color: #777; font-size: 9pt; }
  .section { margin-bottom: 22px; page-break-inside: avoid; }
  .section-title {
    background: #f0f2f5;
    padding: 8px 14px;
    border-left: 4px solid #002395;
    font-size: 12pt;
    font-weight: 700;
    color: #002395;
    margin-bottom: 12px;
  }
  .schedule-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .schedule-table td {
    padding: 6px 10px;
    border: 1px solid #ddd;
    vertical-align: top;
    font-size: 10pt;
  }
  .schedule-table .label {
    font-weight: 700;
    color: #555;
    width: 180px;
    background: #fafafa;
  }
  .schedule-table .value { color: #222; }
  .schedule-table .section-header td {
    background: #002395;
    color: #fff;
    font-weight: 700;
    font-size: 10pt;
    padding: 8px 10px;
  }
  .info-block {
    background: #fafafa;
    padding: 12px 14px;
    border-radius: 4px;
    margin-bottom: 10px;
    border: 1px solid #eee;
  }
  .info-block h3 {
    color: #002395;
    font-size: 11pt;
    font-weight: 700;
    margin-bottom: 6px;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 6px;
  }
  .info-row { display: flex; padding: 3px 0; }
  .info-label { font-weight: 600; color: #555; width: 160px; font-size: 10pt; }
  .info-value { color: #222; font-size: 10pt; }
  .terms-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
  .term-box {
    background: #f9f9f9;
    padding: 10px;
    border-radius: 4px;
    border: 1px solid #e0e0e0;
  }
  .term-label { font-size: 8pt; color: #777; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
  .term-value { font-size: 11pt; color: #002395; font-weight: 700; }
  .utilities-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .utilities-table th {
    background: #002395;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-size: 10pt;
  }
  .utilities-table td {
    padding: 6px 10px;
    border: 1px solid #ddd;
    font-size: 10pt;
  }
  .utilities-table tr:nth-child(even) { background: #f9f9f9; }
  .clause { margin-bottom: 12px; }
  .clause-number { font-weight: 700; color: #002395; font-size: 10pt; margin-bottom: 3px; }
  .clause-text { text-align: justify; line-height: 1.6; font-size: 10pt; color: #333; }
  .signatures { margin-top: 40px; page-break-inside: avoid; }
  .signature-row { display: flex; justify-content: space-between; margin-top: 30px; gap: 40px; }
  .signature-box { flex: 1; }
  .signature-image {
    border: 2px solid #002395;
    border-radius: 4px;
    padding: 10px;
    background: white;
    height: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .signature-image img { max-width: 100%; max-height: 70px; }
  .signature-line { border-top: 2px solid #333; padding-top: 5px; text-align: center; }
  .signature-name { font-weight: 700; color: #002395; font-size: 10pt; }
  .signature-date { font-size: 8pt; color: #888; }
  .footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 2px solid #e0e0e0;
    text-align: center;
    font-size: 8pt;
    color: #999;
  }
  .section-break { page-break-before: auto; margin-top: 22px; }
</style>
</head>
<body>

<div class="header">
  <div class="subtitle">LaLarente &mdash; Powered by Unicity Integrated Realty</div>
  <h1>RESIDENTIAL MANAGEMENT LEASE AGREEMENT</h1>
  <p>Lease ID: ${lease.id} &nbsp;|&nbsp; Generated: ${new Date().toISOString().split('T')[0]}</p>
</div>

<div class="section">
  <div class="section-title">THE SCHEDULE</div>
  <p style="margin-bottom:10px;font-size:10pt;color:#555;">
    The LANDLORD hereby lets to the TENANT/S who rents the PREMISES on the terms and conditions as set out in this AGREEMENT OF LEASE.
  </p>

  <table class="schedule-table">
    <tr><td class="section-header" colspan="2">1. LANDLORD DETAILS</td></tr>
    <tr><td class="label">Full name/s</td><td class="value">${lease.owner.full_name}</td></tr>
    ${lease.owner.id_number ? `<tr><td class="label">ID / Registration number</td><td class="value">${lease.owner.id_number}</td></tr>` : ''}
    ${lease.owner.email ? `<tr><td class="label">Email</td><td class="value">${lease.owner.email}</td></tr>` : ''}
    ${lease.owner.phone ? `<tr><td class="label">Phone</td><td class="value">${lease.owner.phone}</td></tr>` : ''}

    ${lease.agency_name || lease.agent_name ? `
    <tr><td class="section-header" colspan="2">2. MANAGING AGENT</td></tr>
    ${lease.agency_name ? `<tr><td class="label">Agency</td><td class="value">${lease.agency_name}</td></tr>` : ''}
    ${lease.agency_reg_no ? `<tr><td class="label">Reg. No.</td><td class="value">${lease.agency_reg_no}</td></tr>` : ''}
    ${lease.agency_ffc ? `<tr><td class="label">FFC</td><td class="value">${lease.agency_ffc}</td></tr>` : ''}
    ${lease.agent_name ? `<tr><td class="label">Agent</td><td class="value">${lease.agent_name}</td></tr>` : ''}
    ${lease.agent_phone ? `<tr><td class="label">Agent Phone</td><td class="value">${lease.agent_phone}</td></tr>` : ''}
    ${lease.agent_email ? `<tr><td class="label">Agent Email</td><td class="value">${lease.agent_email}</td></tr>` : ''}
    ` : ''}

    <tr><td class="section-header" colspan="2">3. TENANT DETAILS</td></tr>
    <tr><td class="label">Full name</td><td class="value">${lease.tenant.full_name}</td></tr>
    ${lease.tenant.id_number ? `<tr><td class="label">ID / Passport number</td><td class="value">${lease.tenant.id_number}</td></tr>` : ''}
    ${lease.tenant.date_of_birth ? `<tr><td class="label">Date of birth</td><td class="value">${formatDate(lease.tenant.date_of_birth)}</td></tr>` : ''}
    ${lease.tenant.email ? `<tr><td class="label">Email</td><td class="value">${lease.tenant.email}</td></tr>` : ''}
    ${lease.tenant.phone ? `<tr><td class="label">Phone</td><td class="value">${lease.tenant.phone}</td></tr>` : ''}

    <tr><td class="section-header" colspan="2">4. PREMISES</td></tr>
    <tr><td class="label">Property</td><td class="value">${lease.property.title}</td></tr>
    <tr><td class="label">Address</td><td class="value">${lease.property.address}, ${lease.property.city}${lease.property.province ? `, ${lease.property.province}` : ''}${lease.property.postal_code ? `, ${lease.property.postal_code}` : ''}</td></tr>

    <tr><td class="section-header" colspan="2">5. FINANCIAL TERMS</td></tr>
    <tr><td class="label">Monthly Rental</td><td class="value">${formatCurrency(lease.monthly_rent)}</td></tr>
    <tr><td class="label">Payment due day</td><td class="value">The ${dueDay}${dueDaySuffix} day of each month</td></tr>
    <tr><td class="label">Lease Type</td><td class="value">${leaseTypeDisplay}</td></tr>
    <tr><td class="label">Lease Period</td><td class="value">${formatDate(lease.start_date)} to ${formatDate(lease.end_date)}</td></tr>
    ${lease.deposit_amount ? `<tr><td class="label">Security Deposit</td><td class="value">${formatCurrency(lease.deposit_amount)}</td></tr>` : ''}
    ${lease.rent_escalation_type ? `<tr><td class="label">Annual Escalation</td><td class="value">${escalationValue}${escalationType} every ${escalationFrequency} months</td></tr>` : ''}
    ${interestRate ? `<tr><td class="label">Interest on arrears</td><td class="value">${interestRate}% per annum (prime + 2%)</td></tr>` : ''}
  </table>
</div>

<div class="section-break"></div>

<div class="section">
  <div class="section-title">Financial Terms &amp; Conditions</div>

  <div class="clause">
    <div class="clause-number">1. RENTAL PAYMENT</div>
    <div class="clause-text">
      The Tenant agrees to pay the monthly rental of ${formatCurrency(lease.monthly_rent)} in advance on or before the ${dueDay}${dueDaySuffix} day of each month without any deduction or set-off whatsoever. Payment shall be made via the designated payment method in the LaLarente application or as otherwise directed by the Landlord or Agent. The first payment shall be made on or before the commencement date of this lease.
    </div>
  </div>

  ${lease.deposit_amount ? `
  <div class="clause">
    <div class="clause-number">2. SECURITY DEPOSIT</div>
    <div class="clause-text">
      The Tenant has paid a security deposit of ${formatCurrency(lease.deposit_amount)}. The deposit shall be held by the Landlord / Agent in trust in terms of the Rental Housing Act. The deposit will be invested in an interest-bearing account and interest accrued will be paid to the Tenant upon termination of this lease, subject to any lawful deductions for damages, arrears, or breach beyond normal wear and tear. The deposit may not be used for the final month's rental.
    </div>
  </div>` : ''}

  ${interestRate ? `
  <div class="clause">
    <div class="clause-number">${lease.deposit_amount ? '3' : '2'}. INTEREST ON ARREARS</div>
    <div class="clause-text">
      Should the Tenant fail to pay the full monthly rental on or before the due date, interest at a rate of ${interestRate}% per annum (being 2% above the prime lending rate) will be charged on arrears from the due date until the date of full payment, calculated daily and capitalised monthly.
    </div>
  </div>` : ''}

  ${lease.rent_escalation_type ? `
  <div class="clause">
    <div class="clause-number">${lease.deposit_amount ? '4' : '3'}. RENT ESCALATION</div>
    <div class="clause-text">
      The monthly rental shall escalate by ${escalationValue}${escalationType} every ${escalationFrequency} months, effective from the lease start date. The escalated rental amount will be communicated to the Tenant in writing no less than 30 days prior to the escalation date.
    </div>
  </div>` : ''}

  ${lease.late_fee_amount ? `
  <div class="clause">
    <div class="clause-number">${lease.rent_escalation_type ? '5' : '4'}. LATE PAYMENT FEE</div>
    <div class="clause-text">
      If the rental is not received within ${lease.late_fee_grace_days || 3} days of the due date, a late payment administration fee of ${formatCurrency(lease.late_fee_amount)} will be charged.
    </div>
  </div>` : ''}
</div>

<div class="section">
  <div class="section-title">Utilities &amp; Municipal Services</div>

  <table class="utilities-table">
    <tr>
      <th>Service</th>
      <th>Responsibility</th>
      <th>Paid To</th>
    </tr>
    <tr><td>Electricity</td><td>Tenant</td><td>Municipality / Pre-paid</td></tr>
    <tr><td>Water &amp; Sewerage</td><td>Tenant</td><td>Municipality</td></tr>
    <tr><td>Refuse Removal</td><td>Tenant</td><td>Municipality</td></tr>
    <tr><td>Security / Levies (if applicable)</td><td>Landlord</td><td>Body Corporate / Estate</td></tr>
  </table>
  <p style="font-size:9pt;color:#666;margin-top:6px;">
    Where the property is equipped with a pre-paid electricity meter, the Tenant shall be responsible for purchasing electricity tokens directly. Water and other municipal accounts in the Tenant's name shall be paid directly to the relevant authority. The Tenant indemnifies the Landlord against any claims arising from non-payment of municipal services.
  </p>
</div>

<div class="section-break"></div>

<div class="section">
  <div class="section-title">General Terms &amp; Conditions</div>

  <div class="clause">
    <div class="clause-number">USE OF THE PREMISES</div>
    <div class="clause-text">
      The Tenant shall use the property solely as a private residence and for no other purpose whatsoever without the Landlord's prior written consent. The Tenant shall not carry on any business, trade, or profession from the premises. The Tenant shall comply with all body corporate or homeowners' association rules and regulations.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">MAINTENANCE AND REPAIRS</div>
    <div class="clause-text">
      The Tenant agrees to maintain the premises in a good and clean condition and to report any defects or maintenance issues promptly through the LaLarente application. The Landlord shall be responsible for structural maintenance and major repairs. The Tenant shall be responsible for routine maintenance including light bulbs, fuses, and garden upkeep (where applicable). The Tenant shall not make any alterations or additions to the premises without the Landlord's written consent.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">INSPECTIONS</div>
    <div class="clause-text">
      A joint ingoing inspection shall be conducted prior to the Tenant taking occupation, and a joint outgoing inspection shall be conducted upon termination of this lease. Both parties shall sign the inspection reports. The Tenant shall allow the Landlord or Agent reasonable access to the premises for inspection purposes, subject to 24 hours' notice except in emergencies.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">PETS</div>
    <div class="clause-text">
      No pets shall be kept on the premises without the prior written consent of the Landlord, which consent may be granted subject to reasonable conditions including an additional pet deposit.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">TERMINATION</div>
    <div class="clause-text">
      ${lease.lease_type === 'month_to_month'
        ? 'Either party may terminate this month-to-month lease by providing 30 calendar days\' written notice in writing. The Tenant shall remain liable for rental during the notice period.'
        : 'This fixed-term lease shall terminate on the end date specified in the schedule without further notice. Early termination by the Tenant prior to the expiry date shall constitute a breach. The Landlord may elect to accept early termination subject to a penalty calculated in accordance with the Consumer Protection Act (CPA s14), limited to a reasonable amount not exceeding the rental for the notice period.'}
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">DEPOSIT REFUND</div>
    <div class="clause-text">
      The deposit, together with any interest accrued, shall be refunded to the Tenant within 14 days of termination of this lease and vacating of the premises, less any amounts lawfully deductible for damages, arrears, or breach. An inspection report and municipal account clearance shall form the basis for any deductions.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">BREACH</div>
    <div class="clause-text">
      Should the Tenant fail to pay rental on the due date or commit any other breach of this agreement, the Landlord shall be entitled to demand rectification in writing. If the breach is not remedied within 20 business days (in the case of rental arrears, 20 business days written notice as required by the Consumer Protection Act), the Landlord shall be entitled to cancel this lease and claim damages, including all arrears, legal costs on an attorney-and-own-client scale, and collection charges.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">DOMICILIUM</div>
    <div class="clause-text">
      The parties choose their respective domicilium citandi et executandi for all purposes under this lease as the addresses reflected in the schedule. Any notice delivered by hand shall be deemed received on the day of delivery. Any notice sent by registered post shall be deemed received 7 days after posting.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">GOVERNING LAW</div>
    <div class="clause-text">
      This agreement shall be governed by and construed in accordance with the laws of the Republic of South Africa. The Rental Housing Act, 1999 (Act No. 50 of 1999) and the Consumer Protection Act, 2008 (Act No. 68 of 2008) apply to this lease agreement. The parties consent to the jurisdiction of the Magistrates' Court in terms of Section 28 of the Magistrate's Court Act.
    </div>
  </div>

  <div class="clause">
    <div class="clause-number">ENTIRE AGREEMENT</div>
    <div class="clause-text">
      This document constitutes the entire agreement between the parties. No variation, amendment, or consensual cancellation of this lease shall be of any force or effect unless reduced to writing and signed by both parties.
    </div>
  </div>
</div>

<div class="signatures">
  <div class="section-title">Signatures</div>

  <p style="margin-bottom:16px;font-size:10pt;text-align:justify;">
    By signing below, both parties acknowledge that they have read, understood, and agree to be bound by all the terms and conditions set forth in this Residential Management Lease Agreement.
  </p>

  <div class="signature-row">
    <div class="signature-box">
      <h3>LANDLORD / OWNER</h3>
      <div class="signature-image">
        ${lease.owner_signature_url ? `<img src="${lease.owner_signature_url}" alt="Owner Signature" />` : '<span style="color:#999;">Pending electronic signature</span>'}
      </div>
      <div class="signature-line">
        <div class="signature-name">${lease.owner.full_name}</div>
        <div class="signature-date">Signed: ${lease.owner_signed_at ? formatDate(lease.owner_signed_at) : 'Pending'}</div>
      </div>
    </div>

    <div class="signature-box">
      <h3>TENANT</h3>
      <div class="signature-image">
        ${lease.tenant_signature_url ? `<img src="${lease.tenant_signature_url}" alt="Tenant Signature" />` : '<span style="color:#999;">Pending electronic signature</span>'}
      </div>
      <div class="signature-line">
        <div class="signature-name">${lease.tenant.full_name}</div>
        <div class="signature-date">Signed: ${lease.tenant_signed_at ? formatDate(lease.tenant_signed_at) : 'Pending'}</div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  <p>This document was electronically generated and executed through LaLarente.</p>
  <p>Lease ID: ${lease.id} &nbsp;|&nbsp; Generated: ${new Date().toISOString().split('T')[0]}</p>
  <p>Page &mdash; Generated electronically</p>
</div>

</body>
</html>`;
}

export async function generateAndUploadLeasePDF(leaseData: LeaseData): Promise<string> {
  try {
    const html = generateLeaseHTML(leaseData);
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    console.log('PDF generated at URI:', uri);

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    console.log('PDF read as base64, length:', base64.length);

    const arrayBuffer = decode(base64);
    console.log('PDF converted to ArrayBuffer, size:', arrayBuffer.byteLength);

    const publicUrl = await uploadLeasePDF(leaseData.id, arrayBuffer);

    await FileSystem.deleteAsync(uri, { idempotent: true });

    return publicUrl;
  } catch (error) {
    console.error('Error generating lease PDF:', error);
    throw error;
  }
}

export async function downloadLeasePDF(leaseDocumentUrl: string, leaseName: string): Promise<void> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    const response = await fetch(leaseDocumentUrl);
    const blob = await response.blob();

    const { uri } = await Print.printToFileAsync({
      html: '<html><body></body></html>',
      base64: false,
    });

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: leaseName,
      UTI: 'com.adobe.pdf',
    });
  } catch (error) {
    console.error('Error downloading lease PDF:', error);
    throw error;
  }
}
