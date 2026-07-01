import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  variant?: 'circle' | 'rounded' | 'square';
  style?: ViewStyle | ImageStyle;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  return parts
    .map(word => word.charAt(0))
    .filter(c => /[A-Za-z]/.test(c))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = ['#007A4D', '#002395', '#FFB81C', '#DE3831', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B'] as const;

type AvatarColor = (typeof AVATAR_COLORS)[number];

function getColorFromName(name: string): AvatarColor {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function Avatar({ uri, name, size = 40, variant = 'circle', style }: AvatarProps) {
  const displayName = name ?? '?';
  const borderRadius = variant === 'circle' ? size / 2 : variant === 'rounded' ? size / 4 : size / 8;
  const backgroundColor = getColorFromName(displayName);
  const initials = getInitials(displayName);
  const fontSize = size * 0.4;

  const baseStyle = { width: size, height: size, borderRadius };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, baseStyle, style as ImageStyle]}
        accessibilityLabel={`${displayName}'s avatar`}
      />
    );
  }

  return (
    <View
      style={[styles.placeholder, baseStyle, { backgroundColor }, style]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
