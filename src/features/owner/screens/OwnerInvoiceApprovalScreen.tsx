import { useAuth } from '@/src/contexts/AuthContext';
import {
  approveInvoice,
  getInvoicesByRequest,
  rejectInvoice,
  type MaintenanceInvoice,
} from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { FeaturePin } from '@/src/shared/components';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395' };

export default function OwnerInvoiceApprovalScreen() {
  const rawParams = useLocalSearchParams<{ id: string }>();
  const id = rawParams?.id;
  const { user } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<MaintenanceInvoice[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<MaintenanceInvoice | null>(null);

  useEffect(() => {
    if (!id || Array.isArray(id)) {
      Alert.alert('Error', 'Invalid request. Please go back and try again.');
      return;
    }
    abortRef.current = new AbortController();
    loadInvoices();
    return () => abortRef.current?.abort();
  }, [id]);

  const loadInvoices = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await getInvoicesByRequest(id);
      if (!abortRef.current?.signal.aborted) {
        setInvoices(data || []);
      }
    } catch (error: any) {
      console.error('Error loading invoices:', error);
      Alert.alert('Error', 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleApprove = async (invoice: MaintenanceInvoice) => {
    Alert.alert(
      'Approve Invoice',
      `Approve invoice ${invoice.invoice_number} for ${formatCurrency(invoice.total_amount)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (!user?.id) throw new Error('Not authenticated');
              await approveInvoice(invoice.id, user.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setSelectedInvoice(null);
              loadInvoices();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to approve invoice');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRejectPress = (invoice: MaintenanceInvoice) => {
    setSelectedInvoice(invoice);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    if (!selectedInvoice || !rejectReason.trim()) {
      Alert.alert('Reason Required', 'Please provide a reason for rejection.');
      return;
    }

    try {
      setActionLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowRejectModal(false);

      if (!user?.id) throw new Error('Not authenticated');
      await rejectInvoice(selectedInvoice.id, user.id, rejectReason.trim());

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Invoice Rejected', 'The vendor has been notified.');
      setSelectedInvoice(null);
      loadInvoices();
    } catch (error: any) {
      // Restore modal on error so user can retry
      setSelectedInvoice(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to reject invoice');
    } finally {
      setActionLoading(false);
    }
  };

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    submitted: { label: 'Submitted', color: colors.info[500], bg: colors.info[50] },
    approved: { label: 'Approved', color: colors.success[500], bg: colors.success[50] },
    rejected: { label: 'Rejected', color: colors.error[500], bg: colors.error[50] },
    paid: { label: 'Paid', color: colors.success[700], bg: colors.success[50] },
    cancelled: { label: 'Cancelled', color: colors.gray[500], bg: colors.gray[100] },
  };

  const renderInvoice = (invoice: MaintenanceInvoice) => {
    const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.submitted;
    return (
      <View key={invoice.id} style={styles.invoiceCard}>
        {/* Header */}
        <View style={styles.invoiceHeader}>
          <View>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
            <Text style={styles.invoiceDate}>Submitted {formatDate(invoice.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* Line Items */}
        <View style={styles.lineItemsSection}>
          <Text style={styles.lineItemsTitle}>Line Items</Text>
          {(invoice.line_items as any[])?.map((item: any, index: number) => (
            <View key={index} style={styles.lineItemRow}>
              <View style={styles.lineItemDesc}>
                <Text style={styles.lineItemName}>{item.description}</Text>
                <Text style={styles.lineItemQty}>
                  {item.quantity} × {formatCurrency(item.unit_price)}
                </Text>
              </View>
              <Text style={styles.lineItemTotal}>
                {formatCurrency(item.quantity * item.unit_price)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT (15%)</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.vat_amount)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowFinal]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{formatCurrency(invoice.total_amount)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Vendor Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Rejection Reason */}
        {invoice.status === 'rejected' && invoice.rejection_reason && (
          <View style={styles.rejectionBox}>
            <Ionicons name="warning" size={16} color={colors.error[600]} />
            <Text style={styles.rejectionLabel}>Rejection Reason:</Text>
            <Text style={styles.rejectionText}>{invoice.rejection_reason}</Text>
          </View>
        )}

        {/* Actions */}
        {invoice.status === 'submitted' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleRejectPress(invoice)}
              disabled={actionLoading}
              testID="invoice-reject-button"
            >
              <Ionicons name="close-circle" size={18} color={colors.error[600]} />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(invoice)}
              disabled={actionLoading}
              testID="invoice-approve-button"
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.approveButtonText}>Approve</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Approved actions */}
        {invoice.status === 'approved' && (
          <View style={styles.approvedBanner}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success[500]} />
            <Text style={styles.approvedText}>
              Approved {formatDate(invoice.approved_at)}. The tenant can now pay this invoice in the
              app.
            </Text>
          </View>
        )}
      </View>
    );
  };

  const activeInvoice = invoices.find((i) => i.status === 'submitted' || i.status === 'approved');
  const hasInvoices = invoices.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice</Text>
        <View style={styles.headerButton}>
          <FeaturePin
            pinId="owner-invoice-approve"
            title="Approving an invoice"
            message="Approve sends the invoice to your tenant to pay in the app. Reject asks the vendor to fix it — add a reason so they know what to change. Approved invoices show a green banner here."
            aiRoute="/(owner)/ai-chat"
            aiPrompt="How do I approve a vendor invoice?"
          />
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      ) : hasInvoices ? (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {invoices.map(renderInvoice)}
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={56} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Invoice Yet</Text>
          <Text style={styles.emptyText}>
            The vendor has not submitted an invoice yet. Invoices appear here after the vendor
            submits them.
          </Text>
        </View>
      )}

      {/* Rejection Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color={colors.error[500]} />
              <Text style={styles.modalTitle}>Reject Invoice</Text>
            </View>
            <Text style={styles.modalSubtitle}>
              Explain why you are rejecting this invoice. The vendor will be notified.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Reason for rejection..."
              placeholderTextColor={colors.gray[400]}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, !rejectReason.trim() && { opacity: 0.5 }]}
                onPress={submitRejection}
                disabled={!rejectReason.trim()}
                testID="invoice-reject-confirm"
              >
                <Text style={styles.modalSubmitText}>Reject Invoice</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827', flex: 1, textAlign: 'center' },

  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },

  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    overflow: 'hidden',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  invoiceNumber: { fontSize: 16, fontWeight: '700', color: '#111827' },
  invoiceDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: '700' },

  lineItemsSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  lineItemsTitle: { fontSize: 13, fontWeight: '700', color: '#6b7280', marginBottom: 10 },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  lineItemDesc: { flex: 1, paddingRight: 12 },
  lineItemName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  lineItemQty: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  lineItemTotal: { fontSize: 14, fontWeight: '600', color: '#111827' },

  totalsSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 13, color: '#6b7280' },
  totalValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  totalAmount: { fontSize: 16, fontWeight: '800', color: RSA.blue },

  notesSection: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  notesLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  notesText: { fontSize: 14, color: '#374151', lineHeight: 20 },

  rejectionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    backgroundColor: colors.error[50],
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
  },
  rejectionLabel: { fontSize: 13, fontWeight: '700', color: colors.error[700] },
  rejectionText: { fontSize: 13, color: colors.error[700], flex: 1 },

  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  rejectButton: { backgroundColor: '#FFFFFF', borderColor: colors.error[500] },
  rejectButtonText: { fontSize: 14, fontWeight: '700', color: colors.error[600] },
  approveButton: { backgroundColor: colors.success[500], borderColor: colors.success[500] },
  approveButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: colors.success[50],
    borderRadius: 8,
  },
  approvedText: { flex: 1, fontSize: 13, color: colors.success[700] },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 16 },
  modalInput: {
    minHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.error[500],
    alignItems: 'center',
  },
  modalSubmitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
