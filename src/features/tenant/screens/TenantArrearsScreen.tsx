/**
 * Tenant Arrears Screen
 *
 * Shows the tenant their current arrears escalation status,
 * CPA cure period countdown, interest breakdown, and actions.
 *
 * Legal: Interest capped at 2%/month per Prescribed Rate of Interest Act.
 * CPA s14(2)(b)(ii): 20 business day cure period before legal action.
 */

import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { paymentDisputesApi, type ProposeArrangementInput } from '@/src/features/payments/api/paymentDisputes.api';
import { colors } from '@/src/shared/theme/colors';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

interface ArrearsRecord {
  id: string;
  stage: string;
  amount_owed: number;
  interest_accrued: number;
  total_owed: number;
  escalated_at: string;
  cure_period_ends_at: string | null;
  lease_id: string;
  owner_id: string;
  property: { id: string; title: string; address: string } | null;
  payment: { amount: number; due_date: string } | null;
}

const STAGE_CONFIG: Record<string, { label: string; color: string; icon: string; severity: number }> = {
  friendly_reminder: { label: 'Payment Reminder', color: '#D97706', icon: 'notifications-outline', severity: 1 },
  formal_demand: { label: 'Formal Demand', color: '#EA580C', icon: 'mail-outline', severity: 2 },
  breach_notice: { label: 'Breach Notice', color: '#DC2626', icon: 'alert-circle-outline', severity: 3 },
  cure_period: { label: 'Cure Period Active', color: '#DC2626', icon: 'time-outline', severity: 4 },
  legal_action: { label: 'Legal Action', color: '#7C2D12', icon: 'briefcase-outline', severity: 5 },
  eviction_notice: { label: 'Eviction Notice', color: '#450A0A', icon: 'warning-outline', severity: 6 },
};

