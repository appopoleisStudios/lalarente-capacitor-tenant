import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ListItemProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  disabled?: boolean;
  style?: ViewStyle;
}

const BADGE_VARIANTS: Record<string, { bg: string; text: string }> = {
  default: { bg: '#F1F5F9', text: '#475569' },
  success: { bg: '#D1FAE5', text: '#065F46' },
  warning: { bg: '#FEF3C7', text: '#92400E' },
  error: { bg: '#FEE2E2', text: '#991B1B' },
  info: { bg: '#DBEAFE', text: '#1E40AF' },
};

export function ListItem({
  title,
  subtitle,
  leftIcon,
  rightIcon = 'chevron-forward',
  onPress,
  badge,
  badgeVariant = 'default',
  disabled = false,
  style,
}: ListItemProps) {
  const content = (
    <View style={[styles.container, disabled && styles.disabled, style]}>
      {leftIcon && (
        <View style={styles.leftIcon}>
          <Ionicons name={leftIcon} size={22} color="#737373" />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {badge && (
        <View style={[styles.badge, { backgroundColor: BADGE_VARIANTS[badgeVariant]?.bg ?? '#F1F5F9' }]}>
          <Text style={[styles.badgeText, { color: BADGE_VARIANTS[badgeVariant]?.text ?? '#475569' }]}>
            {badge}
          </Text>
        </View>
      )}
      {rightIcon && onPress && (
        <Ionicons name={rightIcon} size={18} color="#A3A3A3" style={styles.rightArrow} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 44,
  },
  disabled: {
    opacity: 0.5,
  },
  leftIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171717',
  },
  subtitle: {
    fontSize: 13,
    color: '#737373',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rightArrow: {
    marginLeft: 8,
  },
});
