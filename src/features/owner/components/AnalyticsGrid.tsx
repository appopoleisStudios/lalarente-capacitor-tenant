import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { AnimatedButton } from './AnimatedButton';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 56) / 2; // 2 columns with padding

interface AnalyticsGridProps {
  monthIncome: number;
  currentOccupancy: number;
  tenantsInArrears: number;
  openMaintenance: number;
}

export const AnalyticsGrid = ({
  monthIncome,
  currentOccupancy,
  tenantsInArrears,
  openMaintenance,
}: AnalyticsGridProps) => {
  const cards = [
    { icon: '💰', value: `R ${monthIncome.toLocaleString()}`, label: 'This Month Income' },
    { icon: '📈', value: `${currentOccupancy}%`, label: 'Current Occupancy' },
    { icon: '⏰', value: tenantsInArrears.toString(), label: 'Tenants In Arrears' },
    { icon: '🔧', value: openMaintenance.toString(), label: 'Open Maintenance' },
  ];

  return (
    <View style={styles.grid}>
      {cards.map((card, index) => (
        <AnimatedButton key={index} style={[styles.card, { width: CARD_WIDTH }]}>
          <View style={styles.cardInner}>
            <Text style={styles.icon}>{card.icon}</Text>
            <Text style={styles.value}>{card.value}</Text>
            <Text style={styles.label}>{card.label}</Text>
          </View>
        </AnimatedButton>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  card: { borderRadius: 12, overflow: 'hidden' },
  cardInner: {
    backgroundColor: '#ffffff',
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
  icon: { fontSize: 22, marginBottom: 6 },
  value: { fontSize: 18, fontWeight: '800', color: '#111827' },
  label: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginTop: 4, textAlign: 'center' },
});
