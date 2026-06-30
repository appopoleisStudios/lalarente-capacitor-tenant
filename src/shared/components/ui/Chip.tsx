import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  variant?: 'default' | 'primary' | 'outline';
  size?: 'small' | 'medium';
  style?: ViewStyle;
}

export function Chip({
  label,
  selected = false,
  onPress,
  variant = selected ? 'primary' : 'outline',
  size = 'medium',
  style,
}: ChipProps) {
  const variantStyles = {
    default: { bg: '#F1F5F9', text: '#475569', border: '#F1F5F9' },
    primary: { bg: '#007A4D', text: '#FFFFFF', border: '#007A4D' },
    outline: { bg: 'transparent', text: '#525252', border: '#D4D4D4' },
  };

  const resolved = selected ? variantStyles.primary : variantStyles[variant];

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        { backgroundColor: resolved.bg, borderColor: resolved.border },
        size === 'small' && styles.chipSmall,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <Text
        style={[
          styles.text,
          { color: resolved.text },
          size === 'small' && styles.textSmall,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
  textSmall: {
    fontSize: 11,
  },
});
