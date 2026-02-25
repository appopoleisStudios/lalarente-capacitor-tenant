import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedButton } from './AnimatedButton';

interface Document {
  name: string;
  icon: string;
  type: string;
  info: string;
}

interface DocumentsSectionProps {
  documents: Document[];
}

export const DocumentsSection = ({ documents }: DocumentsSectionProps) => {
  const router = useRouter();

  const handleDocumentPress = (docType: string) => {
    switch (docType) {
      case 'leases':
      case 'active-leases':
      case 'past-leases':
        // Signed lease contracts are per-tenant — go to tenants list to find & download
        router.push('/(owner)/tenants' as any);
        break;
      case 'invoices':
      case 'recent-invoices':
        // Rent + vendor invoices combined
        router.push('/(owner)/invoices' as any);
        break;
      case 'quotes':
      case 'pending-quotes':
        // Vendor quotes are on maintenance requests awaiting approval
        router.push('/(owner)/maintenance' as any);
        break;
      case 'tax':
        // SARS tax year summary — ITR12 rental income
        router.push('/(owner)/tax-reports' as any);
        break;
      case 'compliance':
        // FICA tenant KYC + property compliance certificates
        router.push('/(owner)/compliance' as any);
        break;
      case 'deposits':
        router.push('/(owner)/deposits' as any);
        break;
      case 'holding-deposit':
        router.push('/(owner)/holding-deposit' as any);
        break;
      case 'renewals':
        router.push('/(owner)/renewals' as any);
        break;
      case 'insurance':
        router.push('/(owner)/insurance' as any);
        break;
      case 'payment-disputes':
        router.push('/(owner)/payment-disputes' as any);
        break;
      default:
        break;
    }
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>My Documents</Text>
        <AnimatedButton onPress={() => router.push('/(owner)/tenants' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </AnimatedButton>
      </View>
      <View style={styles.grid}>
        {documents.map((doc) => (
          <AnimatedButton
            key={doc.type}
            style={styles.card}
            onPress={() => handleDocumentPress(doc.type)}
          >
            <View style={styles.cardInner}>
              <Text style={styles.icon}>{doc.icon}</Text>
              <Text style={styles.name} numberOfLines={2}>{doc.name}</Text>
              <Text style={styles.info}>{doc.info}</Text>
            </View>
          </AnimatedButton>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, marginTop: 8 },
  title: { fontSize: 16, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#002395' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: { width: '31%' },
  cardInner: { backgroundColor: '#ffffff', borderRadius: 12, padding: 10, alignItems: 'center', minHeight: 100, elevation: 1 },
  icon: { fontSize: 22, marginBottom: 6 },
  name: { fontSize: 10, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 4 },
  info: { fontSize: 9, color: '#6b7280', textAlign: 'center' },
});
