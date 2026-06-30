import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

export interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function FormField({ label, required, error, hint, children, style }: FormFieldProps) {
  return (
    <View style={[styles.container, style]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      {children}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#404040',
    marginBottom: 6,
  },
  required: {
    color: '#DE3831',
  },
  hint: {
    fontSize: 12,
    color: '#A3A3A3',
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: '#DE3831',
    marginTop: 4,
  },
});
