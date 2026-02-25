/**
 * Owner Holding Deposit Screen
 *
 * Manage holding deposits across all properties.
 * Create deposit requests, track payments, apply to leases.
 * RHA s5A: Deposits must be refunded if application is unsuccessful.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
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

const STATUS_CONFIG: Record<HoldingDepositStatus, {
  label: string;
  color: string;
  bg: string;
}> = {
  pending: { label: 'Awaiting Payment', color: '#D97706', bg: '#FEF3C7' },
  paid: { label: 'Paid – Secured', color: colors.rsa.green, bg: '#E6F7F0' },
  applied: { label: 'Applied to Lease', color: colors.rsa.blue, bg: '#E6EBF5' },
  refunded: { label: 'Refunded', color: '#6B7280', bg: '#F3F4F6' },
  forfeited: { label: 'Forfeited', color: colors.rsa.red, bg: '#FEF2F2' },
  expired: { label: 'Expired', color: '#9CA3AF', bg: '#F9FAFB' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface DepositWithMeta extends HoldingDeposit {
  property?: { id: string; title: string; address: string };
  tenant?: { id: string; full_name: string; email: string | null; phone: string | null };
}

interface Property {
  id: string;
  title: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerHoldingDepositScreen() {
  const router = useRouter();
  const [deposits, setDeposits] = useState<DepositWithMeta[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<HoldingDepositStatus | 'all'>('all');

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

      // Load all holding deposits for owner's properties in one query
      const { data, error } = await supabase
        .from('holding_deposits')
        .select(`
          *,
          property:properties!property_id(id, title, address),
          tenant:profiles!tenant_id(id, full_name, email, phone)
        `)
        .eq('properties.owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeposits((data || []) as unknown as DepositWithMeta[]);

      // Load properties for "Create" modal
      const { data: props } = await supabase
        .from('properties')
        .select('id, title')
        .eq('owner_id', user.id)
        .in('status', ['available', 'viewing_active', 'applications_open', 'holding_deposit'])
        .order('title');
      setProperties((props || []) as Property[]);
    } catch (err: any) {
      console.error('Error loading holding deposits:', err);
      Alert.alert('Error', 'Failed to load holding deposits');
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = (deposit: DepositWithMeta) => {
    Alert.alert(
      'Refund Holding Deposit',
      `Refund ${formatZAR(deposit.amount)} to ${deposit.tenant?.full_name}?\n\nRHA s5A: This is required if the application was unsuccessful.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Refund',
          onPress: async () => {
            try {
              await holdingDepositApi.refundDeposit(deposit.id, 'Application unsuccessful');
              Alert.alert('Refunded', 'The holding deposit has been marked as refunded.');
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to refund');
            }
          },
        },
      ]
    );
  };

  const handleApplyToLease = (deposit: DepositWithMeta) => {
    Alert.alert(
      'Apply to Lease',
      `Apply ${formatZAR(deposit.amount)} from ${deposit.tenant?.full_name} towards their first month / security deposit?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply',
          onPress: async () => {
            try {
              await holdingDepositApi.applyToLease(deposit.id);
              Alert.alert('Applied', 'Holding deposit has been applied to the lease.');
              loadData();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to apply');
            }
          },
        },
      ]
    );
  };

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = filterStatus === 'all'
    ? deposits
    : deposits.filter(d => d.status === filterStatus);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalPaid = deposits
    .filter(d => d.status === 'paid')
    .reduce((sum, d) => sum + d.amount, 0);
  const pendingCount = deposits.filter(d => d.status === 'pending').length;
  const paidCount = deposits.filter(d => d.status === 'paid').length;

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
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  const FILTER_OPTIONS: Array<HoldingDepositStatus | 'all'> = [
    'all', 'pending', 'paid', 'applied', 'refunded',
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Holding Deposits</Text>
          <Text style={styles.subtitle}>{deposits.length} total</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={22} color={colors.rsa.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.rsa.blue }]}>
                  {formatZAR(totalPaid)}
                </Text>
                <Text style={styles.statLabel}>Secured Funds</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#D97706' }]}>{pendingCount}</Text>
                <Text style={styles.statLabel}>Awaiting Payment</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.rsa.green }]}>{paidCount}</Text>
                <Text style={styles.statLabel}>Paid & Active</Text>
              </View>
            </View>

            {/* Legal Notice */}
            <View style={styles.legalNotice}>
              <Ionicons name="information-circle" size={16} color={colors.rsa.blue} />
              <Text style={styles.legalText}>
                RHA s5A: Holding deposits MUST be refunded if the application is rejected. They can only be forfeited if the approved tenant withdraws.
              </Text>
            </View>

            {/* Filter Chips */}
            <View style={styles.filterRow}>
              {FILTER_OPTIONS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterChip,
                    filterStatus === f && { backgroundColor: colors.rsa.blue },
                  ]}
                  onPress={() => setFilterStatus(f)}
                >
                  <Text style={[
                    styles.filterChipText,
                    filterStatus === f && { color: colors.rsa.white },
                  ]}>
                    {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label || f}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <DepositCard
            deposit={item}
            onRefund={handleRefund}
            onApplyToLease={handleApplyToLease}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="lock-open-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Holding Deposits</Text>
            <Text style={styles.emptySubtitle}>
              Create a holding deposit request to secure a property during application review
            </Text>
          </View>
        }
      />

      {/* Create Deposit Modal */}
      <CreateDepositModal
        visible={showCreateModal}
        properties={properties}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => { setShowCreateModal(false); loadData(); }}
      />
    </SafeAreaView>
  );
}

