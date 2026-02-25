import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { uploadLeasePDF } from './storageService';

interface LeaseData {
  id: string;
  property: {
    title: string;
    address: string;
    city: string;
    province?: string;
  };
  owner: {
    full_name: string;
    email?: string;
    phone?: string;
  };
  tenant: {
    full_name: string;
    email?: string;
    phone?: string;
    id_number?: string;
  };
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number | null;
  payment_due_day: number | null;
  lease_type: string | null;
  late_fee_amount?: number | null;
  late_fee_grace_days?: number | null;
  rent_escalation_type: string | null;
  rent_escalation_value: number | null;
  rent_escalation_frequency_months: number | null;
  owner_signature_url: string | null;
  tenant_signature_url: string | null;
  owner_signed_at: string | null;
  tenant_signed_at: string | null;
  executed_at: string | null;
}

/**
 * Format currency for South African Rand
 */
function formatCurrency(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format date to readable format
 */
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Generate HTML content for lease PDF
 */
function generateLeaseHTML(lease: LeaseData): string {
  const leaseTypeDisplay = lease.lease_type === 'fixed' ? 'Fixed Term' : 'Month-to-Month';
  const escalationType = lease.rent_escalation_type === 'percentage' ? '%' : ' (Fixed)';
  const escalationValue = lease.rent_escalation_value || 0;
  const escalationFrequency = lease.rent_escalation_frequency_months || 12;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Lease Agreement</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            padding: 40px;
          }

          .header {
            text-align: center;
            border-bottom: 3px solid #002395;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }

          .header h1 {
            color: #002395;
            font-size: 24pt;
            font-weight: 700;
            margin-bottom: 5px;
          }

          .header p {
            color: #666;
            font-size: 10pt;
          }

          .section {
            margin-bottom: 25px;
          }

          .section-title {
            background: #f5f5f5;
            padding: 10px 15px;
            border-left: 4px solid #002395;
            font-size: 14pt;
            font-weight: 600;
            color: #002395;
            margin-bottom: 15px;
          }

          .party-info {
            background: #fafafa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 15px;
          }

          .party-info h3 {
            color: #002395;
            font-size: 12pt;
            margin-bottom: 8px;
          }

          .info-row {
            display: flex;
            padding: 5px 0;
          }

          .info-label {
            font-weight: 600;
            color: #555;
            width: 180px;
          }

          .info-value {
            color: #333;
          }

          .terms-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
          }

          .term-box {
            background: #f9f9f9;
            padding: 12px;
            border-radius: 5px;
            border: 1px solid #e0e0e0;
          }

          .term-label {
            font-size: 9pt;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 4px;
          }

          .term-value {
            font-size: 12pt;
            color: #002395;
            font-weight: 600;
          }

          .clause {
            margin-bottom: 15px;
            padding-left: 20px;
          }

          .clause-number {
            font-weight: 600;
            color: #002395;
            margin-bottom: 5px;
          }

          .clause-text {
            text-align: justify;
            line-height: 1.7;
          }

          .signatures {
            margin-top: 50px;
            page-break-inside: avoid;
          }

          .signature-row {
            display: flex;
            justify-content: space-between;
            margin-top: 30px;
          }

          .signature-box {
            width: 45%;
          }

          .signature-image {
            border: 2px solid #002395;
            border-radius: 5px;
            padding: 10px;
            background: white;
            height: 100px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 10px;
          }

          .signature-image img {
            max-width: 100%;
            max-height: 80px;
          }

          .signature-line {
            border-top: 2px solid #333;
            padding-top: 5px;
            text-align: center;
          }

          .signature-name {
            font-weight: 600;
            color: #002395;
            margin-bottom: 3px;
          }

          .signature-date {
            font-size: 9pt;
            color: #666;
          }

          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
            text-align: center;
            font-size: 9pt;
            color: #999;
          }

          @media print {
            body {
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div class="header">
          <h1>RESIDENTIAL LEASE AGREEMENT</h1>
          <p>Lease ID: ${lease.id}</p>
          <p>Executed on ${lease.executed_at ? formatDate(lease.executed_at) : 'Pending'}</p>
        </div>

        <!-- Property Information -->
        <div class="section">
          <div class="section-title">Property Details</div>
          <div class="party-info">
            <div class="info-row">
              <div class="info-label">Property:</div>
              <div class="info-value">${lease.property.title}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Address:</div>
              <div class="info-value">${lease.property.address}, ${lease.property.city}${lease.property.province ? `, ${lease.property.province}` : ''}</div>
            </div>
          </div>
        </div>

        <!-- Parties -->
        <div class="section">
          <div class="section-title">Parties to this Agreement</div>

          <div class="party-info">
            <h3>LANDLORD (Owner)</h3>
            <div class="info-row">
              <div class="info-label">Full Name:</div>
              <div class="info-value">${lease.owner.full_name}</div>
            </div>
            ${lease.owner.email ? `
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value">${lease.owner.email}</div>
            </div>` : ''}
            ${lease.owner.phone ? `
            <div class="info-row">
              <div class="info-label">Phone:</div>
              <div class="info-value">${lease.owner.phone}</div>
            </div>` : ''}
          </div>

          <div class="party-info">
            <h3>TENANT</h3>
            <div class="info-row">
              <div class="info-label">Full Name:</div>
              <div class="info-value">${lease.tenant.full_name}</div>
            </div>
            ${lease.tenant.id_number ? `
            <div class="info-row">
              <div class="info-label">ID Number:</div>
              <div class="info-value">${lease.tenant.id_number}</div>
            </div>` : ''}
            ${lease.tenant.email ? `
            <div class="info-row">
              <div class="info-label">Email:</div>
              <div class="info-value">${lease.tenant.email}</div>
            </div>` : ''}
            ${lease.tenant.phone ? `
            <div class="info-row">
              <div class="info-label">Phone:</div>
              <div class="info-value">${lease.tenant.phone}</div>
            </div>` : ''}
          </div>
        </div>

        <!-- Lease Terms -->
        <div class="section">
          <div class="section-title">Lease Terms & Conditions</div>

          <div class="terms-grid">
            <div class="term-box">
              <div class="term-label">Lease Type</div>
              <div class="term-value">${leaseTypeDisplay}</div>
            </div>
            <div class="term-box">
              <div class="term-label">Monthly Rent</div>
              <div class="term-value">${formatCurrency(lease.monthly_rent)}</div>
            </div>
            <div class="term-box">
              <div class="term-label">Start Date</div>
              <div class="term-value">${formatDate(lease.start_date)}</div>
            </div>
            <div class="term-box">
              <div class="term-label">End Date</div>
              <div class="term-value">${formatDate(lease.end_date)}</div>
            </div>
            ${lease.deposit_amount ? `
            <div class="term-box">
              <div class="term-label">Security Deposit</div>
              <div class="term-value">${formatCurrency(lease.deposit_amount)}</div>
            </div>` : ''}
            <div class="term-box">
              <div class="term-label">Payment Due Day</div>
              <div class="term-value">Day ${lease.payment_due_day || 1} of each month</div>
            </div>
          </div>
        </div>

        <!-- Financial Terms -->
        <div class="section">
          <div class="section-title">Financial Terms</div>

          <div class="clause">
            <div class="clause-number">1. RENT PAYMENT</div>
            <div class="clause-text">
              The Tenant agrees to pay the monthly rent of ${formatCurrency(lease.monthly_rent)} on or before the ${lease.payment_due_day || 1}${lease.payment_due_day === 1 ? 'st' : lease.payment_due_day === 2 ? 'nd' : lease.payment_due_day === 3 ? 'rd' : 'th'} day of each month. Payment shall be made via the designated payment method in the LaLarente application.
            </div>
          </div>

          ${lease.late_fee_amount ? `
          <div class="clause">
            <div class="clause-number">2. LATE FEES</div>
            <div class="clause-text">
              If rent is not received within ${lease.late_fee_grace_days || 3} days of the due date, a late fee of ${formatCurrency(lease.late_fee_amount)} will be applied.
            </div>
          </div>` : ''}

          ${lease.rent_escalation_type ? `
          <div class="clause">
            <div class="clause-number">${lease.late_fee_amount ? '3' : '2'}. RENT ESCALATION</div>
            <div class="clause-text">
              The monthly rent shall escalate by ${escalationValue}${escalationType} every ${escalationFrequency} months, effective from the lease start date.
            </div>
          </div>` : ''}

          ${lease.deposit_amount ? `
          <div class="clause">
            <div class="clause-number">${lease.rent_escalation_type ? (lease.late_fee_amount ? '4' : '3') : (lease.late_fee_amount ? '3' : '2')}. SECURITY DEPOSIT</div>
            <div class="clause-text">
              The Tenant has paid a security deposit of ${formatCurrency(lease.deposit_amount)}. This deposit will be held by the Landlord and returned to the Tenant within 14 days of lease termination, less any deductions for damages beyond normal wear and tear.
            </div>
          </div>` : ''}
        </div>

        <!-- Standard Clauses -->
        <div class="section">
          <div class="section-title">General Terms & Conditions</div>

          <div class="clause">
            <div class="clause-number">PROPERTY USE</div>
            <div class="clause-text">
              The Tenant shall use the property solely as a private residence and shall not carry on any business or trade from the property without the Landlord's prior written consent.
            </div>
          </div>

          <div class="clause">
            <div class="clause-number">MAINTENANCE</div>
            <div class="clause-text">
              The Tenant agrees to maintain the property in good condition and to report any maintenance issues promptly through the LaLarente application. The Landlord shall be responsible for major repairs and structural maintenance.
            </div>
          </div>

          <div class="clause">
            <div class="clause-number">TERMINATION</div>
            <div class="clause-text">
              ${lease.lease_type === 'month_to_month' ?
                'Either party may terminate this month-to-month lease by providing 30 days written notice.' :
                'This fixed-term lease shall terminate on the end date specified above. Early termination requires mutual written consent of both parties.'}
            </div>
          </div>

          <div class="clause">
            <div class="clause-number">GOVERNING LAW</div>
            <div class="clause-text">
              This agreement shall be governed by and construed in accordance with the laws of the Republic of South Africa. The Rental Housing Act, 1999 (Act No. 50 of 1999) applies to this lease agreement.
            </div>
          </div>
        </div>

        <!-- Signatures -->
        <div class="signatures">
          <div class="section-title">Signatures</div>

          <p style="margin-bottom: 20px; text-align: justify;">
            By signing below, both parties acknowledge that they have read, understood, and agree to be bound by all terms and conditions set forth in this Lease Agreement.
          </p>

          <div class="signature-row">
            <div class="signature-box">
              <div class="signature-image">
                ${lease.owner_signature_url ? `<img src="${lease.owner_signature_url}" alt="Owner Signature" />` : '<span style="color: #999;">Pending Signature</span>'}
              </div>
              <div class="signature-line">
                <div class="signature-name">LANDLORD (Owner)</div>
                <div>${lease.owner.full_name}</div>
                <div class="signature-date">Signed: ${lease.owner_signed_at ? formatDate(lease.owner_signed_at) : 'Pending'}</div>
              </div>
            </div>

            <div class="signature-box">
              <div class="signature-image">
                ${lease.tenant_signature_url ? `<img src="${lease.tenant_signature_url}" alt="Tenant Signature" />` : '<span style="color: #999;">Pending Signature</span>'}
              </div>
              <div class="signature-line">
                <div class="signature-name">TENANT</div>
                <div>${lease.tenant.full_name}</div>
                <div class="signature-date">Signed: ${lease.tenant_signed_at ? formatDate(lease.tenant_signed_at) : 'Pending'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>This document was electronically generated and executed through LaLarente.</p>
          <p>Document ID: ${lease.id} | Generated: ${new Date().toISOString().split('T')[0]}</p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate lease PDF and upload to storage
 * @param leaseData - Complete lease data with property, owner, tenant info
 * @returns Public URL of the uploaded PDF
 */
export async function generateAndUploadLeasePDF(leaseData: LeaseData): Promise<string> {
  try {
    // Generate HTML content
    const html = generateLeaseHTML(leaseData);

    // Generate PDF from HTML (returns local file URI)
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    console.log('PDF generated at URI:', uri);

    // Read the file as base64 (use string literal 'base64' for compatibility)
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as any,
    });

    console.log('PDF read as base64, length:', base64.length);

    // Convert base64 to ArrayBuffer using base64-arraybuffer (React Native compatible)
    const arrayBuffer = decode(base64);

    console.log('PDF converted to ArrayBuffer, size:', arrayBuffer.byteLength);

    // Upload to Supabase Storage
    const publicUrl = await uploadLeasePDF(leaseData.id, arrayBuffer);

    // Clean up temp file
    await FileSystem.deleteAsync(uri, { idempotent: true });

    return publicUrl;
  } catch (error) {
    console.error('Error generating lease PDF:', error);
    throw error;
  }
}

/**
 * Download lease PDF to device (for mobile)
 * @param leaseDocumentUrl - Public URL of the lease PDF
 * @param leaseName - Name for the downloaded file (e.g., "Lease_123_Signed.pdf")
 */
export async function downloadLeasePDF(leaseDocumentUrl: string, leaseName: string): Promise<void> {
  try {
    // Check if sharing is available
    const isAvailable = await Sharing.isAvailableAsync();

    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    // Download the PDF
    const response = await fetch(leaseDocumentUrl);
    const blob = await response.blob();

    // Generate temp URI
    const { uri } = await Print.printToFileAsync({
      html: '<html><body></body></html>', // Placeholder
      base64: false,
    });

    // Share the file
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
