import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Text } from './Text';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = '#0ea5e9',
  message,
  fullScreen = false,
}) => {
  const content = (
    <>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text className="mt-4 text-center" color="secondary">
          {message}
        </Text>
      )}
    </>
  );
  
  if (fullScreen) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        {content}
      </View>
    );
  }
  
  return (
    <View className="items-center justify-center p-4">
      {content}
    </View>
  );
};
