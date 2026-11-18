import React from 'react';
import { StatusBar, type StatusBarStyle } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';

/**
 * Overrides the app-wide dark status-bar icons (app/_layout.tsx) while this
 * screen is focused — for screens with a dark top area. Rendered only while
 * focused, so the override is popped as soon as the user navigates away, even
 * from tab routes that stay mounted in the background (CT7-049).
 */
export function FocusedStatusBar({ style }: { style: StatusBarStyle }) {
  const isFocused = useIsFocused();
  return isFocused ? <StatusBar style={style} /> : null;
}