// ─── Deposit Card ─────────────────────────────────────────────────────────────

function DepositCard({
  deposit,
  onRefund,
  onApplyToLease,
}: {
  deposit: DepositWithMeta;
  onRefund: (d: DepositWithMeta) => void;
  onApplyToLease: (d: DepositWithMeta) => void;
}) {
  const config = STATUS_CONFIG[deposit.status] || STATUS_CONFIG.pending;

  return (
    <View style={styles.card}>
      {/* Status */}
      <View style={[styles.cardStatusRow, { backgroundColor: config.bg }]}>
        <Text style={[styles.cardStatusText, { color: config.color }]}>{config.label}</Text>
        <Text style={styles.cardAmount}>{formatZAR(deposit.amount)}</Text>
      </View>

      <View style={styles.cardBody}>
        {/* Property & Tenant */}
        <View style={styles.cardRow}>
          <Ionicons name="home-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.cardPrimary} numberOfLines={1}>
            {deposit.property?.title || 'Property'}
          </Text>
        </View>
        <View style={styles.cardRow}>
          <Ionicons name="person-outline" size={14} color={colors.text.secondary} />
          <Text style={styles.cardSecondary}>
            {deposit.tenant?.full_name || 'Tenant'} · {deposit.tenant?.phone || deposit.tenant?.email || ''}
          </Text>
        </View>

        {/* Dates */}
        {deposit.payment_deadline && deposit.status === 'pending' && (
          <View style={styles.cardRow}>
            <Ionicons name="time-outline" size={14} color="#D97706" />
            <Text style={[styles.cardSecondary, { color: '#D97706' }]}>
              Pay by: {formatDate(deposit.payment_deadline)}
            </Text>
          </View>
        )}
        {deposit.paid_at && (
          <View style={styles.cardRow}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.rsa.green} />
            <Text style={styles.cardSecondary}>Paid: {formatDate(deposit.paid_at)}</Text>
          </View>
        )}
        {deposit.hold_expires_at && deposit.status === 'paid' && (
          <View style={styles.cardRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.rsa.green} />
            <Text style={styles.cardSecondary}>
              Hold expires: {formatDate(deposit.hold_expires_at)}
            </Text>
          </View>
        )}

        {/* Actions */}
        {deposit.status === 'paid' && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.cardActionBtn, { borderColor: colors.rsa.green }]}
              onPress={() => onApplyToLease(deposit)}
            >
              <Text style={[styles.cardActionText, { color: colors.rsa.green }]}>
                Apply to Lease
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardActionBtn, { borderColor: colors.rsa.red }]}
              onPress={() => onRefund(deposit)}
            >
              <Text style={[styles.cardActionText, { color: colors.rsa.red }]}>
                Refund
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Create Deposit Modal ─────────────────────────────────────────────────────

