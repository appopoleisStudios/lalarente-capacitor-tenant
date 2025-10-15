import React from 'react';
import { View, Pressable } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ children, onPress, className = '' }) => {
  const baseClasses = 'bg-white rounded-lg p-4 shadow-sm border border-gray-200';
  
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${baseClasses} active:bg-gray-50 ${className}`}
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
