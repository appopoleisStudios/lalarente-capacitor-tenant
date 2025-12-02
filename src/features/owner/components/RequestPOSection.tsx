import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

const RSA = { blue: '#002395' };

interface RequestPOSectionProps {
  purchaseOrder: any;
  requestId: string;
  onPress: () => void;
}

export function RequestPOSection({ purchaseOrder, requestId, onPress }: RequestPOSectionProps) {
  if (!purchaseOrder) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Purchase Order</Text>
        <Text style={[styles.sectionBadge, { backgroundColor: colors.success[50], color: colors.success[700] }]}>
          Issued
        </Text>
      </View>
      <TouchableOpacity style={styles.poCard} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.poHeader}>
          <Ionicons name="document-text" size={32} color={RSA.blue} />
          <View style={styles.poInfo}>
            <Text style={styles.poNumber}>{purchaseOrder.po_number}</Text>
            <Text style={styles.poAmount}>R {purchaseOrder.total_amount?.toLocaleString() || '0'}</Text>

            {/* Contract Reference */}
            {purchaseOrder.contract && (
              <View style={styles.poContractRef}>
                <Ionicons name="link-outline" size={14} color={colors.gray[500]} />
                <Text style={styles.poContractText}>
                  Contract: {purchaseOrder.contract.contract_number}
                </Text>
              </View>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  poCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  poHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  poInfo: {
    flex: 1,
  },
  poNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[600],
    marginBottom: 4,
  },
  poAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: RSA.blue,
    marginBottom: 4,
  },
  poContractRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  poContractText: {
    fontSize: 12,
    color: colors.gray[600],
  },
});
