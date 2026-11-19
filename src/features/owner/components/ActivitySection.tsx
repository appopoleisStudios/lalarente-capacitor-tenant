import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AnimatedButton } from '@/src/shared/components';

interface Activity {
  icon: string;
  label: string;
  value: string;
  date: string;
  route: string;
}

interface ActivitySectionProps {
  activities: Activity[];
}

export const ActivitySection = ({ activities }: ActivitySectionProps) => {
  return (
    <View>
      {/* No "View All": there is no full activity screen, and the button did
          nothing (CT7-056). */}
      <View style={styles.header}>
        <Text style={styles.title}>Recent Activity</Text>
      </View>
      <View style={styles.card}>
        {activities.map((a, i) => (
          <AnimatedButton
            key={i}
            testID={`owner-activity-${i}`}
            style={styles.item}
            onPress={() => router.push(a.route as never)}
          >
            <View style={styles.itemInner}>
              <View style={styles.iconContainer}>
                <Text>{a.icon}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.label}>{a.label}</Text>
                <Text style={styles.value}>{a.value}</Text>
              </View>
              <Text style={styles.date}>{a.date}</Text>
            </View>
          </AnimatedButton>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    elevation: 1,
  },
  item: { marginBottom: 14 },
  itemInner: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#111827' },
  value: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  date: { fontSize: 10, color: '#9ca3af' },
});
