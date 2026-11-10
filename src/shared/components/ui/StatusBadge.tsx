import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusColors } from '@/src/shared/utils/statusColors';

export interface StatusBadgeProps {
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | string;
  size?: 'small' | 'medium';
  label?: string;
  customConfig?: { bg: string; text: string; label: string };
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
  approved: 'Approved',
  rejected: 'Rejected',
  pending: 'Pending',
  active: 'Active',
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  resolved: 'Resolved',
  executed: 'Executed',
  paid: 'Paid',
  failed: 'Failed',
  overdue: 'Overdue',
  declined: 'Declined',
  expired: 'Expired',
  terminated: 'Terminated',
  early_terminated: 'Early Terminated',
  eviction: 'Eviction',
  cancelled: 'Cancelled',
  withdrawn: 'Withdrawn',
  no_show: 'No Show',
  partial: 'Partial',
  mediation: 'Mediation',
  escalated: 'Escalated',
  pending_signatures: 'Pending Signatures',
  pending_verification: 'Pending Verification',
  pending_closure: 'Pending Closure',
  cure_period: 'Cure Period',
  awaiting_owner_dispatch: 'Awaiting Dispatch',
  tenant_dispatching: 'Tenant Dispatching',
  owner_dispatched: 'Owner Dispatched',
};

export function StatusBadge({ status, size = 'medium', label, customConfig }: StatusBadgeProps) {
  const colors = customConfig
    ? { background: customConfig.bg, text: customConfig.text }
    : getStatusColors(status);

  const displayLabel = label ?? customConfig?.label ?? STATUS_LABELS[status] ?? status;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.background },
        size === 'small' && styles.badgeSmall,
      ]}
    >
      <Text style={[styles.text, { color: colors.text }, size === 'small' && styles.textSmall]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
});
