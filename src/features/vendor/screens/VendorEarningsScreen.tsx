/**
 * Vendor Earnings Screen
 * Shows earnings summary, pending payouts, and transaction history.
 * Fetches data from the get-vendor-earnings Edge Function.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/shared/theme/colors';
import { EmptyState, ErrorState, FeaturePin, LoadingSpinner } from '@/src/shared/components';

const BRAND_BLUE = colors.info[500]; // RSA Blue
const BRAND_GREEN = colors.success[500]; // SA Green

export const VENDOR_EARNINGS_TEST_IDS = {
  title: 'vendor-earnings-title',
  bankingButton: 'vendor-earnings-banking-button',
  totalEarned: 'vendor-earnings-total-earned',
  pendingTotal: 'vendor-earnings-pending-total',
  pendingCount: 'vendor-earnings-pending-count',
  netEarnings: 'vendor-earnings-net-earnings',
  schedule: 'vendor-earnings-schedule',
  feesBanner: 'vendor-earnings-fees-banner',
  bankingStatus: 'vendor-earnings-banking-status',
  transactionsTitle: 'vendor-earnings-transactions-title',
  emptyState: 'vendor-earnings-empty-state',
  transactionList: 'vendor-earnings-transaction-list',
};

interface EarningsSummary {
  total_earned_all_time: number;
  total_platform_fees: number;
  total_payout_fees: number;
  net_earnings: number;
  pending_payout_count: number;
  pending_payout_total: number;
  next_scheduled_payout_date: string | null;
  payout_schedule: string;
}

interface Transaction {
  id: string;
  invoice_number: string | null;
  maintenance_title: string | null;
  total_amount: number;
  vendor_payout: number;
  platform_fee: number;
  gateway_fee: number;
  payout_fee: number;
  payment_status: string;
  payout_status: string;
  paid_at: string | null;
  created_at: string;
}

interface PayoutPreferences {
  schedule: string;
  bank_account_name: string | null;
  bank_name: string | null;
  branch_code: string | null;
  account_type: string | null;
}

interface EarningsData {
  summary: EarningsSummary;
  recent_transactions: Transaction[];
  preferences: PayoutPreferences | null;
}

export default function VendorEarningsScreen() {
  const router = useRouter();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEarnings = useCallback(async () => {
    try {
      const { data: result, error } = await supabase.functions.invoke<EarningsData>(
        'get-vendor-earnings',
        { method: 'GET' }
      );

      if (error) throw new Error(error.message || 'Failed to load earnings');

      if (!result) throw new Error('Empty response from server');
      setData(result);
    } catch (err: any) {
      console.error('Error loading earnings:', err);
      setError(err.message || 'Failed to load earnings data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loading) setLoading(true);
      loadEarnings();
    }, [loadEarnings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadEarnings();
  };

  const formatCurrency = (amount: number) =>
    `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const scheduleLabel = (s: string) => {
    switch (s) {
      case 'instant':
        return 'Instant';
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      default:
        return s;
    }
  };

  const payoutStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return BRAND_GREEN;
      case 'pending':
        return colors.warning[500];
      case 'processing':
        return colors.info[500];
      case 'failed':
        return colors.error[500];
      case 'on_hold':
        return '#F97316';
      default:
        return colors.gray[400];
    }
  };

  const payoutStatusLabel = (status: string) => {
    switch (status) {
      case 'sent':
        return 'Paid';
      case 'pending':
        return 'Awaiting Payout';
      case 'processing':
        return 'Processing';
      case 'failed':
        return 'Failed';
      case 'on_hold':
        return 'On Hold';
      default:
        return status;
    }
  };

  if (loading && !refreshing) {
    return <LoadingSpinner fullScreen color={BRAND_BLUE} />;
  }

  if (error && !data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ErrorState
          title="Couldn't load earnings"
          message={error}
          retryLabel="Try Again"
          onRetry={() => {
            setError(null);
            setLoading(true);
            loadEarnings();
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle} testID={VENDOR_EARNINGS_TEST_IDS.title}>
            Earnings
          </Text>
          <FeaturePin
            pinId="vendor-earnings"
            title="Your earnings"
            message="PayFast collects from the tenant or owner. LalaRente then pays your bank by EFT after an admin marks the payout sent — not an instant PayFast payout. Pending is money waiting for that EFT. Add Banking details or payouts stay on hold."
            aiRoute="/(vendor)/ai-chat"
            aiPrompt="How do payouts work for vendors?"
          />
        </View>
        <TouchableOpacity
          style={styles.bankingButton}
          onPress={() => router.push('/(vendor)/earnings/banking')}
          testID={VENDOR_EARNINGS_TEST_IDS.bankingButton}
        >
          <Ionicons name="business-outline" size={20} color={BRAND_BLUE} />
          <Text style={styles.bankingButtonText}>Banking</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND_BLUE]} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardEarned]}>
            <Ionicons name="wallet-outline" size={24} color={BRAND_BLUE} />
            <Text style={styles.summaryLabel}>Total Earned</Text>
            <Text style={styles.summaryValue} testID={VENDOR_EARNINGS_TEST_IDS.totalEarned}>
              {formatCurrency(data?.summary.total_earned_all_time || 0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardPending]}>
            <Ionicons name="time-outline" size={24} color={colors.warning[500]} />
            <Text style={styles.summaryLabel}>Pending</Text>
            <Text style={styles.summaryValue} testID={VENDOR_EARNINGS_TEST_IDS.pendingTotal}>
              {formatCurrency(data?.summary.pending_payout_total || 0)}
            </Text>
            <Text style={styles.summarySub} testID={VENDOR_EARNINGS_TEST_IDS.pendingCount}>
              {data?.summary.pending_payout_count || 0} payment
              {(data?.summary.pending_payout_count || 0) !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.summaryCardNet]}>
            <Ionicons name="trending-up-outline" size={24} color={BRAND_GREEN} />
            <Text style={styles.summaryLabel}>Net Earnings</Text>
            <Text
              style={[styles.summaryValue, { color: BRAND_GREEN }]}
              testID={VENDOR_EARNINGS_TEST_IDS.netEarnings}
            >
              {formatCurrency(data?.summary.net_earnings || 0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.summaryCardSchedule]}>
            <Ionicons name="calendar-outline" size={24} color="#7C3AED" />
            <Text style={styles.summaryLabel}>Schedule</Text>
            <Text style={styles.summaryValue} testID={VENDOR_EARNINGS_TEST_IDS.schedule}>
              {scheduleLabel(data?.summary.payout_schedule || 'weekly')}
            </Text>
            {data?.summary.next_scheduled_payout_date && (
              <Text style={styles.summarySub}>
                Next: {formatDate(data.summary.next_scheduled_payout_date)}
              </Text>
            )}
          </View>
        </View>

        {/* Platform fees info */}
        <View style={styles.feesBanner} testID={VENDOR_EARNINGS_TEST_IDS.feesBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.gray[400]} />
          <Text style={styles.feesBannerText} testID="vendor-payout-honest-copy">
            Collect ≠ payout: PayFast takes the customer payment; LalaRente pays you by EFT
            (manual). Platform fees: {formatCurrency(data?.summary.total_platform_fees || 0)}.
          </Text>
        </View>

        {/* Banking Status */}
        <TouchableOpacity
          style={styles.bankingStatusCard}
          onPress={() => router.push('/(vendor)/earnings/banking')}
          testID={VENDOR_EARNINGS_TEST_IDS.bankingStatus}
        >
          <View style={styles.bankingStatusLeft}>
            <Ionicons
              name={data?.preferences?.bank_name ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={data?.preferences?.bank_name ? BRAND_GREEN : colors.warning[500]}
            />
            <View style={styles.bankingStatusTextWrap}>
              <Text style={styles.bankingStatusTitle}>
                {data?.preferences?.bank_name ? 'Banking Details Set' : 'Banking Details Required'}
              </Text>
              <Text style={styles.bankingStatusSub}>
                {data?.preferences?.bank_name
                  ? `${data.preferences.bank_name} • ${data.preferences.bank_account_name || ''}`
                  : 'Add your bank details to receive payouts'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.gray[300]} />
        </TouchableOpacity>

        {/* Transactions */}
        <Text style={styles.sectionTitle} testID={VENDOR_EARNINGS_TEST_IDS.transactionsTitle}>
          Transaction History
        </Text>

        {!data?.recent_transactions || data.recent_transactions.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No transactions yet"
            message="Completed payments will appear here once tenants pay your invoices."
            testID={VENDOR_EARNINGS_TEST_IDS.emptyState}
          />
        ) : (
          <View style={styles.transactionsList} testID={VENDOR_EARNINGS_TEST_IDS.transactionList}>
            {data.recent_transactions.map((tx) => (
              <View key={tx.id} style={styles.transactionCard}>
                <View style={styles.txTop}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txTitle}>{tx.maintenance_title || 'Maintenance Job'}</Text>
                    <Text style={styles.txInvoice}>
                      {tx.invoice_number ? `Invoice ${tx.invoice_number}` : ''}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={styles.txAmount}>{formatCurrency(tx.vendor_payout)}</Text>
                    <View
                      style={[
                        styles.txStatusBadge,
                        { backgroundColor: payoutStatusColor(tx.payout_status) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.txStatusText,
                          { color: payoutStatusColor(tx.payout_status) },
                        ]}
                      >
                        {payoutStatusLabel(tx.payout_status)}
                      </Text>
                    </View>
                  </View>
                </View>

                {tx.payment_status === 'completed' && (
                  <View style={styles.txBottom}>
                    <Text style={styles.txDate}>
                      Paid {formatDate(tx.paid_at || tx.created_at)}
                    </Text>
                    <Text style={styles.txFee}>
                      Fee: {formatCurrency(tx.platform_fee)}
                      {tx.payout_fee > 0 ? ` + ${formatCurrency(tx.payout_fee)}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  bankingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BRAND_BLUE,
  },
  bankingButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_BLUE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
  },
  summaryCardEarned: {
    backgroundColor: colors.info[50],
  },
  summaryCardPending: {
    backgroundColor: colors.warning[50],
  },
  summaryCardNet: {
    backgroundColor: colors.success[50],
  },
  summaryCardSchedule: {
    backgroundColor: '#F3E8FF',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
    marginTop: 4,
  },
  summarySub: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  feesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background.tertiary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  feesBannerText: {
    fontSize: 12,
    color: colors.text.secondary,
    flex: 1,
  },
  bankingStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  bankingStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bankingStatusTextWrap: {
    flex: 1,
  },
  bankingStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  bankingStatusSub: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  transactionsList: {
    gap: 10,
  },
  transactionCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  txTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  txLeft: {
    flex: 1,
    marginRight: 12,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  txInvoice: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND_GREEN,
  },
  txStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 4,
  },
  txStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  txBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  txDate: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  txFee: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
});
