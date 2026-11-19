import { LEASE_IN_EFFECT_STATUSES, canReportIssue, isLeaseInEffect } from '../utils/leaseInEffect';

// CT7-066: a tenant may report an issue to the owner only on a lease signed
// by both and in effect. Every value allowed by leases_status_check
// (migration 20261113000001) is listed here.
const ALL_LEASE_STATUSES = [
  'draft',
  'pending_signatures',
  'pending_tenant_signature',
  'pending_owner_signature',
  'active',
  'month_to_month',
  'renewal_pending',
  'expired',
  'terminated',
  'early_terminated',
];

const ALLOWED = ['active', 'month_to_month', 'renewal_pending'];

describe('lease in effect / canReportIssue', () => {
  it.each(ALL_LEASE_STATUSES)('status %s', (status) => {
    const expected = ALLOWED.includes(status);
    expect(isLeaseInEffect(status)).toBe(expected);
    expect(canReportIssue(status)).toBe(expected);
  });

  it.each([null, undefined, '', 'cancelled', 'ACTIVE'])('rejects %p', (status) => {
    expect(canReportIssue(status as string | null | undefined)).toBe(false);
  });

  it('allows exactly the signed, in-effect statuses', () => {
    expect([...LEASE_IN_EFFECT_STATUSES].sort()).toEqual([...ALLOWED].sort());
  });
});
