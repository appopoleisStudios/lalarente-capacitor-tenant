/**
 * Vendor Contracts List Screen
 * Shows all service contracts for the vendor, grouped by status:
 * - Active (in_progress, active)
 * - Pending (draft, pending_owner, pending_vendor, pending_tenant)
 * - Expired (completed, expired, terminated, cancelled)
 * Each contract card shows title, property, dates, value, and status.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/shared/theme/colors';

const BRAND_BLUE = colors.info[500];
const BRAND_GREEN = colors.success[500];

type ContractTab = 'active' | 'pending' | 'expired' | 'other';

interface ServiceContract {
  id: string;
  title: string;
  status: string;
  contract_type: string | null;
  contract_value: number | null;
  start_date: string | null;
  end_date: string | null;
  completion_date: string | null;
  auto_renew: boolean | null;
  priority: string | null;
  sla_hours: number | null;
  owner_rating: number | null;
  vendor_rating: number | null;
  property: { title: string } | null;
  maintenance_request: { title: string } | null;
  owner: { full_name: string | null } | null;
  created_at: string;
  updated_at: string | null;
}

const ACTIVE_STATUSES = ['active', 'in_progress', 'acknowledged'];
const PENDING_STATUSES = ['draft', 'pending_owner', 'pending_vendor', 'pending_tenant', 'quoting'];
const EXPIRED_STATUSES = ['completed', 'expired', 'terminated', 'cancelled'];

const ALL_KNOWN_STATUSES = [...ACTIVE_STATUSES, ...PENDING_STATUSES, ...EXPIRED_STATUSES];

function isOtherStatus(status: string): boolean {
  return !ALL_KNOWN_STATUSES.includes(status);
}

const TAB_OPTIONS: { key: ContractTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'active', label: 'Active', icon: 'checkmark-circle' },
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'expired', label: 'Expired', icon: 'archive-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

function formatCurrency(amount: number | null) {
  if (amount == null) return '—';
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function statusColor(status: string): string {
  switch (status) {
    case 'active':
    case 'in_progress':
    case 'acknowledged':
      return BRAND_GREEN;
    case 'completed':
      return colors.info[500];
    case 'expired':
    case 'terminated':
    case 'cancelled':
      return colors.error[500];
    case 'draft':
    case 'pending_owner':
    case 'pending_vendor':
    case 'pending_tenant':
    case 'quoting':
      return colors.warning[500];
    default:
      return colors.gray[400];
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'Active';
    case 'in_progress': return 'In Progress';
    case 'acknowledged': return 'Acknowledged';
    case 'completed': return 'Completed';
    case 'expired': return 'Expired';
    case 'terminated': return 'Terminated';
    case 'cancelled': return 'Cancelled';
    case 'draft': return 'Draft';
    case 'pending_owner': return 'Awaiting Owner';
    case 'pending_vendor': return 'Awaiting You';
    case 'pending_tenant': return 'Awaiting Tenant';
    case 'quoting': return 'Awaiting Quote';
    default: return status;
  }
}

function priorityIcon(priority: string | null): keyof typeof Ionicons.glyphMap {
  switch (priority) {
    case 'urgent': return 'alert-circle';
    case 'high': return 'arrow-up-circle';
    case 'medium': return 'remove-circle';
    default: return 'ellipse-outline';
  }
}

export default function VendorContractsListScreen() {
  const router = useRouter();
  const [contracts, setContracts] = useState<ServiceContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ContractTab>('active');
  const refreshingRef = useRef(false);

  const loadContracts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'You must be logged in.');
        return;
      }

      const { data, error } = await supabase
        .from('service_contracts')
        .select(`
          id, title, status, contract_type, contract_value,
          start_date, end_date, completion_date,
          auto_renew, priority, sla_hours,
          owner_rating, vendor_rating,
          created_at, updated_at,
          property:property_id(title),
          maintenance_request:maintenance_request_id(title),
          owner:profiles!owner_id(full_name)
        `)
        .eq('vendor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContracts((data || []) as ServiceContract[]);
    } catch (err: any) {
      console.error('Error loading contracts:', err);
      if (!refreshingRef.current) {
        Alert.alert('Error', err.message || 'Failed to load contracts');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      refreshingRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loading) setLoading(true);
      loadContracts();
    }, [loadContracts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    refreshingRef.current = true;
    loadContracts();
  };

  const filteredContracts = contracts.filter((c) => {
    switch (activeTab) {
      case 'active': return ACTIVE_STATUSES.includes(c.status);
      case 'pending': return PENDING_STATUSES.includes(c.status);
      case 'expired': return EXPIRED_STATUSES.includes(c.status);
      case 'other': return isOtherStatus(c.status);
      default: return false;
    }
  });

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Contracts</Text>
        <Text style={styles.headerCount}>
          {contracts.length} total
        </Text>
      </View>

      {/* Status Tabs */}
      <View style={styles.tabRow}>
        {TAB_OPTIONS.map((tab) => {
          const count = contracts.filter((c) => {
            switch (tab.key) {
              case 'active': return ACTIVE_STATUSES.includes(c.status);
              case 'pending': return PENDING_STATUSES.includes(c.status);
              case 'expired': return EXPIRED_STATUSES.includes(c.status);
              case 'other': return isOtherStatus(c.status);
              default: return false;
            }
          }).length;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tabButton,
                activeTab === tab.key && styles.tabButtonActive,
              ]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={14}
                color={activeTab === tab.key ? BRAND_BLUE : colors.gray[400]}
                accessibilityElementsHidden
              />
              <Text style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.tabBadge,
                  { backgroundColor: activeTab === tab.key ? BRAND_BLUE : colors.gray[200] },
                ]}>
                  <Text style={[
                    styles.tabBadgeText,
                    { color: activeTab === tab.key ? '#FFF' : colors.gray[500] },
                  ]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BRAND_BLUE]} />
        }
      >                {filteredContracts.length === 0 ? (
          <View style={styles.emptyState} accessibilityLabel={`No ${activeTab} contracts`}>
            <Ionicons
              name={activeTab === 'active' ? 'checkmark-done-outline' : activeTab === 'pending' ? 'time-outline' : 'archive-outline'}
              size={48}
              color={colors.gray[200]}
            />
            <Text style={styles.emptyStateTitle}>
              No {activeTab} contracts
            </Text>
            <Text style={styles.emptyStateSub}>
              {activeTab === 'active' && 'Active job contracts will appear here when you accept work.'}
              {activeTab === 'pending' && 'Pending contracts are waiting for owner or vendor action.'}
              {activeTab === 'expired' && 'Completed, expired, or cancelled contracts will show here.'}
            </Text>
          </View>
        ) : (
          <View style={styles.contractList}>
            {filteredContracts.map((contract) => (
              <TouchableOpacity
                key={contract.id}
                style={styles.contractCard}
                onPress={() => router.push(`/(vendor)/contracts/${contract.id}`)}
                activeOpacity={0.7}
                accessibilityLabel={`Contract: ${contract.title}, ${statusLabel(contract.status)}`}
                accessibilityRole="button"
              >
                {/* Top Row: Title + Status */}
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleWrap}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {contract.title}
                    </Text>
                    {contract.auto_renew && (
                      <Ionicons name="refresh" size={14} color={BRAND_GREEN} />
                    )}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(contract.status) + '15' }]}>
                    <Text style={[styles.statusText, { color: statusColor(contract.status) }]}>
                      {statusLabel(contract.status)}
                    </Text>
                  </View>
                </View>

                {/* Property / Maintenance Reference */}
                <Text style={styles.cardProperty} numberOfLines={1}>
                  {contract.property?.title || contract.maintenance_request?.title || '—'}
                </Text>

                {/* Details Row */}
                <View style={styles.cardDetails}>
                  {contract.contract_value != null && (
                    <View style={styles.cardDetail}>
                      <Ionicons name="cash-outline" size={14} color={colors.gray[400]} />
                      <Text style={styles.cardDetailText}>
                        {formatCurrency(contract.contract_value)}
                      </Text>
                    </View>
                  )}
                  {contract.start_date && (
                    <View style={styles.cardDetail}>
                      <Ionicons name="calendar-outline" size={14} color={colors.gray[400]} />
                      <Text style={styles.cardDetailText}>
                        {formatDate(contract.start_date)}
                        {contract.end_date ? ` - ${formatDate(contract.end_date)}` : ''}
                      </Text>
                    </View>
                  )}
                  {contract.priority && contract.priority !== 'none' && (
                    <Ionicons
                      name={priorityIcon(contract.priority)}
                      size={16}
                      color={contract.priority === 'urgent' ? colors.error[500] : colors.warning[500]}
                    />
                  )}
                </View>

                {/* Owner + Created */}
                <View style={styles.cardFooter}>
                  {contract.owner?.full_name && (
                    <Text style={styles.cardFooterText} numberOfLines={1}>
                      <Ionicons name="person-outline" size={12} color={colors.gray[400]} />{' '}
                      {contract.owner.full_name}
                    </Text>
                  )}
                  <Text style={styles.cardFooterText}>
                    Created {formatDate(contract.created_at)}
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.gray[300]}
                  style={styles.cardChevron}
                />
              </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerCount: {
    fontSize: 13,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.default,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tabButtonActive: {
    backgroundColor: colors.info[50],
    borderColor: BRAND_BLUE,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabLabelActive: {
    color: BRAND_BLUE,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: 12,
  },
  emptyStateSub: {
    fontSize: 13,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  contractList: {
    gap: 12,
  },
  contractCard: {
    backgroundColor: colors.background.default,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    position: 'relative',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardProperty: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 10,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  cardDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDetailText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray[50],
  },
  cardFooterText: {
    fontSize: 11,
    color: colors.text.tertiary,
  },
  cardChevron: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -9,
  },
});
