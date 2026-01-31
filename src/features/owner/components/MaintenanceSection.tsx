import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedButton } from './AnimatedButton';

const RSA = { blue: '#002395', green: '#007A4D' };

interface Maintenance {
  id?: string;
  title: string;
  unit: string;
  status: string;
  quote?: number | null;
  invoice?: number | null;
}

interface MaintenanceSectionProps {
  maintenance: Maintenance[];
}

export const MaintenanceSection = ({ maintenance }: MaintenanceSectionProps) => {
  const router = useRouter();

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Active Maintenance</Text>
        <AnimatedButton onPress={() => router.push('/(owner)/maintenance' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </AnimatedButton>
      </View>
      {maintenance.map((m, i) => (
        <AnimatedButton
          key={i}
          style={styles.card}
          onPress={() => m.id && router.push(`/(owner)/maintenance/${m.id}` as any)}
        >
          <View style={styles.cardInner}>
            <View style={styles.left}>
              <View style={styles.iconContainer}><Text>🔧</Text></View>
              <View>
                <Text style={styles.cardTitle}>{m.title}</Text>
                <Text style={styles.unit}>{m.unit}</Text>
              </View>
            </View>
            <View style={styles.right}>
              {m.quote && <Text style={styles.quote}>Quote: R {m.quote}</Text>}
              {m.invoice && <Text style={styles.invoice}>Invoice: R {m.invoice}</Text>}
              <View style={[styles.status, { backgroundColor: m.status === 'Open' ? '#fef3c7' : '#dbeafe' }]}>
                <Text style={[styles.statusText, { color: m.status === 'Open' ? '#92400e' : '#1e40af' }]}>{m.status}</Text>
              </View>
            </View>
          </View>
        </AnimatedButton>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, fontWeight: '600', color: RSA.blue },
  card: { marginBottom: 8 },
  cardInner: { backgroundColor: '#ffffff', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconContainer: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#111827' },
  unit: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  quote: { fontSize: 11, fontWeight: '600', color: RSA.blue },
  invoice: { fontSize: 11, fontWeight: '600', color: RSA.green, marginTop: 2 },
  status: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  statusText: { fontSize: 9, fontWeight: '600' },
});
