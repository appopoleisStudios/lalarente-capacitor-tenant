/**
 * Lease Expiry & Notice API
 *
 * CPA s14(2)(c): Landlord must give notice before lease expiry.
 * Notice periods: 80, 60, and 40 business days.
 */

import { supabase } from '../../../lib/supabase';
import {
  calculateExpiryNoticeDate,
  toDateString,
  isBusinessDay,
} from '../../../shared/utils/businessDayCalculator';

// ─── Pure Helpers ────────────────────────────────────────────────────────────

/**
 * Calculate days between a target date and today.
 */
export function calculateDaysUntilExpiry(endDate: string, today: Date): number {
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Determine the lease expiry status based on days until expiry and notice status.
 */
export function determineLeaseStatus(
  daysUntilExpiry: number,
  today: Date,
  notice80Due: Date,
  notice80Sent: boolean
): LeaseExpiryInfo['status'] {
  if (daysUntilExpiry <= 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  if (!notice80Sent && today >= notice80Due) return 'overdue';
  if (today >= notice80Due) return 'notice_due';
  return 'ok';
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaseExpiryInfo {
  leaseId: string;
  endDate: string;
  daysUntilExpiry: number;
  notice80Due: string;
  notice60Due: string;
  notice40Due: string;
  notice80Sent: boolean;
  notice60Sent: boolean;
  notice40Sent: boolean;
  tenantResponse: string | null;
  status: 'ok' | 'notice_due' | 'overdue' | 'expiring_soon' | 'expired';
}

export interface ExpiringLease {
  id: string;
  property_id: string;
  tenant_id: string;
  owner_id: string;
  end_date: string;
  monthly_rent: number;
  status: string;
  tenant_renewal_response: string | null;
  property?: { id: string; title: string; address: string };
  tenant?: { id: string; full_name: string; email: string | null };
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const leaseExpiryApi = {
  /**
   * Get expiry information for a specific lease.
   */
  async getLeaseExpiryInfo(leaseId: string): Promise<LeaseExpiryInfo> {
    const { data: lease, error } = await supabase
      .from('leases')
      .select('id, end_date, notice_80_sent_at, notice_60_sent_at, notice_40_sent_at, tenant_renewal_response')
      .eq('id', leaseId)
      .single();

    if (error || !lease) {
      throw new Error('Lease not found');
    }

    const endDate = new Date(lease.end_date);
    const today = new Date();
    const daysUntilExpiry = calculateDaysUntilExpiry(lease.end_date, today);

    const notice80Due = calculateExpiryNoticeDate(endDate, 80);
    const notice60Due = calculateExpiryNoticeDate(endDate, 60);
    const notice40Due = calculateExpiryNoticeDate(endDate, 40);

    // Determine status
    const status = determineLeaseStatus(daysUntilExpiry, today, notice80Due, !!lease.notice_80_sent_at);

    return {
      leaseId: lease.id,
      endDate: lease.end_date,
      daysUntilExpiry,
      notice80Due: toDateString(notice80Due),
      notice60Due: toDateString(notice60Due),
      notice40Due: toDateString(notice40Due),
      notice80Sent: !!lease.notice_80_sent_at,
      notice60Sent: !!lease.notice_60_sent_at,
      notice40Sent: !!lease.notice_40_sent_at,
      tenantResponse: lease.tenant_renewal_response,
      status,
    };
  },

  /**
   * Get all leases approaching expiry for an owner.
   * Returns leases within the next 120 calendar days.
   */
  async getExpiringLeases(ownerId: string, withinDays: number = 120): Promise<ExpiringLease[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + withinDays);

    const { data, error } = await supabase
      .from('leases')
      .select(`
        id, property_id, tenant_id, owner_id, end_date, monthly_rent, status,
        tenant_renewal_response,
        property:properties!property_id(id, title, address),
        tenant:profiles!tenant_id(id, full_name, email)
      `)
      .eq('owner_id', ownerId)
      .in('status', ['active', 'renewal_pending'])
      .gte('end_date', today.toISOString())
      .lte('end_date', futureDate.toISOString())
      .order('end_date', { ascending: true });

    if (error) {
      console.error('Error fetching expiring leases:', error);
      throw new Error(`Failed to fetch expiring leases: ${error.message}`);
    }

    return data as ExpiringLease[];
  },

  /**
   * Record that an expiry notice was sent.
   */
  async recordNoticeSent(
    leaseId: string,
    noticeType: '80' | '60' | '40'
  ): Promise<void> {
    const field = `notice_${noticeType}_sent_at` as const;

    const { error } = await supabase
      .from('leases')
      .update({ [field]: new Date().toISOString() })
      .eq('id', leaseId);

    if (error) {
      console.error(`Error recording ${noticeType}-day notice:`, error);
      throw new Error(`Failed to record notice: ${error.message}`);
    }
  },

  /**
   * Record tenant's renewal response.
   */
  async recordTenantResponse(
    leaseId: string,
    response: 'renew' | 'terminate' | 'negotiate'
  ): Promise<void> {
    const updateData: Record<string, unknown> = {
      tenant_renewal_response: response,
      tenant_response_at: new Date().toISOString(),
    };

    if (response === 'renew' || response === 'negotiate') {
      updateData.status = 'renewal_pending';
    }

    const { error } = await supabase
      .from('leases')
      .update(updateData)
      .eq('id', leaseId);

    if (error) {
      console.error('Error recording tenant response:', error);
      throw new Error(`Failed to record response: ${error.message}`);
    }
  },

  /**
   * Check all active leases for overdue notices.
   * Returns leases where a notice should have been sent but hasn't.
   */
  async getOverdueNotices(ownerId: string): Promise<Array<{
    leaseId: string;
    overdueNotices: ('80' | '60' | '40')[];
    endDate: string;
  }>> {
    const leases = await this.getExpiringLeases(ownerId, 180);
    const overdueList: Array<{ leaseId: string; overdueNotices: ('80' | '60' | '40')[]; endDate: string }> = [];

    for (const lease of leases) {
      const info = await this.getLeaseExpiryInfo(lease.id);
      const overdueNotices: ('80' | '60' | '40')[] = [];
      const today = toDateString(new Date());

      if (!info.notice80Sent && today >= info.notice80Due) overdueNotices.push('80');
      if (!info.notice60Sent && today >= info.notice60Due) overdueNotices.push('60');
      if (!info.notice40Sent && today >= info.notice40Due) overdueNotices.push('40');

      if (overdueNotices.length > 0) {
        overdueList.push({ leaseId: lease.id, overdueNotices, endDate: lease.end_date });
      }
    }

    return overdueList;
  },
};
