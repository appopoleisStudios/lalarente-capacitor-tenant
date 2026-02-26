/**
 * Owner Deposit Management Screen
 *
 * RHA s5(3): Security deposit must earn interest at the prescribed savings rate.
 * RHA s5(7): Refund within 7/14/21 days depending on deductions.
 *
 * Shows all tenant deposits, interest accrual history, and refund management.
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
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { depositInterestApi, DepositInterestSummary } from '@/src/features/deposits/api/depositInterest.api';
import { depositRefundApi, DepositRefundStatus } from '@/src/features/deposits/api/depositRefund.api';
import { colors } from '@/src/shared/theme/colors';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DepositRecord {
  leaseId: string;
  tenantId: string;
  propertyTitle: string;
  propertyAddress: string;
  tenantName: string;
  depositAmount: number;
  totalInterest: number;
  currentBalance: number;
  refundStatus: string;
  refundDeadline: string | null;
  isOverdue: boolean;
  leaseStatus: string;
}

const DEDUCTION_TYPES = ['cleaning', 'damages', 'unpaid_rent', 'key_replacement', 'other'] as const;
type DeductionType = typeof DEDUCTION_TYPES[number];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatZAR = (amount: number) =>
  `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const REFUND_STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  not_applicable: { label: 'Active Lease', color: colors.rsa.green, bg: '#E6F7F0' },
  pending_inspection: { label: 'Awaiting Inspection', color: '#D97706', bg: '#FEF3C7' },
  deductions_proposed: { label: 'Deductions Proposed', color: colors.rsa.blue, bg: '#E6EBF5' },
  refunded: { label: 'Refunded', color: '#6B7280', bg: '#F3F4F6' },
  overdue: { label: 'OVERDUE', color: colors.rsa.red, bg: '#FEF2F2' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerDepositManagementScreen() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DepositInterestSummary>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [deductionModal, setDeductionModal] = useState<DepositRecord | null>(null);
  const [deductionType, setDeductionType] = useState<DeductionType>('damages');
  const [deductionDesc, setDeductionDesc] = useState('');
  const [deductionAmount, setDeductionAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDeposits();
    }, [])
  );

  const loadDeposits = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: leases, error } = await supabase
        .from('leases')
        .select(`
          id, tenant_id, monthly_rent, deposit_amount, deposit_total_interest,
          deposit_refund_status, deposit_refund_deadline, status,
          property:properties!property_id(title, address),
          tenant:profiles!tenant_id(full_name)
        `)
        .eq('owner_id', user.id)
        .gt('deposit_amount', 0)
        .order('status', { ascending: true });

      if (error) throw error;

      const records: DepositRecord[] = (leases || []).map((l: any) => {
        const refundStatus = l.deposit_refund_status || 'not_applicable';
        const isOverdue = l.deposit_refund_deadline
          ? new Date() > new Date(l.deposit_refund_deadline)
          : false;

        return {
          leaseId: l.id,
          tenantId: l.tenant_id || '',
          propertyTitle: l.property?.title || 'Unknown Property',
          propertyAddress: l.property?.address || '',
          tenantName: l.tenant?.full_name || 'Unknown Tenant',
          depositAmount: l.deposit_amount || 0,
          totalInterest: l.deposit_total_interest || 0,
          currentBalance: (l.deposit_amount || 0) + (l.deposit_total_interest || 0),
          refundStatus: isOverdue && refundStatus !== 'refunded' ? 'overdue' : refundStatus,
          refundDeadline: l.deposit_refund_deadline,
          isOverdue,
          leaseStatus: l.status,
        };
      });

      setDeposits(records);
    } catch (err: any) {
      console.error('Error loading deposits:', err);
      Alert.alert('Error', 'Failed to load deposit information');
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async (leaseId: string) => {
    if (summaries[leaseId]) return;
    try {
      const summary = await depositInterestApi.getInterestHistory(leaseId);
      setSummaries(prev => ({ ...prev, [leaseId]: summary }));
    } catch (err) {
      console.error('Error loading interest summary:', err);
    }
  };

  const handleExpand = (leaseId: string) => {
    if (expanded === leaseId) {
      setExpanded(null);
    } else {
      setExpanded(leaseId);
      loadSummary(leaseId);
    }
  };

  const handleOpenDeductionModal = (deposit: DepositRecord) => {
    setDeductionModal(deposit);
    setDeductionType('damages');
    setDeductionDesc('');
    setDeductionAmount('');
  };

  const handleSubmitDeduction = async () => {
    if (!deductionModal || !userId) return;
    const amount = parseFloat(deductionAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deduction amount');
      return;
    }
    if (!deductionDesc.trim()) {
      Alert.alert('Description Required', 'Please describe the deduction reason');
      return;
    }
    setSubmitting(true);
    try {
      await depositRefundApi.proposeDeduction({
        leaseId: deductionModal.leaseId,
        ownerId: userId,
        tenantId: deductionModal.tenantId,
        deductionType,
        description: deductionDesc.trim(),
        amount,
      });
      Alert.alert('Deduction Added', 'The tenant will be notified to respond to the proposed deduction.');
      setDeductionModal(null);
      loadDeposits();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add deduction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessRefund = async (deposit: DepositRecord) => {
    Alert.alert(
      'Process Final Refund',
      `Mark the deposit for ${deposit.tenantName} as fully refunded? This records that you have transferred ${formatZAR(deposit.currentBalance)} to the tenant.\n\nRHA s5(7): You must ensure funds are actually transferred.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark as Refunded',
          onPress: async () => {
            try {
              const amount = await depositRefundApi.processRefund(deposit.leaseId);
              Alert.alert(
                'Refund Processed',
                `Refund of ${formatZAR(amount)} recorded. Please ensure you have transferred the funds to the tenant.`
              );
              loadDeposits();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to process refund');
            }
          },
        },
      ]
    );
  };

  const handleInitiateRefund = async (leaseId: string) => {
    Alert.alert(
      'Initiate Refund Process',
      'This will set the 7-day RHA refund deadline. The tenant will be notified to arrange a joint inspection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Initiate',
          onPress: async () => {
            try {
              await depositRefundApi.initiateRefund(leaseId);
              Alert.alert('Success', 'Refund process initiated. 7-day deadline set per RHA s5(7).');
              loadDeposits();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to initiate refund');
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
          <Text style={styles.title}>Deposit Management</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  const totalDeposits = deposits.reduce((sum, d) => sum + d.depositAmount, 0);
  const totalInterest = deposits.reduce((sum, d) => sum + d.totalInterest, 0);
  const overdueCount = deposits.filter(d => d.isOverdue).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Deposit Management</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Total Held</Text>
            <Text style={styles.summaryValue}>{formatZAR(totalDeposits)}</Text>
          </View>
          <View style={[styles.summaryCard, { flex: 1 }]}>
            <Text style={styles.summaryLabel}>Interest Accrued</Text>
            <Text style={[styles.summaryValue, { color: colors.rsa.green }]}>
              {formatZAR(totalInterest)}
            </Text>
          </View>
          {overdueCount > 0 && (
            <View style={[styles.summaryCard, { flex: 1, borderColor: colors.rsa.red }]}>
              <Text style={[styles.summaryLabel, { color: colors.rsa.red }]}>Overdue</Text>
              <Text style={[styles.summaryValue, { color: colors.rsa.red }]}>{overdueCount}</Text>
            </View>
          )}
        </View>

        {/* RHA Notice */}
        <View style={styles.legalNotice}>
          <Ionicons name="information-circle" size={16} color={colors.rsa.blue} />
          <Text style={styles.legalText}>
            RHA s5(3): All deposits must earn interest at the prescribed savings rate. Interest belongs to the tenant.
          </Text>
        </View>

        {/* Deposit List */}
        {deposits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Deposits</Text>
            <Text style={styles.emptySubtitle}>Deposits appear when leases are created with a deposit amount</Text>
          </View>
        ) : (
          deposits.map((deposit) => {
            const statusInfo = REFUND_STATUS_INFO[deposit.refundStatus] || REFUND_STATUS_INFO.not_applicable;
            const isOpen = expanded === deposit.leaseId;
            const summary = summaries[deposit.leaseId];

            return (
              <View key={deposit.leaseId} style={styles.depositCard}>
                {/* Card Header */}
                <TouchableOpacity
                  style={styles.depositHeader}
                  onPress={() => handleExpand(deposit.leaseId)}
                >
                  <View style={styles.depositHeaderLeft}>
                    <Text style={styles.propertyName}>{deposit.propertyTitle}</Text>
                    <Text style={styles.tenantName}>{deposit.tenantName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.depositHeaderRight}>
                    <Text style={styles.balanceLabel}>Balance</Text>
                    <Text style={styles.balanceAmount}>{formatZAR(deposit.currentBalance)}</Text>
                    <Ionicons
                      name={isOpen ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.gray[400]}
                    />
                  </View>
                </TouchableOpacity>

                {/* Expanded Detail */}
                {isOpen && (
                  <View style={styles.depositDetail}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Principal Deposit</Text>
                      <Text style={styles.detailValue}>{formatZAR(deposit.depositAmount)}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Interest Earned</Text>
                      <Text style={[styles.detailValue, { color: colors.rsa.green }]}>
                        + {formatZAR(deposit.totalInterest)}
                      </Text>
                    </View>
                    <View style={[styles.detailRow, styles.detailRowTotal]}>
                      <Text style={styles.detailLabelBold}>Total Balance</Text>
                      <Text style={styles.detailValueBold}>{formatZAR(deposit.currentBalance)}</Text>
                    </View>

                    {deposit.refundDeadline && (
                      <View style={styles.deadlineRow}>
                        <Ionicons
                          name={deposit.isOverdue ? 'alert-circle' : 'time'}
                          size={16}
                          color={deposit.isOverdue ? colors.rsa.red : '#D97706'}
                        />
                        <Text style={[styles.deadlineText, deposit.isOverdue && { color: colors.rsa.red }]}>
                          Refund deadline: {new Date(deposit.refundDeadline).toLocaleDateString('en-ZA')}
                          {deposit.isOverdue ? ' — OVERDUE!' : ''}
                        </Text>
                      </View>
                    )}

                    {/* Interest History */}
                    {summary && summary.accruals.length > 0 && (
                      <View style={styles.accrualSection}>
                        <Text style={styles.accrualTitle}>
                          Interest History ({(summary.annualRate * 100).toFixed(2)}% p.a.)
                        </Text>
                        {summary.accruals.slice(-3).map((a, i) => (
                          <View key={i} style={styles.accrualRow}>
                            <Text style={styles.accrualPeriod}>
                              {new Date(a.periodStart).toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })}
                            </Text>
                            <Text style={styles.accrualAmount}>+ {formatZAR(a.interestEarned)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Actions */}
                    {deposit.leaseStatus !== 'active' && deposit.refundStatus === 'not_applicable' && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleInitiateRefund(deposit.leaseId)}
                      >
                        <Ionicons name="arrow-undo-circle" size={18} color={colors.rsa.white} />
                        <Text style={styles.actionButtonText}>Initiate Refund Process</Text>
                      </TouchableOpacity>
                    )}

                    {(deposit.refundStatus === 'pending_inspection' || deposit.refundStatus === 'deductions_proposed') && (
                      <View style={styles.refundActionsRow}>
                        <TouchableOpacity
                          style={styles.deductionButton}
                          onPress={() => handleOpenDeductionModal(deposit)}
                        >
                          <Ionicons name="remove-circle-outline" size={16} color={colors.rsa.red} />
                          <Text style={styles.deductionButtonText}>Add Deduction</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.finaliseButton}
                          onPress={() => handleProcessRefund(deposit)}
                        >
                          <Ionicons name="checkmark-done" size={16} color={colors.rsa.white} />
                          <Text style={styles.finaliseButtonText}>Finalise Refund</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add Deduction Modal */}
      <Modal
        visible={!!deductionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDeductionModal(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setDeductionModal(null)}>
              <Ionicons name="close" size={24} color={colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Deposit Deduction</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSubtitle}>
              {deductionModal?.tenantName} · {deductionModal?.propertyTitle}
            </Text>
            <Text style={styles.fieldLabel}>Deduction Type</Text>
            <View style={styles.typeGrid}>
              {DEDUCTION_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, deductionType === type && styles.typeChipActive]}
                  onPress={() => setDeductionType(type)}
                >
                  <Text style={[styles.typeChipText, deductionType === type && styles.typeChipTextActive]}>
                    {type.replace(/_/g, ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Description *</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              value={deductionDesc}
              onChangeText={setDeductionDesc}
              placeholder="e.g. Carpet damage in living room — replacement cost"
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={styles.fieldLabel}>Amount (R) *</Text>
            <TextInput
              style={styles.modalInput}
              value={deductionAmount}
              onChangeText={setDeductionAmount}
              keyboardType="numeric"
              placeholder="e.g. 2500"
              placeholderTextColor={colors.gray[400]}
            />
            <View style={styles.legalNotice}>
              <Ionicons name="information-circle" size={16} color={colors.rsa.blue} />
              <Text style={styles.legalText}>
                RHA s5(4): Deductions must be for actual damage beyond fair wear and tear.
                Tenant has 14 days to respond.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.actionButton, submitting && { opacity: 0.5 }]}
              onPress={handleSubmitDeduction}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.rsa.white} />
              ) : (
                <>
                  <Ionicons name="add-circle" size={18} color={colors.rsa.white} />
                  <Text style={styles.actionButtonText}>Submit Deduction</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  legalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E6EBF5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: colors.rsa.blue,
    lineHeight: 17,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
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
    maxWidth: 260,
    lineHeight: 20,
  },
  depositCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  depositHeader: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  depositHeaderLeft: {
    flex: 1,
    gap: 4,
  },
  propertyName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tenantName: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  depositHeaderRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  balanceLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.rsa.blue,
    marginBottom: 4,
  },
  depositDetail: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    padding: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailRowTotal: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  detailLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  detailValueBold: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.blue,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  deadlineText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  accrualSection: {
    marginTop: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 12,
  },
  accrualTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
  },
  accrualRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  accrualPeriod: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  accrualAmount: {
    fontSize: 13,
    color: colors.rsa.green,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.rsa.blue,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  refundActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  deductionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
  },
  deductionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rsa.red,
  },
  finaliseButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.rsa.green,
    borderRadius: 10,
    padding: 12,
  },
  finaliseButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 32,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
    marginTop: 14,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  typeChipActive: {
    backgroundColor: colors.rsa.red + '20',
    borderColor: colors.rsa.red,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  typeChipTextActive: {
    color: colors.rsa.red,
  },
  modalInput: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
  },
  modalInputMulti: {
    minHeight: 80,
  },
});
