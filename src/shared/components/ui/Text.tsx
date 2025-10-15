import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';

interface TextProps extends RNTextProps {
  variant?: 'heading' | 'subheading' | 'body' | 'caption';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'error' | 'success';
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  weight = 'normal',
  color = 'primary',
  className = '',
  ...props
}) => {
  const variantClasses = {
    heading: 'text-2xl',
    subheading: 'text-xl',
    body: 'text-base',
    caption: 'text-sm',
  };
  
  const weightClasses = {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };
  
  const colorClasses = {
    primary: 'text-gray-900',
    secondary: 'text-gray-600',
    tertiary: 'text-gray-400',
    inverse: 'text-white',
    error: 'text-error-500',
    success: 'text-success-500',
  };
  
  return (
    <RNText
      className={`${variantClasses[variant]} ${weightClasses[weight]} ${colorClasses[color]} ${className}`}
      {...props}
    />
  );
};

export const Heading: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="heading" weight="bold" {...props} />
);

export const Body: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="body" {...props} />
);

export const Caption: React.FC<Omit<TextProps, 'variant'>> = (props) => (
  <Text variant="caption" color="secondary" {...props} />
);
