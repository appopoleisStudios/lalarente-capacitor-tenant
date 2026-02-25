/**
 * Tenant Holding Deposit Screen
 *
 * RHA s5A: Holding deposit must be refunded if application is unsuccessful.
 * Shows status, payment deadline countdown, and property hold information.
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
import {
  holdingDepositApi,
  HoldingDeposit,
  HoldingDepositStatus,
} from '@/src/features/applications/api/holdingDeposit.api';
import { colors } from '@/src/shared/theme/colors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatZAR = (amount: number) =>
  `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getCountdown = (deadline: string | null): string => {
  if (!deadline) return '';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} remaining`;
};

const STATUS_CONFIG: Record<HoldingDepositStatus, {
  label: string;
  color: string;
  bg: string;
  icon: string;
  description: string;
}> = {
  pending: {
    label: 'Payment Required',
    color: '#D97706',
    bg: '#FEF3C7',
    icon: 'time',
    description: 'Pay now to secure this property while your application is reviewed.',
  },
  paid: {
    label: 'Property Secured',
    color: colors.rsa.green,
    bg: '#E6F7F0',
    icon: 'shield-checkmark',
    description: 'Your holding deposit has been received. The property is held for you.',
  },
  applied: {
    label: 'Applied to Lease',
    color: colors.rsa.blue,
    bg: '#E6EBF5',
    icon: 'checkmark-done-circle',
    description: 'Your holding deposit has been applied to your first month / security deposit.',
  },
  refunded: {
    label: 'Refunded',
    color: '#6B7280',
    bg: '#F3F4F6',
    icon: 'arrow-undo-circle',
    description: 'Your holding deposit has been refunded in full per RHA s5A.',
  },
  forfeited: {
    label: 'Forfeited',
    color: colors.rsa.red,
    bg: '#FEF2F2',
    icon: 'close-circle',
    description: 'The holding deposit was forfeited. Contact your landlord if you believe this is incorrect.',
  },
  expired: {
    label: 'Expired',
    color: '#9CA3AF',
    bg: '#F9FAFB',
    icon: 'alert-circle',
    description: 'The payment deadline passed. The property hold has lapsed.',
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepositWithProperty extends HoldingDeposit {
  property?: {
    id: string;
    title: string;
    address: string;
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TenantHoldingDepositScreen() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<DepositWithProperty[]>([]);
  const [loading, setLoading] = useState(true);

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

      const data = await holdingDepositApi.getTenantDeposits(user.id);
      setDeposits(data as DepositWithProperty[]);
    } catch (err: any) {
      console.error('Error loading holding deposits:', err);
      Alert.alert('Error', 'Failed to load holding deposits');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = (deposit: DepositWithProperty) => {
    Alert.alert(
      'Confirm Payment',
      `Mark ${formatZAR(deposit.amount)} holding deposit as paid for ${deposit.property?.title}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Payment',
          onPress: async () => {
            try {
              await holdingDepositApi.confirmPayment(deposit.id, 'eft');
              Alert.alert(
                'Payment Confirmed',
                'Your holding deposit has been recorded. The property is now held for you while your application is reviewed.'
              );
              loadDeposits();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to confirm payment');
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
          <Text style={styles.title}>Holding Deposits</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.green} />
        </View>
      </SafeAreaView>
    );
  }

  const activeDeposits = deposits.filter(d => d.status === 'pending' || d.status === 'paid');
  const pastDeposits = deposits.filter(d => !['pending', 'paid'].includes(d.status));

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Holding Deposits</Text>
          <Text style={styles.subtitle}>Secure properties during your application</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {deposits.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-open-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Holding Deposits</Text>
            <Text style={styles.emptySubtitle}>
              When you pay a holding deposit to secure a property, it will appear here
            </Text>
          </View>
        ) : (
          <>
            {/* Active Deposits */}
            {activeDeposits.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active</Text>
                {activeDeposits.map(deposit => (
                  <DepositCard
                    key={deposit.id}
                    deposit={deposit}
                    onConfirmPayment={handleConfirmPayment}
                  />
                ))}
              </View>
            )}

            {/* Past Deposits */}
            {pastDeposits.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>History</Text>
                {pastDeposits.map(deposit => (
                  <DepositCard key={deposit.id} deposit={deposit} />
                ))}
              </View>
            )}
          </>
        )}

        {/* Rights Notice */}
        <View style={styles.legalCard}>
          <Text style={styles.legalTitle}>Your Rights (RHA s5A)</Text>
          <Text style={styles.legalItem}>• Holding deposit MUST be refunded if your application is rejected</Text>
          <Text style={styles.legalItem}>• It can only be forfeited if you withdraw after paying</Text>
          <Text style={styles.legalItem}>• If approved, it applies to your first month / security deposit</Text>
          <Text style={styles.legalItem}>• Escalate non-refunds to the Rental Housing Tribunal</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Deposit Card ─────────────────────────────────────────────────────────────

