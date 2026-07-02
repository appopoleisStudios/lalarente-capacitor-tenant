import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  color?: string;
  spacing?: number;
  style?: ViewStyle;
}

export function Divider({
  orientation = 'horizontal',
  thickness = StyleSheet.hairlineWidth,
  color = '#E5E5E5',
  spacing = 16,
  style,
}: DividerProps) {
  return (
    <View
      style={[
        orientation === 'horizontal' ? styles.horizontal : styles.vertical,
        {
          [orientation === 'horizontal' ? 'height' : 'width']: thickness,
          backgroundColor: color,
          marginVertical: orientation === 'horizontal' ? spacing : 0,
          marginHorizontal: orientation === 'vertical' ? spacing : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  horizontal: {
    alignSelf: 'stretch',
  },
  vertical: {
    alignSelf: 'stretch',
  },
});
