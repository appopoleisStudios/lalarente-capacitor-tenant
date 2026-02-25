/**
 * Owner Payment Disputes Screen
 *
 * Shows all disputes raised by tenants across the owner's properties.
 * Owner can: mark under review, accept (resolve), or reject with reason.
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
import {
  paymentDisputesApi,
  type PaymentDispute,
  type DisputeStatus,
} from '@/src/features/payments/api/paymentDisputes.api';
import { colors } from '@/src/shared/theme/colors';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: '#D97706' },
  under_review: { label: 'Under Review', color: colors.rsa.blue },
  mediation: { label: 'In Mediation', color: '#7C3AED' },
  resolved: { label: 'Resolved', color: colors.rsa.green },
  rejected: { label: 'Rejected', color: '#DC2626' },
  escalated: { label: 'Escalated', color: '#7C2D12' },
};

const REASON_LABELS: Record<string, string> = {
  incorrect_amount: 'Incorrect Amount',
  already_paid: 'Already Paid',
  unauthorized_charge: 'Unauthorized Charge',
  service_issue: 'Service Not Rendered',
  calculation_error: 'Calculation Error',
  other: 'Other',
};

export default function OwnerPaymentDisputesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<PaymentDispute[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Resolve modal (optional resolution amount)
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingDispute, setResolvingDispute] = useState<PaymentDispute | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionAmount, setResolutionAmount] = useState('');

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
      const data = await paymentDisputesApi.getOwnerDisputes(user.id);
      setDisputes(data);
    } catch (err) {
      console.error('Error loading disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkUnderReview = async (dispute: PaymentDispute) => {
    setActionLoading(dispute.id);
    try {
      await paymentDisputesApi.updateDisputeStatus(dispute.id, 'under_review');
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to update dispute');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolve = async () => {
    if (!resolvingDispute) return;
    setActionLoading(resolvingDispute.id);
    try {
      const amount = resolutionAmount ? parseFloat(resolutionAmount) : undefined;
      await paymentDisputesApi.updateDisputeStatus(
        resolvingDispute.id,
        'resolved',
        resolutionNotes.trim() || 'Dispute accepted by owner',
        amount
      );
      setShowResolveModal(false);
      setResolutionNotes('');
      setResolutionAmount('');
      Alert.alert('Dispute Resolved', 'The dispute has been marked as resolved. The tenant will be notified.');
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to resolve dispute');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    setActionLoading(rejectingId);
    try {
      await paymentDisputesApi.updateDisputeStatus(
        rejectingId,
        'rejected',
        rejectReason.trim() || 'Dispute rejected by owner'
      );
      setShowRejectModal(false);
      setRejectReason('');
      Alert.alert('Dispute Rejected', 'The dispute has been rejected. The tenant retains the right to escalate.');
      loadData();
    } catch (err) {
      Alert.alert('Error', 'Failed to reject dispute');
    } finally {
      setActionLoading(null);
    }
  };

  const getDaysAgo = (dateStr: string): string => {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const openDisputes = disputes.filter(d => d.status === 'open' || d.status === 'under_review' || d.status === 'mediation');
  const closedDisputes = disputes.filter(d => d.status === 'resolved' || d.status === 'rejected' || d.status === 'escalated');

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  const renderDisputeCard = (dispute: PaymentDispute, isHistory: boolean) => {
    const statusCfg = STATUS_CONFIG[dispute.status] || { label: dispute.status, color: colors.gray[500] };
    const tenant = (dispute as any).tenant;
    const lease = (dispute as any).lease;
    const property = lease?.property;
    const payment = (dispute as any).payment;
    const isActioning = actionLoading === dispute.id;

    return (
      <View key={dispute.id} style={[styles.card, isHistory && styles.cardHistory]}>
        {/* Top row: property + status */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.propertyName}>{property?.title || 'Property'}</Text>
            <Text style={styles.tenantName}>
              <Ionicons name="person-outline" size={12} color="#6B7280" /> {tenant?.full_name || 'Tenant'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + '18' }]}>
            <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
          </View>
        </View>

        {/* Reason + amount */}
        <View style={styles.reasonRow}>
          <View style={styles.reasonBadge}>
            <Text style={styles.reasonText}>{REASON_LABELS[dispute.reason] || dispute.reason}</Text>
          </View>
          <Text style={styles.disputedAmount}>
            R {dispute.disputed_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
          </Text>
        </View>

        {/* Description */}
        <Text style={styles.description} numberOfLines={isHistory ? 2 : 4}>
          {dispute.description}
        </Text>

        {/* Payment context */}
        {payment && (
          <Text style={styles.paymentContext}>
            Payment: R {payment.amount?.toFixed(2)} due {new Date(payment.due_date).toLocaleDateString('en-ZA')}
          </Text>
        )}

        <Text style={styles.dateText}>{getDaysAgo(dispute.created_at)}</Text>

        {/* Resolution notes (for closed) */}
        {dispute.resolution_notes && (
          <View style={[
            styles.resolutionBox,
            dispute.status === 'rejected' && styles.resolutionBoxRejected,
          ]}>
            <Text style={[
              styles.resolutionLabel,
              dispute.status === 'rejected' && { color: '#DC2626' },
            ]}>
              {dispute.status === 'rejected' ? 'Rejection reason:' : 'Resolution:'}
            </Text>
            <Text style={[
              styles.resolutionText,
              dispute.status === 'rejected' && { color: '#991B1B' },
            ]}>
              {dispute.resolution_notes}
            </Text>
          </View>
        )}

        {/* Actions — only for open disputes */}
        {!isHistory && (
          <View style={styles.actionRow}>
            {dispute.status === 'open' && (
              <TouchableOpacity
                style={styles.reviewBtn}
                onPress={() => handleMarkUnderReview(dispute)}
                disabled={isActioning}
              >
                {isActioning ? (
                  <ActivityIndicator size="small" color={colors.rsa.blue} />
                ) : (
                  <>
                    <Ionicons name="eye-outline" size={15} color={colors.rsa.blue} />
                    <Text style={styles.reviewBtnText}>Under Review</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.resolveBtn}
              onPress={() => {
                setResolvingDispute(dispute);
                setResolutionNotes('');
                setResolutionAmount(dispute.disputed_amount.toFixed(2));
                setShowResolveModal(true);
              }}
              disabled={isActioning}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color="#FFF" />
              <Text style={styles.resolveBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => {
                setRejectingId(dispute.id);
                setRejectReason('');
                setShowRejectModal(true);
              }}
              disabled={isActioning}
            >
              <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Payment Disputes</Text>
          {openDisputes.length > 0 && (
            <Text style={styles.headerSub}>{openDisputes.length} need attention</Text>
          )}
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {disputes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No Disputes</Text>
            <Text style={styles.emptySubtitle}>No payment disputes have been raised</Text>
          </View>
        ) : (
          <>
            {/* Open disputes */}
            {openDisputes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Needs Attention</Text>
                {openDisputes.map(d => renderDisputeCard(d, false))}
              </>
            )}

            {/* Resolved / closed */}
            {closedDisputes.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>History</Text>
                {closedDisputes.map(d => renderDisputeCard(d, true))}
              </>
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* ─── Resolve Modal ────────────────────────────────────────────────── */}
      <Modal visible={showResolveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Accept Dispute</Text>
            <Text style={styles.modalSub}>
              Accepting acknowledges the tenant's dispute. Add notes and optionally adjust the resolution amount.
            </Text>

            <Text style={styles.modalLabel}>Resolution Amount (R)</Text>
            <TextInput
              style={styles.modalInput}
              value={resolutionAmount}
              onChangeText={setResolutionAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.modalLabel}>Resolution Notes</Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              value={resolutionNotes}
              onChangeText={setResolutionNotes}
              placeholder="Explain how the dispute was resolved..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowResolveModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalAcceptBtn}
                onPress={handleResolve}
                disabled={!!actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalAcceptText}>Accept Dispute</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Reject Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showRejectModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Reject Dispute</Text>
            <Text style={styles.modalSub}>
              Provide a reason. The tenant retains the right to escalate.
            </Text>
            <TextInput
              style={[styles.modalInput, styles.modalInputMulti]}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Reason for rejection (optional)..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowRejectModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalRejectBtn}
                onPress={handleReject}
                disabled={!!actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalRejectText}>Reject Dispute</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerSub: { fontSize: 12, color: '#D97706', textAlign: 'center', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginBottom: 12 },

  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 40,
    alignItems: 'center', marginTop: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },

  card: {
    backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#FEF3C7',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  cardHistory: { borderColor: '#E5E7EB', opacity: 0.9 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  propertyName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  tenantName: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  reasonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 8,
  },
  reasonBadge: {
    backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  reasonText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  disputedAmount: { fontSize: 16, fontWeight: '700', color: '#DC2626' },

  description: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 6 },
  paymentContext: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
  dateText: { fontSize: 11, color: '#9CA3AF', marginBottom: 10 },

  resolutionBox: {
    backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginBottom: 10,
  },
  resolutionBoxRejected: { backgroundColor: '#FEF2F2' },
  resolutionLabel: { fontSize: 11, fontWeight: '700', color: '#15803D', marginBottom: 2 },
  resolutionText: { fontSize: 13, color: '#166534' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  reviewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: colors.rsa.blue,
  },
  reviewBtnText: { fontSize: 12, fontWeight: '600', color: colors.rsa.blue },
  resolveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.rsa.green,
  },
  resolveBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#DC2626',
  },
  rejectBtnText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 8 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12,
    fontSize: 15, color: '#111827', marginBottom: 8,
  },
  modalInputMulti: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalAcceptBtn: {
    flex: 1.5, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.rsa.green,
  },
  modalAcceptText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  modalRejectBtn: {
    flex: 1.5, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#DC2626',
  },
  modalRejectText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
