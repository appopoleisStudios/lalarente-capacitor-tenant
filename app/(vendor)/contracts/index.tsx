import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/src/shared/theme/colors';

export default function VendorContractsList() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Contracts</Text>
      <Text style={styles.subtitle}>Coming soon...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.default,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});
