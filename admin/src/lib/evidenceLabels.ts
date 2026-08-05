/**
 * Shared label maps for vendor-payment photo evidence and event timelines.
 * Used by both EvidenceGallery (dispute queue) and TransactionDetailModal
 * (drill-down) so the two views never diverge.
 */
export const EVIDENCE_STAGE_LABELS: Record<string, string> = {
  completion: 'Completion photos',
  vendor_after: 'Vendor after-work',
  tenant_rejection: 'Tenant rejection',
  tenant_confirmation: 'Tenant confirmation',
  progress: 'Progress update',
};

export const EVIDENCE_EVENT_LABELS: Record<string, string> = {
  closure_requested: 'Closure requested',
  closure_forwarded: 'Forwarded to tenant',
  tenant_approved: 'Tenant approved',
  tenant_rejected: 'Tenant rejected',
  closed: 'Closed',
  progress: 'Progress update',
};
