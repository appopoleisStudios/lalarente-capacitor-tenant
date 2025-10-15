import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  visible: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', visible }) => {
  if (!visible) return null;
  
  return (
    <Animated.View 
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={[styles.container, styles[type]]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 8,
    zIndex: 1000,
  },
  success: {
    backgroundColor: '#10b981',
  },
  error: {
    backgroundColor: '#ef4444',
  },
  info: {
    backgroundColor: '#3b82f6',
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
