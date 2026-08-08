import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedButton } from '@/src/shared/components';

interface Document {
  name: string;
  icon: string;
  type: string;
  info: string;
  /** Plane #81 — docs with actionable counts render in the Needs-attention list. */
  attention?: boolean;
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
      case 'inspections':
        router.push('/(owner)/inspections' as any);
        break;
      case 'applications':
        router.push('/(owner)/applications' as any);
        break;
      case 'statements':
        router.push('/(owner)/statements' as any);
        break;
      default:
        break;
    }
  };

  const attentionDocs = documents.filter((d) => d.attention);
  const allDocs = documents.filter((d) => !d.attention);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <AnimatedButton
          testID="documents-see-all"
          onPress={() => router.push('/(owner)/documents' as any)}
        >
          <Text style={styles.seeAll}>See All</Text>
        </AnimatedButton>
      </View>

      {/* Needs attention — docs with actionable counts (Plane #81) */}
      {attentionDocs.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Needs attention</Text>
          <View style={styles.attentionList}>
            {attentionDocs.map((doc) => (
              <AnimatedButton
                key={doc.type}
                style={styles.attentionRow}
                accessibilityLabel={doc.name}
                onPress={() => handleDocumentPress(doc.type)}
              >
                <View style={styles.attentionIconBox}>
                  <Ionicons name={doc.icon as any} size={18} color="#002395" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attentionName} accessible={false}>
                    {doc.name}
                  </Text>
                  <Text style={styles.attentionInfo} accessible={false}>
                    {doc.info}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </AnimatedButton>
            ))}
          </View>
        </>
      )}

      {/* All documents — compact grid, every destination still reachable */}
      {allDocs.length > 0 && <Text style={styles.sectionLabel}>All documents</Text>}
      {allDocs.length > 0 && (
        <View style={styles.grid}>
          {allDocs.map((doc) => (
            <AnimatedButton
              key={doc.type}
              style={styles.card}
              accessibilityLabel={doc.name}
              onPress={() => handleDocumentPress(doc.type)}
            >
              <View style={styles.cardInner}>
                <View style={styles.iconBox}>
                  <Ionicons name={doc.icon as any} size={18} color="#002395" />
                </View>
                <Text style={styles.name} numberOfLines={2} accessible={false}>
                  {doc.name}
                </Text>
              </View>
            </AnimatedButton>
          ))}
        </View>
      )}
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
  seeAll: { fontSize: 13, fontWeight: '600', color: '#002395' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  attentionList: { gap: 8, marginBottom: 16 },
  attentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    padding: 12,
    gap: 10,
  },
  attentionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  attentionInfo: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: { width: '47%' },
  cardInner: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 11, fontWeight: '600', color: '#111827', flex: 1 },
});
