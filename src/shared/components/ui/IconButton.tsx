import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color?: string;
  backgroundColor?: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  style?: ViewStyle;
}

export function IconButton({
  name,
  size = 24,
  color = '#525252',
  backgroundColor = 'transparent',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.7}
    >
      <Ionicons name={name} size={size} color={disabled ? '#D4D4D4' : color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
