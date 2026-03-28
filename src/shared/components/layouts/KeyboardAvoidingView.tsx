import React from 'react';
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
  StyleSheet,
  KeyboardAvoidingViewProps,
} from 'react-native';

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
