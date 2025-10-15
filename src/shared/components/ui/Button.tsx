import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onPress,
  children,
  className = '',
}) => {
  const baseClasses = 'rounded-lg items-center justify-center flex-row';
  
  const variantClasses = {
    primary: 'bg-primary-500 active:bg-primary-600',
    secondary: 'bg-gray-200 active:bg-gray-300',
    outline: 'border-2 border-primary-500 bg-transparent',
    ghost: 'bg-transparent',
  };
  
  const sizeClasses = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3',
    lg: 'px-8 py-4',
  };
  
  const textVariantClasses = {
    primary: 'text-white',
    secondary: 'text-gray-900',
    outline: 'text-primary-500',
    ghost: 'text-primary-500',
  };
  
  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };
  
  const disabledClasses = disabled || loading ? 'opacity-50' : '';
  
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`}
      accessible={true}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator 
          color={variant === 'primary' ? 'white' : '#0ea5e9'} 
          size="small"
        />
      ) : (
        <Text className={`font-semibold ${textVariantClasses[variant]} ${textSizeClasses[size]}`}>
          {children}
        </Text>
      )}
    </Pressable>
  );
};
