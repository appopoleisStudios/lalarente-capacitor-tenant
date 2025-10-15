import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function MaintenanceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maintenance</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.icon}>🔧</Text>
        <Text style={styles.title}>Maintenance Requests</Text>
        <Text style={styles.subtitle}>Coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280' },
});
