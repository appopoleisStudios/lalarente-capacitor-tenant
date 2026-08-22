/**
 * Vendor Invoices Screen (Plane #108)
 *
 * Shows all invoices submitted by this vendor across jobs.
 * Statuses: submitted, approved, rejected, paid.
 * Rejected invoices show the rejection reason and a "Resubmit" CTA.
 */

import { useAuth } from '@/src/contexts/AuthContext';
import { getInvoicesByVendor, type MaintenanceInvoice } from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

const RSA = { blue: '#002395', gold: '#FFB81C' };

type Filter = 'all' | 'submitted' | 'rejected' | 'approved' | 'paid';

export default function VendorInvoicesScreen() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<MaintenanceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const loadInvoices = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await getInvoicesByVendor(user.id);
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadInvoices();
    }, [loadInvoices])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadInvoices();
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

  const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> =
    {
      submitted: {
        label: 'Pending Review',
        color: colors.warning[600],
        bg: colors.warning[50],
        icon: 'time-outline',
      },
      approved: {
        label: 'Approved',
        color: colors.success[500],
        bg: colors.success[50],
        icon: 'checkmark-circle-outline',
      },
      rejected: {
        label: 'Rejected',
        color: colors.error[500],
        bg: colors.error[50],
        icon: 'close-circle-outline',
      },
      paid: {
        label: 'Paid',
        color: colors.success[700],
        bg: colors.success[50],
        icon: 'cash-outline',
      },
      cancelled: {
        label: 'Cancelled',
        color: colors.gray[500],
        bg: colors.gray[100],
        icon: 'ban-outline',
      },
    };

  const filtered = filter === 'all' ? invoices : invoices.filter((i) => i.status === filter);
  const counts = {
    all: invoices.length,
    submitted: invoices.filter((i) => i.status === 'submitted').length,
    rejected: invoices.filter((i) => i.status === 'rejected').length,
    approved: invoices.filter((i) => i.status === 'approved').length,
    paid: invoices.filter((i) => i.status === 'paid').length,
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'submitted', label: 'Pending' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'approved', label: 'Approved' },
    { key: 'paid', label: 'Paid' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Invoices</Text>
        <View style={styles.headerButton} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label} ({counts[f.key]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Invoice List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RSA.blue]} />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="receipt-outline" size={56} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>
                {filter === 'all' ? 'No Invoices Yet' : `No ${filter} invoices`}
              </Text>
              <Text style={styles.emptyText}>
                {filter === 'all'
                  ? 'Submit an invoice from a completed job to see it here.'
                  : 'No invoices with this status.'}
              </Text>
            </View>
          ) : (
            filtered.map((invoice) => {
              const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.submitted;
              return (
                <TouchableOpacity
                  key={invoice.id}
                  style={styles.invoiceCard}
                  onPress={() =>
                    router.push(
                      `/(vendor)/jobs/${invoice.maintenance_request_id}/submit-invoice?edit=${invoice.id}` as any
                    )
                  }
                  testID="vendor-invoice-card"
                >
                  {/* Top row: number + status */}
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
                      <Text style={styles.invoiceDate}>{formatDate(invoice.created_at)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                      <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  {/* Rejection reason */}
                  {invoice.status === 'rejected' && invoice.rejection_reason && (
                    <View style={styles.rejectionBanner}>
                      <Ionicons name="warning" size={14} color={colors.error[600]} />
                      <Text style={styles.rejectionText} numberOfLines={2}>
                        {invoice.rejection_reason}
                      </Text>
                    </View>
                  )}

                  {/* Amount + line items count */}
                  <View style={styles.cardBottom}>
                    <Text style={styles.itemCount}>
                      {(invoice.line_items as any[])?.length || 0} line items
                    </Text>
                    <Text style={styles.invoiceTotal}>{formatCurrency(invoice.total_amount)}</Text>
                  </View>

                  {/* Resubmit CTA for rejected */}
                  {invoice.status === 'rejected' && (
                    <View style={styles.resubmitRow}>
                      <Ionicons name="refresh" size={16} color={RSA.blue} />
                      <Text style={styles.resubmitText}>Tap to edit & resubmit</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
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

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.gray[100],
  },
  filterTabActive: { backgroundColor: RSA.blue },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.gray[500] },
  filterTextActive: { color: '#FFFFFF' },

  scrollView: { flex: 1 },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    marginTop: 60,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  invoiceNumber: { fontSize: 15, fontWeight: '700', color: '#111827' },
  invoiceDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    backgroundColor: colors.error[50],
    borderRadius: 8,
    marginBottom: 10,
  },
  rejectionText: { fontSize: 12, color: colors.error[700], flex: 1, lineHeight: 16 },

  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemCount: { fontSize: 13, color: '#6b7280' },
  invoiceTotal: { fontSize: 17, fontWeight: '700', color: '#111827' },

  resubmitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  resubmitText: { fontSize: 13, fontWeight: '600', color: RSA.blue },
});
