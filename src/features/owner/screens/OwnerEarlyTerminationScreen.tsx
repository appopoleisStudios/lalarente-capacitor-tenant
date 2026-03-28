/**
 * Owner Early Termination Screen
 *
 * Shows all pending early termination requests from tenants.
 * Owner can accept (lease ends on effective date, penalty applies) or
 * decline (request is cleared, lease continues).
 *
 * Legal note: CPA s14 — tenant has a statutory right to terminate a
 * fixed-term lease at any time with 20 business days' notice + reasonable
 * penalty. Owner cannot refuse — only accept or negotiate the terms.
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
import { leaseTerminationApi } from '@/src/features/leases/api/leaseTermination.api';
import { depositRefundApi } from '@/src/features/deposits/api/depositRefund.api';
import { colors } from '@/src/shared/theme/colors';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

const RSA_BLUE = '#002395';

interface TerminationRequest {
  id: string;
  status: string;
  monthly_rent: number;
  early_termination_requested_at: string;
  early_termination_reason: string | null;
  early_termination_penalty: number | null;
  early_termination_effective_date: string | null;
  property: { id: string; title: string; address: string } | null;
  tenant: { id: string; full_name: string | null; email: string | null; phone: string | null } | null;
}

export default function OwnerEarlyTerminationScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<TerminationRequest[]>([]);
  const [history, setHistory] = useState<TerminationRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Decline modal
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [decliningLeaseId, setDecliningLeaseId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('');

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

      const [pendingData, historyData] = await Promise.all([
        leaseTerminationApi.getPendingTerminations(user.id),
        leaseTerminationApi.getTerminatedLeases(user.id),
      ]);

      setPending(pendingData as unknown as TerminationRequest[]);
      setHistory(historyData as unknown as TerminationRequest[]);
    } catch (err) {
      console.error('Error loading termination data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = (request: TerminationRequest) => {
    const tenantName = request.tenant?.full_name || 'Tenant';
    const effectiveDate = request.early_termination_effective_date
      ? new Date(request.early_termination_effective_date).toLocaleDateString('en-ZA')
      : 'the agreed date';
    const penalty = request.early_termination_penalty
      ? `R ${request.early_termination_penalty.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
      : 'per lease terms';

    Alert.alert(
      'Accept Termination',
      `${tenantName}'s lease will end on ${effectiveDate}. Penalty: ${penalty}.\n\nNote: Under CPA s14, tenants have a statutory right to terminate. This will finalise the termination.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            setActionLoading(request.id);
            try {
              await leaseTerminationApi.acceptTermination(request.id);
              // Auto-initiate deposit refund process (RHA s5(7))
              try {
                await depositRefundApi.initiateRefund(request.id);
              } catch {
                // Non-blocking — deposit may not exist or already initiated
              }
              Alert.alert(
                'Termination Accepted',
                `The lease for ${request.property?.title} has been terminated. The deposit refund process has been initiated — ${request.tenant?.full_name || 'the tenant'} has 7 days for a joint inspection per RHA s5(7).`
              );
              loadData();
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const openDeclineModal = (leaseId: string) => {
    setDecliningLeaseId(leaseId);
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  const handleDecline = async () => {
    if (!decliningLeaseId) return;
    setActionLoading(decliningLeaseId);
    try {
      await leaseTerminationApi.declineTermination(decliningLeaseId, declineReason.trim() || undefined);
      setShowDeclineModal(false);
      Alert.alert(
        'Request Declined',
        'The termination request has been declined. The lease continues as normal.\n\nRemember: Under CPA s14 the tenant retains the right to terminate — consider discussing their concerns.',
      );
      loadData();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to decline');
    } finally {
      setActionLoading(null);
    }
  };

  const getDaysAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Early Terminations</Text>
          {pending.length > 0 && (
            <Text style={styles.headerSub}>{pending.length} pending review</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={RSA_BLUE} />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* CPA Notice */}
          <View style={styles.legalBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#1D4ED8" />
            <Text style={styles.legalText}>
              <Text style={{ fontWeight: '700' }}>CPA s14:</Text> Tenants have a statutory right to terminate any fixed-term lease with 20 business days' notice + reasonable penalty. You cannot legally refuse, only negotiate the terms.
            </Text>
          </View>

          {/* Pending Section */}
          <Text style={styles.sectionTitle}>Awaiting Your Review</Text>

          {pending.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No pending requests</Text>
              <Text style={styles.emptySubtitle}>All termination requests have been resolved</Text>
            </View>
          ) : (
            pending.map((req) => (
              <View key={req.id} style={styles.requestCard}>
                {/* Property + Tenant */}
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.propertyName}>{req.property?.title || 'Property'}</Text>
                    <Text style={styles.tenantName}>
                      <Ionicons name="person-outline" size={13} color="#6B7280" /> {req.tenant?.full_name || 'Tenant'}
                    </Text>
                  </View>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Requested</Text>
                    <Text style={styles.detailValue}>{getDaysAgo(req.early_termination_requested_at)}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Effective Date</Text>
                    <Text style={styles.detailValue}>
                      {req.early_termination_effective_date
                        ? new Date(req.early_termination_effective_date).toLocaleDateString('en-ZA')
                        : '—'}
                    </Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Monthly Rent</Text>
                    <Text style={styles.detailValue}>R {req.monthly_rent.toLocaleString('en-ZA')}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Penalty</Text>
                    <Text style={[styles.detailValue, { color: '#DC2626' }]}>
                      {req.early_termination_penalty
                        ? `R ${req.early_termination_penalty.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </Text>
                  </View>
                </View>

                {/* Reason */}
                {req.early_termination_reason && (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Tenant's reason</Text>
                    <Text style={styles.reasonText}>{req.early_termination_reason}</Text>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    onPress={() => openDeclineModal(req.id)}
                    disabled={actionLoading === req.id}
                  >
                    <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={() => handleAccept(req)}
                    disabled={actionLoading === req.id}
                  >
                    {actionLoading === req.id ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* History Section */}
          {history.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Completed Terminations</Text>
              {history.map((req) => (
                <View key={req.id} style={[styles.requestCard, styles.historyCard]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Text style={styles.propertyName}>{(req.property as any)?.title || 'Property'}</Text>
                      <Text style={styles.tenantName}>{(req.tenant as any)?.full_name || 'Former Tenant'}</Text>
                    </View>
                    <View style={styles.terminatedBadge}>
                      <Text style={styles.terminatedBadgeText}>Terminated</Text>
                    </View>
                  </View>
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Monthly Rent</Text>
                      <Text style={styles.detailValue}>R {(req.monthly_rent || 0).toLocaleString('en-ZA')}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Penalty Charged</Text>
                      <Text style={styles.detailValue}>
                        {(req as any).early_termination_penalty
                          ? `R ${(req as any).early_termination_penalty.toLocaleString('en-ZA')}`
                          : '—'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* Decline Modal */}
      <Modal visible={showDeclineModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Decline Request</Text>
            <Text style={styles.modalSubtitle}>
              Provide a reason (optional). The tenant retains the right to re-submit under CPA s14.
            </Text>
            <TextInput
              style={styles.declineInput}
              value={declineReason}
              onChangeText={setDeclineReason}
              placeholder="Reason for declining (optional)..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDeclineModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeclineBtn}
                onPress={handleDecline}
                disabled={!!actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalDeclineText}>Decline Request</Text>
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
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#EF4444', textAlign: 'center', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  legalBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20,
  },
  legalText: { flex: 1, fontSize: 12, color: '#1E40AF', lineHeight: 18 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 },

  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 32,
    alignItems: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },

  requestCard: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#FEE2E2',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  historyCard: { borderColor: '#E5E7EB', opacity: 0.85 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardHeaderLeft: { flex: 1 },
  propertyName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tenantName: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  pendingBadge: {
    backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A',
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  terminatedBadge: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  terminatedBadgeText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  detailItem: { width: '45%' },
  detailLabel: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#111827' },

  reasonBox: {
    backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, marginBottom: 14,
  },
  reasonLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  reasonText: { fontSize: 13, color: '#374151', lineHeight: 18 },

  actionRow: { flexDirection: 'row', gap: 10 },
  declineBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#DC2626', gap: 6,
  },
  declineBtnText: { fontSize: 14, fontWeight: '600', color: '#DC2626' },
  acceptBtn: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10, backgroundColor: '#007A4D', gap: 6,
  },
  acceptBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 16 },
  declineInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12,
    fontSize: 14, color: '#111827', minHeight: 80, textAlignVertical: 'top', marginBottom: 20,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalDeclineBtn: {
    flex: 1.5, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  modalDeclineText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
