import { supabase } from '../../../lib/supabase';
import { generateAndUploadLeasePDF } from './leasePdfService';

/**
 * Calculate the next payment date based on start date and payment due day
 */
function calculateNextPaymentDate(startDate: string, paymentDueDay: number): string {
  const start = new Date(startDate);
  const today = new Date();

  // If start date is in the future, use start date's month
  const targetDate = start > today ? start : today;

  // Create date with payment due day
  const paymentDate = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    paymentDueDay
  );

  // If payment date has passed this month, move to next month
  if (paymentDate < today) {
    paymentDate.setMonth(paymentDate.getMonth() + 1);
  }

  return paymentDate.toISOString().split('T')[0];
}

/**
 * Execute lease when both parties have signed
 * This function:
 * 1. Generates and uploads lease PDF document
 * 2. Updates lease with document URL
 * 3. Updates property status to 'rented'
 * 4. Creates first payment record
 * 5. Updates application status
 * 6. Creates notifications for both parties
 */
export async function executeLease(leaseId: string): Promise<void> {
  try {
    // Get lease details with related data
    const { data: lease, error: leaseError } = await supabase
      .from('leases')
      .select(`
        *,
        property:properties!property_id(
          title,
          address,
          city,
          province
        ),
        owner:profiles!owner_id(
          full_name,
          email,
          phone
        ),
        tenant:profiles!tenant_id(
          full_name,
          email,
          phone,
          id_number
        )
      `)
      .eq('id', leaseId)
      .single();

    if (leaseError || !lease) {
      throw new Error('Lease not found');
    }

    // Verify both parties have signed
    if (!lease.owner_signed_at || !lease.tenant_signed_at) {
      throw new Error('Both parties must sign before lease can be executed');
    }

    // 1. Generate and upload lease PDF document
    console.log('Generating lease PDF document...');
    let leaseDocumentUrl: string | null = null;

    try {
      leaseDocumentUrl = await generateAndUploadLeasePDF(lease);
      console.log('Lease PDF generated and uploaded successfully:', leaseDocumentUrl);
    } catch (pdfError) {
      console.error('Error generating lease PDF:', pdfError);
      // Don't throw - lease can still be executed without PDF
      // PDF can be generated manually later if needed
    }

    // 2. Update lease with document URL (if PDF was generated)
    if (leaseDocumentUrl) {
      const { error: docUpdateError } = await supabase
        .from('leases')
        .update({ lease_document_url: leaseDocumentUrl })
        .eq('id', leaseId);

      if (docUpdateError) {
        console.error('Error updating lease document URL:', docUpdateError);
        // Don't throw - not critical
      }
    }

    // 3. Update property status to 'rented'
    if (!lease.property_id) {
      throw new Error('Lease has no property_id');
    }

    const { error: propertyError } = await supabase
      .from('properties')
      .update({ status: 'rented' })
      .eq('id', lease.property_id);

    if (propertyError) {
      console.error('Error updating property status:', propertyError);
      throw new Error('Failed to update property status');
    }

    // 4. Create first payment record
    const firstPaymentDate = calculateNextPaymentDate(
      lease.start_date,
      lease.payment_due_day || 1
    );

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        lease_id: leaseId,
        tenant_id: lease.tenant_id!,
        owner_id: lease.owner_id!,
        property_id: lease.property_id!,
        amount: lease.monthly_rent,
        due_date: firstPaymentDate,
        type: 'rent',
        status: 'pending',
      });

    if (paymentError) {
      console.error('Error creating payment:', paymentError);
      // Don't throw - payment can be created manually if needed
    }

    // 5. Update application status (if linked)
    if (lease.application_id) {
      const { error: appError } = await supabase
        .from('rental_applications')
        .update({ status: 'approved' })
        .eq('id', lease.application_id);

      if (appError) {
        console.error('Error updating application:', appError);
        // Don't throw - not critical
      }
    }

    // 6. Create notifications (implement when notification system is ready)
    // TODO: Notify tenant: "Your lease is now active! Welcome home. Download your lease document from the Lease tab."
    // TODO: Notify owner: "Lease with {tenant_name} is now active. Lease document is available for download."

    console.log('Lease executed successfully:', leaseId);
    if (leaseDocumentUrl) {
      console.log('Lease document available at:', leaseDocumentUrl);
    }
  } catch (error) {
    console.error('Error executing lease:', error);
    throw error;
  }
}

/**
 * Check if lease can be executed (both parties signed)
 */
export function canExecuteLease(lease: {
  owner_signed_at: string | null;
  tenant_signed_at: string | null;
  status: string | null;
}): boolean {
  return (
    !!lease.owner_signed_at &&
    !!lease.tenant_signed_at &&
    lease.status !== 'active'
  );
}
