import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { AnimatedButton } from './AnimatedButton';

const RSA = { blue: '#002395', gold: '#FFB81C' };

interface PortfolioCardProps {
  userName: string;
  totalUnits: number;
  occupied: number;
  vacant: number;
  monthIncome: number;
  arrears: number;
}

export const PortfolioCard = ({ userName, totalUnits, occupied, vacant, monthIncome, arrears }: PortfolioCardProps) => {
  const router = useRouter();

  return (
    <LinearGradient colors={[RSA.blue, '#001170']} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🏢</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.title}>My Portfolio</Text>
          <Text style={styles.stats}>Units: {totalUnits} | Occupied: {occupied} | Vacant: {vacant}</Text>
        </View>
      </View>
      <View style={styles.amounts}>
        <View>
          <Text style={styles.label}>Monthly Rent</Text>
          <Text style={styles.value}>R {monthIncome.toLocaleString()}</Text>
        </View>
        <View>
          <Text style={styles.label}>In Arrears</Text>
          <Text style={[styles.value, { color: RSA.gold }]}>R {arrears.toLocaleString()}</Text>
        </View>
      </View>
      <View style={styles.buttons}>
        <AnimatedButton style={styles.button} onPress={() => router.push('/(owner)/properties')}>
          <View style={styles.buttonInner}>
            <Text style={styles.buttonText}>View Properties</Text>
          </View>
        </AnimatedButton>
        <AnimatedButton style={styles.button} onPress={() => router.push('/(owner)/rent-roll' as any)}>
          <View style={styles.buttonInner}>
            <Text style={styles.buttonText}>Rent Roll</Text>
          </View>
        </AnimatedButton>
        <AnimatedButton style={styles.button} onPress={() => router.push('/(owner)/add-property')}>
          <View style={styles.buttonInner}>
            <Text style={styles.buttonText}>+ Add Property</Text>
          </View>
        </AnimatedButton>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 20, marginBottom: 20 },
  header: { flexDirection: 'row', marginBottom: 16 },
  iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  stats: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  amounts: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  label: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  value: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginTop: 4 },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1 },
  buttonInner: { backgroundColor: 'rgba(255,255,255,0.9)', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontSize: 10, fontWeight: '700', color: RSA.blue },
});