function DepositCard({
  deposit,
  onConfirmPayment,
}: {
  deposit: DepositWithProperty;
  onConfirmPayment?: (d: DepositWithProperty) => void;
}) {
  const config = STATUS_CONFIG[deposit.status] || STATUS_CONFIG.pending;
  const countdown = getCountdown(deposit.payment_deadline);
  const holdCountdown = getCountdown(deposit.hold_expires_at);
  const isDeadlineSoon =
    deposit.payment_deadline &&
    new Date(deposit.payment_deadline).getTime() - Date.now() < 12 * 60 * 60 * 1000;

  return (
    <View style={styles.card}>
      {/* Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: config.bg }]}>
        <Ionicons name={config.icon as any} size={18} color={config.color} />
        <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
      </View>

      <View style={styles.cardBody}>
        {/* Property */}
        <View style={styles.propertyRow}>
          <Ionicons name="home" size={16} color={colors.text.secondary} />
          <View style={styles.propertyInfo}>
            <Text style={styles.propertyTitle}>
              {(deposit as any).property?.title || 'Property'}
            </Text>
            <Text style={styles.propertyAddress}>
              {(deposit as any).property?.address || ''}
            </Text>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Holding Deposit</Text>
          <Text style={styles.amountValue}>{formatZAR(deposit.amount)}</Text>
        </View>

        {/* Payment deadline (pending only) */}
        {deposit.status === 'pending' && deposit.payment_deadline && (
          <View style={[
            styles.deadlineRow,
            isDeadlineSoon && { backgroundColor: '#FEF2F2' },
          ]}>
            <Ionicons
              name="time"
              size={14}
              color={isDeadlineSoon ? colors.rsa.red : '#D97706'}
            />
            <Text style={[
              styles.deadlineText,
              isDeadlineSoon && { color: colors.rsa.red },
            ]}>
              Pay by {formatDate(deposit.payment_deadline)} · {countdown}
            </Text>
          </View>
        )}

        {/* Hold expiry (paid only) */}
        {deposit.status === 'paid' && deposit.hold_expires_at && (
          <View style={styles.holdRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.rsa.green} />
            <Text style={styles.holdText}>
              Property held until {formatDate(deposit.hold_expires_at)} · {holdCountdown}
            </Text>
          </View>
        )}

        {/* Status description */}
        <Text style={styles.description}>{config.description}</Text>

        {/* Paid at / Refunded at */}
        {deposit.paid_at && (
          <Text style={styles.metaText}>
            Paid: {formatDate(deposit.paid_at)}
          </Text>
        )}

        {/* Action: Confirm payment if pending */}
        {deposit.status === 'pending' && onConfirmPayment && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onConfirmPayment(deposit)}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.rsa.white} />
            <Text style={styles.actionButtonText}>I Have Paid</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
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
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardBody: {
    padding: 16,
    gap: 10,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  propertyInfo: { flex: 1 },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  propertyAddress: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
  },
  amountLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.rsa.blue,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
  },
  deadlineText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
  },
  holdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    padding: 10,
  },
  holdText: {
    fontSize: 13,
    color: colors.rsa.green,
    flex: 1,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  metaText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.rsa.green,
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.white,
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
