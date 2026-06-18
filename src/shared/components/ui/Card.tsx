import React from 'react';
import { View, Pressable } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Card: React.FC<CardProps> = ({ children, onPress, className = '', accessibilityLabel, accessibilityHint }) => {
  const baseClasses = 'bg-white rounded-lg p-4 shadow-sm border border-gray-200';
  
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${baseClasses} active:bg-gray-50 ${className}`}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </Pressable>
    );
  }
  
  return (
    <View className={`${baseClasses} ${className}`}>
      {children}
    </View>
  );
};
