import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed';
  size?: 'small' | 'medium';
}

const STATUS_CONFIG = {
  open: {
    label: 'Open',
    bg: '#FEF3C7',
    text: '#92400E',
  },
  assigned: {
    label: 'Assigned',
    bg: '#DBEAFE',
    text: '#1E40AF',
  },
  in_progress: {
    label: 'In Progress',
    bg: '#FDE68A',
    text: '#B45309',
  },
  completed: {
    label: 'Completed',
    bg: '#D1FAE5',
    text: '#065F46',
  },
  closed: {
    label: 'Closed',
    bg: '#F1F5F9',
    text: '#475569',
  },
};

export function StatusBadge({ status, size = 'medium' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  
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
        {config.label}
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
