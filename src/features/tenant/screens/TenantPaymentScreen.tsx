import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

const RSA = { green: '#007A4D', gold: '#FFB81C' }; // Tenant colors

interface Payment {
  id: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: string;
  type: string;
  payment_method: string | null;
  transaction_id: string | null;
  transaction_fee: number | null;
  failure_reason: string | null;
  property?: {
    title: string;
    address: string;
  };
}

interface Lease {
  id: string;
  monthly_rent: number;
  payment_due_day: number | null;
  property?: {
    title: string;
  };
}

export default function TenantPaymentScreen() {
  const router = useRouter();
  const [lease, setLease] = useState<Lease | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [nextPayment, setNextPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingPayment, setPayingPayment] = useState<Payment | null>(null);
  const [selectedMethod, setSelectedMethod] = useState('EFT / Internet Banking');
  const [referenceInput, setReferenceInput] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const PAYMENT_METHODS = ['EFT / Internet Banking', 'Debit Order', 'Cash'];

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get most recent active lease (tenant may have multiple)
      const { data: leasesData } = await supabase
        .from('leases')
        .select('id, monthly_rent, payment_due_day, property:properties!property_id(title)')
        .eq('tenant_id', user.id)
        .in('status', ['active', 'month_to_month'])
        .order('start_date', { ascending: false })
        .limit(1);

      const leaseData = leasesData?.[0] ?? null;

      if (leaseData) {
        setLease(leaseData as Lease);

        // Get payments for this lease
        let query = supabase
          .from('payments')
          .select('*, property:properties!property_id(title, address)')
          .eq('lease_id', leaseData.id)
          .order('due_date', { ascending: false });

        if (filter === 'pending') {
          query = query.eq('status', 'pending');
        } else if (filter === 'paid') {
          query = query.eq('status', 'paid');
        }

        const { data: paymentsData } = await query;
        if (paymentsData) {
          setPayments(paymentsData as Payment[]);

          // Find next pending payment
          const pending = paymentsData.find((p: Payment) => p.status === 'pending');
          setNextPayment(pending || null);
        }
      }
    } catch (error) {
      console.error('Error loading payment data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMakePayment = (payment: Payment) => {
    setPayingPayment(payment);
    setSelectedMethod('EFT / Internet Banking');
    setReferenceInput('');
    setShowPayModal(true);
  };

  const handleSubmitPayment = async () => {
    if (!payingPayment) return;
    setPaySubmitting(true);
    try {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'processing',
          payment_method: selectedMethod,
          transaction_id: referenceInput.trim() || null,
        })
        .eq('id', payingPayment.id);

      if (error) throw error;

      setShowPayModal(false);
      Alert.alert(
        'Payment Confirmed',
        'Your payment has been recorded as confirmed. Your landlord will verify receipt and mark it as paid.',
      );
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to record payment. Please try again.');
    } finally {
      setPaySubmitting(false);
    }
  };

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return RSA.green;
      case 'processing':
        return '#7C3AED';
      case 'pending':
        return '#FF9800';
      case 'overdue':
        return '#F44336';
      case 'failed':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return 'checkmark-circle';
      case 'processing':
        return 'hourglass-outline';
      case 'pending':
        return 'time-outline';
      case 'overdue':
        return 'alert-circle';
      case 'failed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (!lease) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="wallet-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No Active Lease</Text>
          <Text style={styles.emptyText}>
            You need an active lease to view payments.
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push('/(tenant)/search')}
          >
            <Text style={styles.searchButtonText}>Search Properties</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payments</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RSA.green]} />
          }
        >
          {/* Next Payment Card */}
          {nextPayment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next Payment</Text>
              <View style={styles.nextPaymentCard}>
                <View style={styles.nextPaymentHeader}>
                  <View>
                    <Text style={styles.nextPaymentAmount}>
                      R {nextPayment.amount.toLocaleString()}
                    </Text>
                    <Text style={styles.nextPaymentType}>{nextPayment.type}</Text>
                  </View>
                  <View style={styles.dueBadge}>
                    <Text style={styles.dueBadgeText}>
                      {getDaysUntilDue(nextPayment.due_date) === 0
                        ? 'Due Today'
                        : getDaysUntilDue(nextPayment.due_date) < 0
                        ? `${Math.abs(getDaysUntilDue(nextPayment.due_date))} days overdue`
                        : `Due in ${getDaysUntilDue(nextPayment.due_date)} days`}
                    </Text>
                  </View>
                </View>

                <View style={styles.nextPaymentDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>
                      Due: {new Date(nextPayment.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="home-outline" size={16} color="#666" />
                    <Text style={styles.detailText}>{nextPayment.property?.title}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => handleMakePayment(nextPayment)}
                >
                  <Ionicons name="card-outline" size={20} color="#FFF" />
                  <Text style={styles.payButtonText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Payment Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Summary</Text>
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Monthly Rent</Text>
                <Text style={styles.summaryValue}>R {lease.monthly_rent.toLocaleString()}</Text>
              </View>
              {lease.payment_due_day && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Payment Due Day</Text>
                  <Text style={styles.summaryValue}>
                    {lease.payment_due_day}
                    {getDaySuffix(lease.payment_due_day)} of each month
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Arrears & Escalations */}
          <TouchableOpacity
            style={[styles.disputeButton, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
            onPress={() => router.push('/(tenant)/arrears' as any)}
          >
            <Ionicons name="trending-up-outline" size={20} color="#DC2626" />
            <View style={styles.disputeContent}>
              <Text style={[styles.disputeTitle, { color: '#991B1B' }]}>Arrears & Escalations</Text>
              <Text style={[styles.disputeSubtitle, { color: '#DC2626' }]}>View outstanding amounts and CPA cure period</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Dispute a Payment */}
          <TouchableOpacity
            style={styles.disputeButton}
            onPress={() => router.push('/(tenant)/payment-disputes')}
          >
            <Ionicons name="alert-circle-outline" size={20} color="#D97706" />
            <View style={styles.disputeContent}>
              <Text style={styles.disputeTitle}>Dispute a Payment</Text>
              <Text style={styles.disputeSubtitle}>Raise a query about a charge or payment</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
              onPress={() => setFilter('pending')}
            >
              <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
                Pending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, filter === 'paid' && styles.filterTabActive]}
              onPress={() => setFilter('paid')}
            >
              <Text style={[styles.filterText, filter === 'paid' && styles.filterTextActive]}>
                Paid
              </Text>
            </TouchableOpacity>
          </View>

          {/* Payment History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment History</Text>
            {payments.length === 0 ? (
              <View style={styles.emptyHistory}>
                <Ionicons name="receipt-outline" size={48} color="#CCC" />
                <Text style={styles.emptyHistoryText}>No payments yet</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {payments.map((payment) => (
                  <TouchableOpacity
                    key={payment.id}
                    style={styles.paymentCard}
                    onPress={() => {
                      // Show payment details
                      Alert.alert(
                        'Payment Details',
                        `Amount: R ${payment.amount.toLocaleString()}\n` +
                          `Type: ${payment.type}\n` +
                          `Due: ${new Date(payment.due_date).toLocaleDateString()}\n` +
                          `Status: ${payment.status}\n` +
                          (payment.paid_date
                            ? `Paid: ${new Date(payment.paid_date).toLocaleDateString()}\n`
                            : '') +
                          (payment.transaction_id ? `Transaction: ${payment.transaction_id}\n` : '') +
                          (payment.failure_reason ? `Reason: ${payment.failure_reason}` : '')
                      );
                    }}
                  >
                    <View style={styles.paymentCardLeft}>
                      <Ionicons
                        name={getStatusIcon(payment.status)}
                        size={24}
                        color={getStatusColor(payment.status)}
                      />
                      <View style={styles.paymentInfo}>
                        <Text style={styles.paymentAmount}>
                          R {payment.amount.toLocaleString()}
                        </Text>
                        <Text style={styles.paymentType}>{payment.type}</Text>
                        <Text style={styles.paymentDate}>
                          {payment.paid_date
                            ? `Paid: ${new Date(payment.paid_date).toLocaleDateString()}`
                            : `Due: ${new Date(payment.due_date).toLocaleDateString()}`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.paymentCardRight}>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${getStatusColor(payment.status)}15` },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
                          {payment.status}
                        </Text>
                      </View>
                      {payment.status === 'pending' && (
                        <TouchableOpacity
                          style={styles.miniPayButton}
                          onPress={() => handleMakePayment(payment)}
                        >
                          <Text style={styles.miniPayButtonText}>Pay</Text>
                        </TouchableOpacity>
                      )}
                      {payment.status === 'processing' && (
                        <View style={styles.processingPill}>
                          <Text style={styles.processingPillText}>Awaiting confirmation</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* EFT Payment Confirmation Modal */}
      <Modal visible={showPayModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Confirm Payment</Text>
            {payingPayment && (
              <Text style={styles.modalAmount}>
                R {payingPayment.amount.toLocaleString()} — {payingPayment.type}
              </Text>
            )}
            <Text style={styles.modalSubtitle}>
              Confirm that you have already paid via your bank. Your landlord will verify and mark the payment as received.
            </Text>

            {/* Method Selector */}
            <Text style={styles.modalLabel}>Payment method</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodChip, selectedMethod === m && styles.methodChipActive]}
                  onPress={() => setSelectedMethod(m)}
                >
                  <Text style={[styles.methodChipText, selectedMethod === m && styles.methodChipTextActive]}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Reference */}
            <Text style={styles.modalLabel}>Your bank reference (optional)</Text>
            <TextInput
              style={styles.referenceInput}
              value={referenceInput}
              onChangeText={setReferenceInput}
              placeholder="e.g., RENT-JAN or your surname"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
            />
            <Text style={styles.modalHint}>
              This helps your landlord match the payment in their bank statement.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPayModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, paySubmitting && { opacity: 0.6 }]}
                onPress={handleSubmitPayment}
                disabled={paySubmitting}
              >
                {paySubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const getDaySuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  nextPaymentCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: RSA.green,
  },
  nextPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  nextPaymentAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
  },
  nextPaymentType: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  dueBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dueBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  nextPaymentDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RSA.green,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  summaryCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFF',
  },
  filterTabActive: {
    backgroundColor: RSA.green,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
  },
  historyList: {
    gap: 12,
  },
  paymentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  paymentType: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  paymentDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  paymentCardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  miniPayButton: {
    backgroundColor: RSA.green,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  miniPayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  disputeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 12,
  },
  disputeContent: {
    flex: 1,
  },
  disputeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  disputeSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  emptyHistory: {
    alignItems: 'center',
    padding: 32,
  },
  emptyHistoryText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  searchButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: RSA.green,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  processingPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  processingPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#5B21B6',
  },
  // EFT Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 4 },
  modalAmount: { fontSize: 24, fontWeight: '700', color: RSA.green, marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 20 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  methodChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#FFF',
  },
  methodChipActive: { borderColor: RSA.green, backgroundColor: '#F0FDF4' },
  methodChipText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  methodChipTextActive: { color: RSA.green, fontWeight: '700' },
  referenceInput: {
    borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10,
    padding: 12, fontSize: 15, color: '#111827', marginBottom: 6,
  },
  modalHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  modalCancelText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  modalConfirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: RSA.green,
  },
  modalConfirmText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
