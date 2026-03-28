/**
 * Lease Automation API
 *
 * Handles automatic month-to-month conversion and rent escalation.
 * CPA s14: If no renewal action taken, lease converts to MTM.
 */

import { supabase } from '../../../lib/supabase';
import { toDateString } from '../../../shared/utils/businessDayCalculator';

// ─── API ─────────────────────────────────────────────────────────────────────

export const leaseAutomationApi = {
  /**
   * Convert an expired fixed-term lease to month-to-month.
   * CPA s14(2)(d): Fixed-term auto-converts to MTM on same terms.
   */
  async convertToMonthToMonth(leaseId: string): Promise<void> {
    const { data: lease, error: fetchErr } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (fetchErr || !lease) {
      throw new Error('Lease not found');
    }

    // Only convert active/expired fixed-term leases
    if (lease.lease_type !== 'fixed') {
      throw new Error('Only fixed-term leases can be converted to month-to-month');
    }

    const today = new Date();
    const newEndDate = new Date(today);
    newEndDate.setMonth(newEndDate.getMonth() + 1);

    const { error } = await supabase
      .from('leases')
      .update({
        lease_type: 'month_to_month',
        status: 'month_to_month',
        auto_converted_to_mtm: true,
        converted_to_mtm_at: today.toISOString(),
        end_date: toDateString(newEndDate),
      })
      .eq('id', leaseId);

    if (error) {
      console.error('Error converting to MTM:', error);
      throw new Error(`Failed to convert to MTM: ${error.message}`);
    }
  },

  /**
   * Process rent escalation for a lease.
   * Applies the configured escalation type and value.
   */
  async processRentEscalation(leaseId: string): Promise<{
    previousRent: number;
    newRent: number;
    escalationPercentage: number;
  }> {
    const { data: lease, error: fetchErr } = await supabase
      .from('leases')
      .select('*')
      .eq('id', leaseId)
      .single();

    if (fetchErr || !lease) {
      throw new Error('Lease not found');
    }

    const currentRent = lease.monthly_rent;
    let newRent: number;
    let escalationPercentage: number;

    switch (lease.rent_escalation_type) {
      case 'fixed_percentage':
        escalationPercentage = lease.rent_escalation_value || 0;
        newRent = currentRent * (1 + escalationPercentage / 100);
        break;

      case 'fixed_amount':
        newRent = currentRent + (lease.rent_escalation_value || 0);
        escalationPercentage = ((newRent - currentRent) / currentRent) * 100;
        break;

      case 'cpi_linked':
        // CPI-linked: use the configured rate as a proxy
        // In production, this should fetch the latest CPI from Stats SA
        escalationPercentage = lease.rent_escalation_value || 5.0;
        newRent = currentRent * (1 + escalationPercentage / 100);
        break;

      default:
        throw new Error('No escalation type configured for this lease');
    }

    // Round to 2 decimal places
    newRent = Math.round(newRent * 100) / 100;

    // Build escalation history entry
    const historyEntry = {
      date: toDateString(new Date()),
      previousRent: currentRent,
      newRent,
      escalationType: lease.rent_escalation_type,
      percentage: escalationPercentage,
    };

    const existingHistory = (lease.escalation_history as unknown[]) || [];

    const { error } = await supabase
      .from('leases')
      .update({
        monthly_rent: newRent,
        last_escalation_date: toDateString(new Date()),
        last_escalation_amount: newRent - currentRent,
        escalation_history: [...existingHistory, historyEntry] as any,
        next_escalation_date: this.calculateNextEscalationDate(
          new Date(),
          lease.rent_escalation_frequency_months || 12
        ),
      })
      .eq('id', leaseId);

    if (error) {
      console.error('Error processing escalation:', error);
      throw new Error(`Failed to process escalation: ${error.message}`);
    }

    return {
      previousRent: currentRent,
      newRent,
      escalationPercentage: Math.round(escalationPercentage * 100) / 100,
    };
  },

  /**
   * Check all leases for pending escalations.
   */
  async checkPendingEscalations(ownerId: string): Promise<Array<{
    leaseId: string;
    propertyTitle: string;
    currentRent: number;
    nextEscalationDate: string;
  }>> {
    const today = toDateString(new Date());

    const { data, error } = await supabase
      .from('leases')
      .select(`
        id, monthly_rent, next_escalation_date,
        property:properties!property_id(title)
      `)
      .eq('owner_id', ownerId)
      .in('status', ['active', 'month_to_month'])
      .not('rent_escalation_type', 'is', null)
      .lte('next_escalation_date', today);

    if (error) {
      console.error('Error checking escalations:', error);
      throw new Error(`Failed to check escalations: ${error.message}`);
    }

    return (data || []).map((lease) => ({
      leaseId: lease.id,
      propertyTitle: (lease.property as any)?.title || 'Unknown',
      currentRent: lease.monthly_rent,
      nextEscalationDate: lease.next_escalation_date || '',
    }));
  },

  /**
   * Check for expired leases that should be auto-converted to MTM.
   */
  async checkExpiredForAutoConversion(ownerId: string): Promise<string[]> {
    const today = toDateString(new Date());

    const { data, error } = await supabase
      .from('leases')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('status', 'active')
      .eq('lease_type', 'fixed')
      .lt('end_date', today)
      .eq('auto_converted_to_mtm', false);

    if (error) {
      console.error('Error checking for auto-conversion:', error);
      return [];
    }

    return (data || []).map((l) => l.id);
  },

  /** Helper: Calculate next escalation date. */
  calculateNextEscalationDate(from: Date, frequencyMonths: number): string {
    const next = new Date(from);
    next.setMonth(next.getMonth() + frequencyMonths);
    return toDateString(next);
  },
};
