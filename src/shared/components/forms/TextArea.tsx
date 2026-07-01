import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle } from 'react-native';

export interface TextAreaProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  inputStyle?: ViewStyle;
  maxLength?: number;
  showCount?: boolean;
}

export function TextArea({
  label,
  error,
  containerStyle,
  inputStyle,
  maxLength,
  showCount,
  value,
  onChangeText,
  placeholder = 'Enter text...',
  ...props
}: TextAreaProps) {
  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A3A3A3"
          multiline
          textAlignVertical="top"
          maxLength={maxLength}
          {...props}
        />
      </View>
      <View style={styles.footer}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View />
        )}
        {showCount && maxLength && (
          <Text style={styles.countText}>
            {value?.length ?? 0}/{maxLength}
          </Text>
        )}
      </View>
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
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  inputError: {
    borderColor: '#DE3831',
  },
  input: {
    minHeight: 100,
    maxHeight: 200,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#171717',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#DE3831',
  },
  countText: {
    fontSize: 12,
    color: '#A3A3A3',
  },
});
