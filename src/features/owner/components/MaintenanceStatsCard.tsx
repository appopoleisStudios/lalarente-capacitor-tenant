import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnimatedButton } from './AnimatedButton';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 56) / 2;

interface MaintenanceStatsCardProps {
  openCount: number;
  assignedCount: number;
  inProgressCount: number;
  completedCount: number;
}

export const MaintenanceStatsCard = ({
  openCount,
  assignedCount,
  inProgressCount,
  completedCount,
}: MaintenanceStatsCardProps) => {
  const stats = [
    { icon: '🔴', value: openCount.toString(), label: 'Open Requests', color: '#fef3c7' },
    { icon: '👷', value: assignedCount.toString(), label: 'Assigned', color: '#dbeafe' },
    { icon: '⚡', value: inProgressCount.toString(), label: 'In Progress', color: '#fde68a' },
    { icon: '✅', value: completedCount.toString(), label: 'Completed', color: '#d1fae5' },
  ];

  return (
    <View style={styles.grid}>
      {stats.map((stat, index) => (
        <Animated.View 
          key={index} 
          entering={FadeInDown.delay(100 + index * 50).duration(500)}
          style={[styles.card, { width: CARD_WIDTH }]}
        >
          <AnimatedButton>
            <View style={[styles.cardInner, { backgroundColor: stat.color }]}>
              <Text style={styles.icon}>{stat.icon}</Text>
              <Text style={styles.value}>{stat.value}</Text>
              <Text style={styles.label}>{stat.label}</Text>
            </View>
          </AnimatedButton>
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 14,
    alignItems: 'center',
    minHeight: 110,
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  icon: {
    fontSize: 28,
    marginBottom: 6,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
});
