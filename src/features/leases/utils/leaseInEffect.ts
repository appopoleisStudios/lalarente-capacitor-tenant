/**
 * Lease statuses where the lease is signed by both tenant and owner and is in
 * effect. Owner countersigning moves a lease straight to 'active'; a running
 * lease can then become 'month_to_month' or 'renewal_pending' (renewal being
 * negotiated). Every other status — draft, awaiting a signature, ended — is
 * not a lease in effect.
 */
export const LEASE_IN_EFFECT_STATUSES = ['active', 'month_to_month', 'renewal_pending'] as const;

export const isLeaseInEffect = (status: string | null | undefined): boolean =>
  !!status && (LEASE_IN_EFFECT_STATUSES as readonly string[]).includes(status);

/**
 * Report Issue is between owner and tenant, so a tenant can only raise a
 * maintenance request on a property where their lease is in effect (CT7-066).
 */
export const canReportIssue = isLeaseInEffect;

export const REPORT_ISSUE_NEEDS_SIGNED_LEASE_MESSAGE =
  'You can report issues once your lease is signed by you and the owner.';
