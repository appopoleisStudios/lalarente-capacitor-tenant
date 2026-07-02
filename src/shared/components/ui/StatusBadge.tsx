import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface StatusBadgeProps {
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed' | string;
  size?: 'small' | 'medium';
  label?: string;
  customConfig?: { bg: string; text: string; label: string };
}

const DEFAULT_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: 'Open', bg: '#FEF3C7', text: '#92400E' },
  assigned: { label: 'Assigned', bg: '#DBEAFE', text: '#1E40AF' },
  in_progress: { label: 'In Progress', bg: '#FDE68A', text: '#B45309' },
  completed: { label: 'Completed', bg: '#D1FAE5', text: '#065F46' },
  closed: { label: 'Closed', bg: '#F1F5F9', text: '#475569' },
  approved: { label: 'Approved', bg: '#D1FAE5', text: '#065F46' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', text: '#991B1B' },
  pending: { label: 'Pending', bg: '#FEF3C7', text: '#92400E' },
  active: { label: 'Active', bg: '#DBEAFE', text: '#1E40AF' },
  draft: { label: 'Draft', bg: '#F1F5F9', text: '#475569' },
};

export function StatusBadge({ status, size = 'medium', label, customConfig }: StatusBadgeProps) {
  const config = customConfig ?? DEFAULT_STATUS_CONFIG[status] ?? {
    label: label ?? status,
    bg: '#F1F5F9',
    text: '#475569',
  };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg },
        size === 'small' && styles.badgeSmall,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: config.text },
          size === 'small' && styles.textSmall,
        ]}
      >
        {label ?? config.label}
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
