import React from 'react';
import {
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  Platform,
  KeyboardAvoidingViewProps,
} from 'react-native';

export const KeyboardAvoidingView: React.FC<KeyboardAvoidingViewProps> = ({
  children,
  behavior,
  className = '',
  ...props
}) => {
  return (
    <RNKeyboardAvoidingView
      behavior={behavior || (Platform.OS === 'ios' ? 'padding' : 'height')}
      className={`flex-1 ${className}`}
      {...props}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
};
