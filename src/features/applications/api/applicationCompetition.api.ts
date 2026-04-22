/**
 * Application Competition API
 *
 * Manages shortlisting, ranking, and backup applicant queues.
 * Allows owners to compare and select tenants.
 */

import { supabase } from '../../../lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RankedApplication {
  id: string;
  tenant_id: string;
  property_id: string;
  status: string;
  score: number | null;
  backup_rank: number | null;
  shortlisted: boolean;
  affordability_ratio: number | null;
  credit_check_status: string | null;
  created_at: string;
  tenant?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const applicationCompetitionApi = {
  /**
   * Get all applications for a property, ranked by score.
   */
  async getRankedApplications(propertyId: string): Promise<RankedApplication[]> {
    const { data, error } = await supabase
      .from('rental_applications')
      .select(`
        id, tenant_id, property_id, status, score, backup_rank,
        shortlisted, affordability_ratio, credit_check_status, created_at,
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('property_id', propertyId)
      .in('status', ['submitted', 'under_review', 'shortlisted', 'backup'])
      .order('score', { ascending: false, nullsFirst: false });

    if (error) {
      console.error('Error fetching ranked applications:', error);
      throw new Error(`Failed to fetch applications: ${error.message}`);
    }

    return data as RankedApplication[];
  },

  /**
   * Shortlist an application.
   */
  async shortlistApplication(applicationId: string): Promise<void> {
    const { error } = await supabase
      .from('rental_applications')
      .update({
        status: 'shortlisted',
        shortlisted: true,
        shortlisted_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) {
      console.error('Error shortlisting application:', error);
      throw new Error(`Failed to shortlist: ${error.message}`);
    }
  },

  /**
   * Set backup rank for an application.
   */
  async setBackupRank(applicationId: string, rank: number): Promise<void> {
    const { error } = await supabase
      .from('rental_applications')
      .update({
        status: 'backup',
        backup_rank: rank,
      })
      .eq('id', applicationId);

    if (error) {
      console.error('Error setting backup rank:', error);
      throw new Error(`Failed to set backup: ${error.message}`);
    }
  },

  /**
   * Approve the selected application and reject/backup the rest.
   */
  async selectWinner(propertyId: string, winnerId: string): Promise<void> {
    // Approve the winner
    const { error: approveErr } = await supabase
      .from('rental_applications')
      .update({ status: 'approved' })
      .eq('id', winnerId);

    if (approveErr) {
      throw new Error(`Failed to approve application: ${approveErr.message}`);
    }

    // Set remaining shortlisted as backup
    const { data: others } = await supabase
      .from('rental_applications')
      .select('id')
      .eq('property_id', propertyId)
      .neq('id', winnerId)
      .in('status', ['submitted', 'under_review', 'shortlisted']);

    if (others) {
      for (let i = 0; i < others.length; i++) {
        await supabase
          .from('rental_applications')
          .update({
            status: 'backup',
            backup_rank: i + 1,
          })
          .eq('id', others[i].id);
      }
    }

    // Update property status
    await supabase
      .from('properties')
      .update({ status: 'lease_pending' })
      .eq('id', propertyId);
  },

  /**
   * Promote the next backup applicant (if primary falls through).
   */
  async promoteNextBackup(propertyId: string): Promise<string | null> {
    const { data: nextBackup, error } = await supabase
      .from('rental_applications')
      .select('id')
      .eq('property_id', propertyId)
      .eq('status', 'backup')
      .order('backup_rank', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !nextBackup) return null;

    await supabase
      .from('rental_applications')
      .update({ status: 'approved', backup_rank: null })
      .eq('id', nextBackup.id);

    return nextBackup.id;
  },

  /**
   * Calculate affordability ratio for an application.
   * Standard: rent should be <= 30% of gross monthly income.
   */
  calculateAffordabilityRatio(monthlyRent: number, monthlyIncome: number): {
    ratio: number;
    isAffordable: boolean;
  } {
    if (monthlyIncome <= 0) return { ratio: 100, isAffordable: false };
    const ratio = (monthlyRent / monthlyIncome) * 100;
    return {
      ratio: Math.round(ratio * 100) / 100,
      isAffordable: ratio <= 30,
    };
  },
};
