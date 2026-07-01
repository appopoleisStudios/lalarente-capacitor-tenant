import React, { useState } from 'react';
import {
  ScrollView as RNScrollView,
  RefreshControl,
  ScrollViewProps,
} from 'react-native';

interface CustomScrollViewProps extends ScrollViewProps {
  onRefresh?: () => Promise<void>;
}

export const ScrollView: React.FC<CustomScrollViewProps> = ({
  children,
  onRefresh,
  className = '',
  ...props
}) => {
  const [refreshing, setRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };
  
  return (
    <RNScrollView
      className={className}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007A4D"
            colors={['#007A4D']}
          />
        ) : undefined
      }
      {...props}
    >
      {children}
    </RNScrollView>
  );
};
