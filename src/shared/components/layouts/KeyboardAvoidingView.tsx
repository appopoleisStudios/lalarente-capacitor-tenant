import React from 'react';
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
  StyleSheet,
  KeyboardAvoidingViewProps,
} from 'react-native';

/**
 * Android draws edge-to-edge (targetSdk 35+), so the window is no longer
 * resized for the keyboard: without a behavior, the lower part of every form
 * sat under the keyboard and could not be scrolled into view (CT7-050/051).
 */
export const KeyboardAvoidingView: React.FC<KeyboardAvoidingViewProps> = ({
  children,
  behavior,
  style,
  ...props
}) => {
  return (
    <RNKeyboardAvoidingView
      behavior={behavior || (Platform.OS === 'ios' ? 'padding' : 'height')}
      style={[styles.flex, style]}
      {...props}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
