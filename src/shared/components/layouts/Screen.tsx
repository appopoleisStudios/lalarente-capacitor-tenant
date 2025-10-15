import React from 'react';
import { View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenProps extends ViewProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
  className?: string;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  useSafeArea = true,
  className = '',
  ...props
}) => {
  const baseClasses = `flex-1 bg-white ${className}`;
  
  if (useSafeArea) {
    return (
      <SafeAreaView className={baseClasses} {...props}>
        {children}
      </SafeAreaView>
    );
  }
  
  return (
    <View className={baseClasses} {...props}>
      {children}
    </View>
  );
};
