import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface PriorityIndicatorProps {
  priority: 'low' | 'medium' | 'high' | string;
  size?: 'small' | 'medium';
  label?: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; bg: string; text: string; dotColor: string }> = {
  low: { label: 'Low', bg: '#D1FAE5', text: '#065F46', dotColor: '#10B981' },
  medium: { label: 'Medium', bg: '#FEF3C7', text: '#92400E', dotColor: '#F59E0B' },
  high: { label: 'High', bg: '#FEE2E2', text: '#991B1B', dotColor: '#EF4444' },
  urgent: { label: 'Urgent', bg: '#FEE2E2', text: '#991B1B', dotColor: '#DC2626' },
};

export function PriorityIndicator({ priority, size = 'medium', label }: PriorityIndicatorProps) {
  const config = PRIORITY_CONFIG[priority] ?? { label: priority, bg: '#F1F5F9', text: '#475569', dotColor: '#A3A3A3' };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg },
        size === 'small' && styles.badgeSmall,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 11,
  },
});