function CreateDepositModal({
  visible,
  properties,
  onClose,
  onCreated,
}: {
  visible: boolean;
  properties: Property[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!selectedPropertyId || !tenantEmail.trim() || !amount) {
      Alert.alert('Missing Fields', 'Please select a property, enter tenant email, and set the amount.');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount.');
      return;
    }

    setLoading(true);
    try {
      // Find tenant by email
      const { data: tenant, error: tenantError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', tenantEmail.toLowerCase().trim())
        .maybeSingle();

      if (tenantError) throw tenantError;
      if (!tenant) {
        Alert.alert('Tenant Not Found', 'No user found with that email address. The tenant must have a Lalarente account.');
        return;
      }

      await holdingDepositApi.createDeposit(tenant.id, {
        propertyId: selectedPropertyId,
        amount: amountNum,
      });

      Alert.alert('Created', 'Holding deposit request created. The tenant will see it in their app.');
      setSelectedPropertyId('');
      setTenantEmail('');
      setAmount('');
      onCreated();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create deposit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Request Holding Deposit</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.text.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalBody}>
          {/* Property Selector */}
          <Text style={styles.fieldLabel}>Property</Text>
          <View style={styles.propertyPicker}>
            {properties.length === 0 ? (
              <Text style={styles.noPropertiesText}>No listed properties available</Text>
            ) : (
              properties.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.propertyOption,
                    selectedPropertyId === p.id && { borderColor: colors.rsa.blue, backgroundColor: '#E6EBF5' },
                  ]}
                  onPress={() => setSelectedPropertyId(p.id)}
                >
                  <Text style={[
                    styles.propertyOptionText,
                    selectedPropertyId === p.id && { color: colors.rsa.blue, fontWeight: '700' },
                  ]}>
                    {p.title}
                  </Text>
                  {selectedPropertyId === p.id && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.rsa.blue} />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Tenant Email */}
          <Text style={styles.fieldLabel}>Tenant Email</Text>
          <TextInput
            style={styles.textInput}
            value={tenantEmail}
            onChangeText={setTenantEmail}
            placeholder="tenant@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Amount */}
          <Text style={styles.fieldLabel}>Amount (ZAR)</Text>
          <TextInput
            style={styles.textInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="e.g. 5000"
            keyboardType="numeric"
          />

          <View style={styles.modalNotice}>
            <Ionicons name="information-circle" size={14} color={colors.rsa.blue} />
            <Text style={styles.modalNoticeText}>
              Typically 1 month's rent. Must be refunded if the application is unsuccessful (RHA s5A).
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.createButton, loading && { opacity: 0.7 }]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.rsa.white} />
              : <Text style={styles.createButtonText}>Create Deposit Request</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
  createBtn: {
    backgroundColor: colors.rsa.blue,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.background.default,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
    textAlign: 'center',
  },
  legalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E6EBF5',
    borderRadius: 8,
    padding: 12,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: colors.rsa.blue,
    lineHeight: 17,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
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
  cardStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cardStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text.primary,
  },
  cardBody: {
    padding: 16,
    gap: 6,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    flex: 1,
  },
  cardSecondary: {
    fontSize: 13,
    color: colors.text.secondary,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.border.default,
  },
  cardActionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cardActionText: {
    fontSize: 13,
    fontWeight: '700',
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
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeBtn: { padding: 4 },
  modalBody: {
    padding: 20,
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
    marginTop: 4,
  },
  propertyPicker: {
    gap: 8,
  },
  propertyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
  },
  propertyOptionText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  noPropertiesText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text.primary,
    backgroundColor: colors.background.default,
  },
  modalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#E6EBF5',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  modalNoticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.rsa.blue,
    lineHeight: 17,
  },
  createButton: {
    backgroundColor: colors.rsa.blue,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.rsa.white,
  },
});
