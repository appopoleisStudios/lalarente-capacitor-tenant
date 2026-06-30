import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';

export interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  variant?: 'circle' | 'rounded' | 'square';
  style?: ViewStyle;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .filter(c => c.match(/[A-Za-z]/))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const COLORS = ['#007A4D', '#002395', '#FFB81C', '#DE3831', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B'];

function getColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({ uri, name = '?', size = 40, variant = 'circle', style }: AvatarProps) {
  const borderRadius = variant === 'circle' ? size / 2 : variant === 'rounded' ? size / 4 : size / 8;
  const backgroundColor = getColorFromName(name);
  const initials = getInitials(name);
  const fontSize = size * 0.4;

  const baseStyle = { width: size, height: size, borderRadius };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, baseStyle, style as any]}
        accessibilityLabel={`${name}'s avatar`}
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
