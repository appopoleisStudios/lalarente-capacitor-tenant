import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

export interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<string, { bg: string; text: string }> = {
  default: { bg: '#F1F5F9', text: '#475569' },
  success: { bg: colors.success[50], text: colors.success[700] },
  warning: { bg: colors.warning[50], text: colors.warning[700] },
  error: { bg: colors.error[50], text: colors.error[700] },
  info: { bg: colors.info[50], text: colors.info[700] },
};

export function Badge({ label, variant = 'default', size = 'medium', style }: BadgeProps) {
  const variantStyle = VARIANT_STYLES[variant];

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: variantStyle.bg },
        size === 'small' && styles.badgeSmall,
        style,
      ]}
    >
      <Text style={[styles.text, { color: variantStyle.text }, size === 'small' && styles.textSmall]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  textSmall: {
    fontSize: 10,
  },
});