export default function TenantArrearsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [arrears, setArrears] = useState<ArrearsRecord[]>([]);

  // Arrangement proposal modal
  const [showArrangementModal, setShowArrangementModal] = useState(false);
  const [selectedArrears, setSelectedArrears] = useState<ArrearsRecord | null>(null);
  const [instalments, setInstalments] = useState('3');
  const [proposing, setProposing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from('arrears_escalations')
        .select(`
          id, stage, amount_owed, interest_accrued, total_owed,
          escalated_at, cure_period_ends_at, lease_id, owner_id,
          property:properties!property_id(id, title, address),
          payment:payments!payment_id(amount, due_date)
        `)
        .eq('tenant_id', user.id)
        .neq('stage', 'resolved')
        .order('escalated_at', { ascending: false });

      if (error) throw error;
      setArrears((data || []) as unknown as ArrearsRecord[]);
    } catch (err) {
      console.error('Error loading arrears:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDaysUntil = (dateStr: string): number =>
    Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const getDaysAgo = (dateStr: string): string => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const totalOwed = arrears.reduce((sum, a) => sum + a.total_owed, 0);
  const totalInterest = arrears.reduce((sum, a) => sum + a.interest_accrued, 0);
  const highestSeverity = arrears.reduce((max, a) => {
    const s = STAGE_CONFIG[a.stage]?.severity || 0;
    return s > max ? s : max;
  }, 0);

  const handleProposeArrangement = async () => {
    if (!userId || !selectedArrears) return;
    const numInstalments = parseInt(instalments, 10);
    if (isNaN(numInstalments) || numInstalments < 1 || numInstalments > 24) {
      Alert.alert('Invalid', 'Please enter a number between 1 and 24.');
      return;
    }

    setProposing(true);
    try {
      const monthlyInstalment = selectedArrears.total_owed / numInstalments;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + 1);
      startDate.setDate(1);

      const input: ProposeArrangementInput = {
        leaseId: selectedArrears.lease_id,
        tenantId: userId,
        ownerId: selectedArrears.owner_id,
        totalOwed: selectedArrears.total_owed,
        monthlyInstalment,
        numberOfInstalments: numInstalments,
        startDate: startDate.toISOString().split('T')[0],
      };

      await paymentDisputesApi.proposeArrangement(userId, input);
      setShowArrangementModal(false);
      Alert.alert(
        'Arrangement Proposed',
        `Your payment arrangement of R ${monthlyInstalment.toFixed(2)}/month over ${numInstalments} months has been sent to your landlord for approval.`
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to propose arrangement');
    } finally {
      setProposing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>My Arrears</Text>
          {arrears.length > 0 && (
            <Text style={styles.headerSub}>{arrears.length} outstanding</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {arrears.length === 0 ? (
          // ─── All clear ────────────────────────────────────────────────────────
          <View style={styles.allClearCard}>
            <View style={styles.allClearIcon}>
              <Ionicons name="checkmark-circle" size={56} color={colors.rsa.green} />
            </View>
            <Text style={styles.allClearTitle}>All Payments Up to Date</Text>
            <Text style={styles.allClearSub}>You have no outstanding arrears. Keep it up!</Text>
            <TouchableOpacity
              style={styles.viewPaymentsBtn}
              onPress={() => router.push('/(tenant)/payments' as any)}
            >
              <Ionicons name="receipt-outline" size={18} color={colors.rsa.green} />
              <Text style={styles.viewPaymentsBtnText}>View Payment History</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── Alert banner ──────────────────────────────────────────────── */}
            <View style={[
              styles.alertBanner,
              highestSeverity >= 4 && styles.alertBannerCritical,
            ]}>
              <Ionicons
                name={highestSeverity >= 4 ? 'alert-circle' : 'warning-outline'}
                size={20}
                color={highestSeverity >= 4 ? '#DC2626' : '#D97706'}
              />
              <Text style={[
                styles.alertBannerText,
                highestSeverity >= 4 && styles.alertBannerTextCritical,
              ]}>
                {highestSeverity >= 4
                  ? 'Urgent: Cure period is active. Pay or arrange now to avoid legal action.'
                  : 'You have outstanding arrears. Resolving quickly avoids further escalation.'}
              </Text>
            </View>

            {/* ─── Summary totals ────────────────────────────────────────────── */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2' }]}>
                <Text style={styles.summaryValue}>
                  R {totalOwed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.summaryLabel}>Total Owed</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: '#FFF7ED' }]}>
                <Text style={styles.summaryValue}>
                  R {totalInterest.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                </Text>
                <Text style={styles.summaryLabel}>Interest (max 2%)</Text>
              </View>
            </View>

            {/* ─── Legal info ────────────────────────────────────────────────── */}
            <View style={styles.legalBanner}>
              <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" />
              <Text style={styles.legalText}>
                Interest is capped at 2% per month per the Prescribed Rate of Interest Act.
                Under CPA s14(2)(b)(ii) you have 20 business days to cure a breach before legal action.
              </Text>
            </View>

            {/* ─── Arrears cards ─────────────────────────────────────────────── */}
            {arrears.map((item) => {
              const config = STAGE_CONFIG[item.stage] || STAGE_CONFIG.friendly_reminder;
              const cureDaysLeft = item.cure_period_ends_at ? getDaysUntil(item.cure_period_ends_at) : null;
              const isCureActive = item.stage === 'cure_period' || item.stage === 'breach_notice';

              return (
                <View key={item.id} style={[styles.arrearsCard, isCureActive && styles.arrearsCardCritical]}>
                  {/* Stage badge */}
                  <View style={styles.cardTop}>
                    <View style={[styles.stageBadge, { backgroundColor: config.color + '18' }]}>
                      <Ionicons name={config.icon as any} size={14} color={config.color} />
                      <Text style={[styles.stageLabel, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <Text style={styles.daysAgo}>{getDaysAgo(item.escalated_at)}</Text>
                  </View>

                  {/* Property */}
                  <Text style={styles.propertyName}>{(item.property as any)?.title || 'Property'}</Text>
                  <Text style={styles.propertyAddr}>{(item.property as any)?.address || ''}</Text>

                  {/* Amount breakdown */}
                  <View style={styles.amountRow}>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Principal</Text>
                      <Text style={styles.amountValue}>R {item.amount_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</Text>
                    </View>
                    <Text style={styles.plusSign}>+</Text>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Interest</Text>
                      <Text style={[styles.amountValue, { color: '#EA580C' }]}>
                        R {item.interest_accrued.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                    <Text style={styles.plusSign}>=</Text>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Total</Text>
                      <Text style={[styles.amountValue, { color: '#DC2626', fontWeight: '800' }]}>
                        R {item.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                      </Text>
                    </View>
                  </View>

                  {/* Cure period countdown */}
                  {isCureActive && item.cure_period_ends_at && (
                    <View style={[
                      styles.cureBox,
                      cureDaysLeft !== null && cureDaysLeft <= 5 && styles.cureBoxUrgent,
                    ]}>
                      <Ionicons name="time" size={16} color={cureDaysLeft !== null && cureDaysLeft <= 5 ? '#DC2626' : '#B91C1C'} />
                      <Text style={styles.cureText}>
                        Cure period ends {new Date(item.cure_period_ends_at).toLocaleDateString('en-ZA')}
                        {cureDaysLeft !== null && (
                          <Text style={{ fontWeight: '800' }}>
                            {' — '}{cureDaysLeft > 0 ? `${cureDaysLeft} days left` : 'EXPIRED'}
                          </Text>
                        )}
                      </Text>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={styles.payBtn}
                      onPress={() => router.push('/(tenant)/payments' as any)}
                    >
                      <Ionicons name="cash-outline" size={16} color="#FFF" />
                      <Text style={styles.payBtnText}>Make Payment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.arrangeBtn}
                      onPress={() => {
                        setSelectedArrears(item);
                        setInstalments('3');
                        setShowArrangementModal(true);
                      }}
                    >
                      <Ionicons name="calendar-outline" size={16} color={colors.rsa.blue} />
                      <Text style={styles.arrangeBtnText}>Arrange</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.messageBtn}
                      onPress={() => router.push('/(tenant)/messages' as any)}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color="#374151" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ─── Payment Arrangement Modal ───────────────────────────────────── */}
      <Modal visible={showArrangementModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Propose Payment Arrangement</Text>
            {selectedArrears && (
              <Text style={styles.modalSub}>
                Total owed: R {selectedArrears.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                {'\n'}Your landlord must accept this before it takes effect.
              </Text>
            )}

            <Text style={styles.modalLabel}>Number of monthly instalments</Text>
            <TextInput
              style={styles.modalInput}
              value={instalments}
              onChangeText={setInstalments}
              keyboardType="number-pad"
              placeholder="e.g. 3"
              placeholderTextColor="#9CA3AF"
            />
            {selectedArrears && instalments && !isNaN(parseInt(instalments, 10)) && parseInt(instalments, 10) > 0 && (
              <Text style={styles.modalCalc}>
                Monthly instalment: R {(selectedArrears.total_owed / parseInt(instalments, 10)).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowArrangementModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleProposeArrangement}
                disabled={proposing}
              >
                {proposing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Send Proposal</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#EF4444', textAlign: 'center', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // All clear state
  allClearCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 32,
    alignItems: 'center', marginTop: 20,
  },
  allClearIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#F0FDF4',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  allClearTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  allClearSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  viewPaymentsBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 20, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.rsa.green,
  },
  viewPaymentsBtnText: { fontSize: 14, fontWeight: '600', color: colors.rsa.green },

  // Alert banner
  alertBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FED7AA', marginBottom: 16,
  },
  alertBannerCritical: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  alertBannerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  alertBannerTextCritical: { color: '#991B1B' },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: {
    flex: 1, borderRadius: 12, padding: 14, alignItems: 'center',
  },
  summaryValue: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: '#6B7280' },

  // Legal
  legalBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16,
  },
  legalText: { flex: 1, fontSize: 11, color: '#1E40AF', lineHeight: 16 },

  // Arrears card
  arrearsCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#FEE2E2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  arrearsCardCritical: { borderColor: '#DC2626', borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  stageBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  stageLabel: { fontSize: 11, fontWeight: '700' },
  daysAgo: { fontSize: 11, color: '#9CA3AF' },
  propertyName: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
  propertyAddr: { fontSize: 12, color: '#6B7280', marginBottom: 12 },

  // Amount breakdown
  amountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 12,
  },
  amountItem: { flex: 1, alignItems: 'center' },
  amountLabel: { fontSize: 10, color: '#9CA3AF', marginBottom: 3 },
  amountValue: { fontSize: 13, fontWeight: '700', color: '#111827' },
  plusSign: { fontSize: 16, color: '#D1D5DB', paddingHorizontal: 4 },

  // Cure period
  cureBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  cureBoxUrgent: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  cureText: { flex: 1, fontSize: 12, color: '#B91C1C', lineHeight: 16 },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  payBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.rsa.green, paddingVertical: 11, borderRadius: 10,
  },
  payBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  arrangeBtn: {
    flex: 0.7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.rsa.blue,
  },
  arrangeBtnText: { fontSize: 13, fontWeight: '600', color: colors.rsa.blue },
  messageBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, borderWidth: 1.5, borderColor: '#E5E7EB',
  },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12,
    fontSize: 16, color: '#111827', marginBottom: 8,
  },
  modalCalc: { fontSize: 14, color: '#374151', fontWeight: '600', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalSubmitBtn: {
    flex: 1.5, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.rsa.blue,
  },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
