/**
 * One-time utility to regenerate PDF for existing leases that were executed before PDF generation was implemented
 * Run this in the app console or create a temporary button to trigger it
 */

import { supabase } from '../../../lib/supabase';
import { generateAndUploadLeasePDF } from './leasePdfService';

export async function regenerateLeasePDF(leaseId: string): Promise<void> {
  try {
    console.log('Regenerating PDF for lease:', leaseId);

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

    // Check if lease is active and both parties have signed
    if (lease.status !== 'active') {
      throw new Error('Lease must be active to regenerate PDF');
    }

    if (!lease.owner_signed_at || !lease.tenant_signed_at) {
      throw new Error('Both parties must have signed the lease');
    }

    // Generate and upload PDF
    console.log('Generating PDF...');
    const leaseDocumentUrl = await generateAndUploadLeasePDF(lease as any);
    console.log('PDF generated successfully:', leaseDocumentUrl);

    // Update lease with document URL
    const { error: updateError } = await supabase
      .from('leases')
      .update({ lease_document_url: leaseDocumentUrl })
      .eq('id', leaseId);

    if (updateError) {
      throw updateError;
    }

    console.log('✅ Lease PDF regenerated successfully!');
    console.log('Document URL:', leaseDocumentUrl);

    return;
  } catch (error) {
    console.error('❌ Error regenerating lease PDF:', error);
    throw error;
  }
}

/**
 * Regenerate PDFs for all active leases that are missing documents
 */
export async function regenerateAllMissingPDFs(): Promise<void> {
  try {
    console.log('Finding leases with missing PDFs...');

    // Get all active leases without PDFs
    const { data: leases, error } = await supabase
      .from('leases')
      .select('id, status, lease_document_url')
      .eq('status', 'active')
      .is('lease_document_url', null);

    if (error) throw error;

    if (!leases || leases.length === 0) {
      console.log('No leases found with missing PDFs');
      return;
    }

    console.log(`Found ${leases.length} lease(s) with missing PDFs`);

    // Regenerate each one
    for (const lease of leases) {
      try {
        console.log(`\nRegenerating PDF for lease ${lease.id}...`);
        await regenerateLeasePDF(lease.id);
      } catch (error) {
        console.error(`Failed to regenerate PDF for lease ${lease.id}:`, error);
        // Continue with next lease
      }
    }

    console.log('\n✅ Finished regenerating all missing PDFs');
  } catch (error) {
    console.error('❌ Error regenerating PDFs:', error);
    throw error;
  }
}
