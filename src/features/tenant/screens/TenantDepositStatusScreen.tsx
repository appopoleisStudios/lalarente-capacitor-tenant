/**
 * Tenant Deposit Status Screen
 *
 * RHA s5(3): Deposit must earn interest at the prescribed savings rate.
 * All interest belongs to the tenant.
 * RHA s5(7): Refund within 7/14/21 days after lease termination.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { depositInterestApi, DepositInterestSummary } from '@/src/features/deposits/api/depositInterest.api';
import { depositRefundApi, DepositRefundStatus } from '@/src/features/deposits/api/depositRefund.api';
import { colors } from '@/src/shared/theme/colors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatZAR = (amount: number) =>
  `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REFUND_STATUSES: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  not_applicable: { label: 'Lease Active', color: colors.rsa.green, bg: '#E6F7F0', icon: 'checkmark-circle' },
  pending_inspection: { label: 'Awaiting Inspection', color: '#D97706', bg: '#FEF3C7', icon: 'search' },
  deductions_proposed: { label: 'Deductions Proposed', color: colors.rsa.blue, bg: '#E6EBF5', icon: 'document-text' },
  refunded: { label: 'Refunded', color: '#6B7280', bg: '#F3F4F6', icon: 'checkmark-done-circle' },
  overdue: { label: 'OVERDUE — Contact Landlord', color: colors.rsa.red, bg: '#FEF2F2', icon: 'alert-circle' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TenantDepositStatusScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leaseId, setLeaseId] = useState<string | null>(null);
  const [propertyTitle, setPropertyTitle] = useState('');
  const [interest, setInterest] = useState<DepositInterestSummary | null>(null);
  const [refund, setRefund] = useState<DepositRefundStatus | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadDepositStatus();
    }, [])
  );

  const loadDepositStatus = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get most recent lease with a deposit
      const { data: lease, error } = await supabase
        .from('leases')
        .select(`
          id,
          property:properties!property_id(title)
        `)
        .eq('tenant_id', user.id)
        .gt('deposit_amount', 0)
        .in('status', ['active', 'renewal_pending', 'terminated', 'expired'])
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!lease) {
        setLoading(false);
        return;
      }

      setLeaseId(lease.id);
      setPropertyTitle((lease.property as any)?.title || 'Your Property');

      // Load interest history and refund status in parallel
      const [interestData, refundData] = await Promise.all([
        depositInterestApi.getInterestHistory(lease.id),
        depositRefundApi.getRefundStatus(lease.id),
      ]);

      setInterest(interestData);
      setRefund(refundData);
    } catch (err: any) {
      console.error('Error loading deposit status:', err);
      Alert.alert('Error', 'Failed to load deposit information');
    } finally {
      setLoading(false);
    }
  };

  const handleDisputeDeduction = (deductionId: string) => {
    Alert.alert(
      'Dispute Deduction',
      'Do you want to dispute this deduction? Please provide a reason.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Dispute',
          style: 'destructive',
          onPress: async () => {
            try {
              await depositRefundApi.respondToDeduction(
                deductionId,
                false,
                'I dispute this deduction'
              );
              Alert.alert('Disputed', 'Your dispute has been recorded. The landlord will be notified.');
              loadDepositStatus();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to dispute deduction');
            }
          },
        },
      ]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Deposit Status</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (!interest || !refund) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Deposit Status</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="wallet-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Deposit Found</Text>
          <Text style={styles.emptySubtitle}>
            Your deposit information will appear here once your lease is active
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const refundStatusKey = refund.isOverdue && refund.status !== 'refunded'
    ? 'overdue'
    : (refund.status || 'not_applicable');
  const statusInfo = REFUND_STATUSES[refundStatusKey] || REFUND_STATUSES.not_applicable;
  const interestPercent = interest.depositAmount > 0
    ? ((interest.totalInterest / interest.depositAmount) * 100).toFixed(2)
    : '0.00';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Deposit Status</Text>
          <Text style={styles.subtitle}>{propertyTitle}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusInfo.bg }]}>
          <Ionicons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
          <Text style={[styles.statusBannerText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>

        {/* Deposit Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Principal</Text>
              <Text style={styles.balanceAmount}>{formatZAR(interest.depositAmount)}</Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>Interest Earned</Text>
              <Text style={[styles.balanceAmount, { color: colors.rsa.green }]}>
                + {formatZAR(interest.totalInterest)}
              </Text>
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Balance (yours)</Text>
            <Text style={styles.totalAmount}>{formatZAR(interest.currentBalance)}</Text>
          </View>
          <Text style={styles.rateInfo}>
            Interest rate: {(interest.annualRate * 100).toFixed(2)}% p.a. ({interestPercent}% earned to date)
          </Text>
        </View>

        {/* Refund Timeline (if applicable) */}
        {refund.refundDeadline && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Refund Timeline</Text>
            <View style={styles.refundDetail}>
              <View style={styles.refundRow}>
                <Text style={styles.refundLabel}>Refund Deadline</Text>
                <Text style={[styles.refundValue, refund.isOverdue && { color: colors.rsa.red }]}>
                  {new Date(refund.refundDeadline).toLocaleDateString('en-ZA')}
                  {refund.isOverdue ? ' ⚠ Overdue' : ''}
                </Text>
              </View>
              <View style={styles.refundRow}>
                <Text style={styles.refundLabel}>Expected Refund</Text>
                <Text style={[styles.refundValue, { color: colors.rsa.green, fontWeight: '700' }]}>
                  {formatZAR(refund.refundAmount)}
                </Text>
              </View>
            </View>
            {refund.isOverdue && (
              <View style={styles.overdueWarning}>
                <Ionicons name="alert-circle" size={16} color={colors.rsa.red} />
                <Text style={styles.overdueText}>
                  Your refund is overdue. Contact your landlord immediately. You may escalate to the Rental Housing Tribunal (RHT) if unresolved.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Proposed Deductions */}
        {refund.deductions && refund.deductions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Proposed Deductions</Text>
            <Text style={styles.sectionSubtitle}>
              Review each deduction — you have the right to dispute any item
            </Text>
            {refund.deductions.map((d, idx) => (
              <View key={idx} style={styles.deductionCard}>
                <View style={styles.deductionLeft}>
                  <Text style={styles.deductionType}>{d.type.replace(/_/g, ' ')}</Text>
                  <Text style={styles.deductionAmount}>{formatZAR(d.amount)}</Text>
                </View>
                <View style={styles.deductionRight}>
                  {d.status === 'proposed' ? (
                    <TouchableOpacity
                      style={styles.disputeButton}
                      onPress={() => handleDisputeDeduction(idx.toString())}
                    >
                      <Text style={styles.disputeButtonText}>Dispute</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[
                      styles.deductionStatusBadge,
                      { backgroundColor: d.status === 'agreed' ? '#E6F7F0' : '#FEF2F2' }
                    ]}>
                      <Text style={[
                        styles.deductionStatusText,
                        { color: d.status === 'agreed' ? colors.rsa.green : colors.rsa.red }
                      ]}>
                        {d.status}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Interest History */}
        {interest.accruals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Interest History ({(interest.annualRate * 100).toFixed(2)}% p.a.)
            </Text>
            <View style={styles.accrualTable}>
              <View style={[styles.accrualRow, styles.accrualHeader]}>
                <Text style={styles.accrualHeaderText}>Period</Text>
                <Text style={styles.accrualHeaderText}>Interest</Text>
                <Text style={styles.accrualHeaderText}>Cumulative</Text>
              </View>
              {interest.accruals.map((a, i) => (
                <View key={i} style={styles.accrualRow}>
                  <Text style={styles.accrualPeriod}>
                    {new Date(a.periodStart).toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })}
                  </Text>
                  <Text style={[styles.accrualAmount, { color: colors.rsa.green }]}>
                    +{formatZAR(a.interestEarned)}
                  </Text>
                  <Text style={styles.accrualCumulative}>{formatZAR(a.cumulativeInterest)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rights Notice */}
        <View style={styles.legalCard}>
          <Text style={styles.legalTitle}>Your Deposit Rights (RHA)</Text>
          <Text style={styles.legalItem}>• All interest earned belongs to you</Text>
          <Text style={styles.legalItem}>• Refund within 7 days if no damage (14 with inspection)</Text>
          <Text style={styles.legalItem}>• Landlord must justify all deductions in writing</Text>
          <Text style={styles.legalItem}>• Escalate overdue refunds to the Rental Housing Tribunal</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    gap: 12,
  },
  backButton: { padding: 4 },
  headerText: { flex: 1 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 14,
  },
  statusBannerText: {
    fontSize: 15,
    fontWeight: '700',
  },
  balanceCard: {
    backgroundColor: colors.background.default,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  balanceRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  balanceDivider: {
    width: 1,
    backgroundColor: colors.border.default,
    marginHorizontal: 16,
  },
  balanceLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.rsa.green,
  },
  rateInfo: {
    fontSize: 12,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  section: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  refundDetail: { gap: 8 },
  refundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refundLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  refundValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  overdueWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  overdueText: {
    flex: 1,
    fontSize: 13,
    color: colors.rsa.red,
    lineHeight: 18,
  },
  deductionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  deductionLeft: { gap: 2 },
  deductionRight: {},
  deductionType: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  deductionAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.red,
  },
  disputeButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: colors.rsa.red,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  disputeButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rsa.red,
  },
  deductionStatusBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deductionStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  accrualTable: { gap: 0 },
  accrualHeader: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: 8,
    marginBottom: 4,
  },
  accrualHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  accrualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  accrualPeriod: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
  },
  accrualAmount: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  accrualCumulative: {
    flex: 1,
    fontSize: 13,
    color: colors.text.primary,
    textAlign: 'right',
  },
  legalCard: {
    backgroundColor: '#E6EBF5',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  legalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.rsa.blue,
    marginBottom: 4,
  },
  legalItem: {
    fontSize: 13,
    color: colors.rsa.blue,
    lineHeight: 18,
  },
});
