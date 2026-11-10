import { colors } from '@/src/shared/theme/colors';

export interface StatusColorSet {
  text: string;
  background: string;
}

const STATUS_COLORS: Record<string, StatusColorSet> = {
  // ── Positive / active ──────────────────────────────────────────────────────
  active: { text: colors.success[600], background: colors.success[50] },
  approved: { text: colors.success[600], background: colors.success[50] },
  completed: { text: colors.success[600], background: colors.success[50] },
  resolved: { text: colors.success[600], background: colors.success[50] },
  executed: { text: colors.success[600], background: colors.success[50] },
  closed: { text: colors.success[600], background: colors.success[50] },
  paid: { text: colors.success[600], background: colors.success[50] },

  // ── Pending / in progress ─────────────────────────────────────────────────
  pending: { text: colors.warning[600], background: colors.warning[50] },
  submitted: { text: colors.warning[600], background: colors.warning[50] },
  under_review: { text: colors.warning[600], background: colors.warning[50] },
  in_progress: { text: colors.warning[600], background: colors.warning[50] },
  assigned: { text: colors.warning[600], background: colors.warning[50] },
  pending_signatures: { text: colors.warning[600], background: colors.warning[50] },
  pending_tenant_signature: { text: colors.warning[600], background: colors.warning[50] },
  pending_owner_signature: { text: colors.warning[600], background: colors.warning[50] },
  pending_verification: { text: colors.warning[600], background: colors.warning[50] },
  pending_vendor: { text: colors.warning[600], background: colors.warning[50] },
  pending_closure: { text: colors.warning[600], background: colors.warning[50] },
  cure_period: { text: colors.warning[600], background: colors.warning[50] },

  // ── Informational / neutral-active ────────────────────────────────────────
  open: { text: colors.info[600], background: colors.info[50] },
  mediation: { text: colors.info[600], background: colors.info[50] },
  escalated: { text: colors.info[600], background: colors.info[50] },
  awaiting_owner_dispatch: { text: colors.info[600], background: colors.info[50] },
  tenant_dispatching: { text: colors.info[600], background: colors.info[50] },
  owner_dispatched: { text: colors.info[600], background: colors.info[50] },

  // ── Negative / terminal ───────────────────────────────────────────────────
  rejected: { text: colors.error[600], background: colors.error[50] },
  failed: { text: colors.error[600], background: colors.error[50] },
  overdue: { text: colors.error[600], background: colors.error[50] },
  declined: { text: colors.error[600], background: colors.error[50] },
  expired: { text: colors.error[600], background: colors.error[50] },
  terminated: { text: colors.error[600], background: colors.error[50] },
  early_terminated: { text: colors.error[600], background: colors.error[50] },
  eviction: { text: colors.error[600], background: colors.error[50] },

  // ── Neutral / cancelled ───────────────────────────────────────────────────
  cancelled: { text: colors.gray[500], background: colors.gray[100] },
  withdrawn: { text: colors.gray[500], background: colors.gray[100] },
  no_show: { text: colors.gray[500], background: colors.gray[100] },
  partial: { text: colors.gray[500], background: colors.gray[100] },
};

const FALLBACK: StatusColorSet = { text: colors.gray[500], background: colors.gray[100] };

export function getStatusColors(status: string): StatusColorSet {
  return STATUS_COLORS[status] ?? FALLBACK;
}

export function getStatusTextColor(status: string): string {
  return getStatusColors(status).text;
}

export function getStatusBackgroundColor(status: string): string {
  return getStatusColors(status).background;
}
