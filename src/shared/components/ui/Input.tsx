import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  containerClassName = '',
  className = '',
  ...props
}) => {
  return (
    <View className={`mb-4 ${containerClassName}`}>
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-2">
          {label}
        </Text>
      )}
      
      <View 
        className={`flex-row items-center border rounded-lg px-4 py-3 ${
          error ? 'border-error-500' : 'border-gray-300'
        }`}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        
        <TextInput
          className={`flex-1 text-base text-gray-900 ${className}`}
          placeholderTextColor="#a3a3a3"
          {...props}
        />
        
        {rightIcon && <View className="ml-2">{rightIcon}</View>}
      </View>
      
      {error && (
        <Text className="text-sm text-error-500 mt-1">{error}</Text>
      )}
    </View>
  );
};
