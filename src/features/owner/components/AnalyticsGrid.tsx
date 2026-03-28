import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  const router = useRouter();

  const cards = [
    {
      icon: 'cash-outline' as const,
      iconColor: '#007A4D',
      iconBg: '#D1FAE5',
      value: `R ${monthIncome.toLocaleString()}`,
      label: 'This Month Income',
      route: '/(owner)/rent-roll' as const,
    },
    {
      icon: 'home-outline' as const,
      iconColor: '#002395',
      iconBg: '#DBEAFE',
      value: `${currentOccupancy}%`,
      label: 'Current Occupancy',
      route: '/(owner)/properties' as const,
    },
    {
      icon: 'alert-circle-outline' as const,
      iconColor: '#DE3831',
      iconBg: '#FEE2E2',
      value: tenantsInArrears.toString(),
      label: 'Tenants In Arrears',
      route: '/(owner)/arrears' as const,
    },
    {
      icon: 'construct-outline' as const,
      iconColor: '#B45309',
      iconBg: '#FEF3C7',
      value: openMaintenance.toString(),
      label: 'Open Maintenance',
      route: '/(owner)/maintenance' as const,
    },
  ];

  return (
    <View style={styles.grid}>
      {cards.map((card, index) => (
        <AnimatedButton
          key={index}
          style={[styles.card, { width: CARD_WIDTH }]}
          onPress={() => router.push(card.route as any)}
        >
          <View style={styles.cardInner}>
            <View style={[styles.iconBox, { backgroundColor: card.iconBg }]}>
              <Ionicons name={card.icon} size={20} color={card.iconColor} />
            </View>
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
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: { fontSize: 18, fontWeight: '800', color: '#111827' },
  label: { fontSize: 11, fontWeight: '600', color: '#6b7280', marginTop: 4, textAlign: 'center' },
});
