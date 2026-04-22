/**
 * Owner Arrears Management Screen
 *
 * Dashboard for owners to manage tenant arrears with legal escalation stages.
 * Follows CPA s14 escalation process.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import {
  arrearsEscalationApi,
  type ArrearsEscalation,
  type EscalationSummary,
} from '@/src/features/payments/api/arrearsEscalation.api';
import { paymentDisputesApi } from '@/src/features/payments/api/paymentDisputes.api';

const STAGE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  friendly_reminder: { label: 'Reminder', color: colors.warning[500], icon: 'notifications-outline' },
  formal_demand: { label: 'Demand', color: '#E67E22', icon: 'mail-outline' },
  breach_notice: { label: 'Breach Notice', color: colors.error[500], icon: 'alert-circle-outline' },
  cure_period: { label: 'Cure Period', color: colors.error[600], icon: 'time-outline' },
  legal_action: { label: 'Legal', color: '#8E44AD', icon: 'briefcase-outline' },
  eviction_notice: { label: 'Eviction', color: colors.rsa.red, icon: 'warning-outline' },
  resolved: { label: 'Resolved', color: colors.success[500], icon: 'checkmark-circle-outline' },
};

export default function OwnerArrearsManagementScreen() {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [summary, setSummary] = useState<EscalationSummary | null>(null);
  const [arrangements, setArrangements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ownerId) fetchData();
    }, [ownerId])
  );

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      fetchDataForOwner(user.id);
    }
  };

  const fetchData = () => {
    if (ownerId) fetchDataForOwner(ownerId);
  };

  const fetchDataForOwner = async (uid: string) => {
    try {
      setLoading(true);
      const [escalationsData, arrangementsData] = await Promise.all([
        arrearsEscalationApi.getOwnerEscalations(uid),
        paymentDisputesApi.getOwnerArrangements(uid),
      ]);
      setSummary(escalationsData);
      setArrangements(arrangementsData);
    } catch (err) {
      console.error('Error fetching arrears:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = (escalation: ArrearsEscalation) => {
    Alert.alert(
      'Resolve Arrears',
      `Mark this arrears (R${escalation.total_owed.toFixed(2)}) as resolved?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resolve',
          onPress: async () => {
            try {
              await arrearsEscalationApi.resolveEscalation(escalation.id, 'Payment received');
              if (ownerId) fetchDataForOwner(ownerId);
            } catch (err) {
              Alert.alert('Error', 'Failed to resolve escalation');
            }
          },
        },
      ]
    );
  };

  const handleAcceptArrangement = (arrangement: any) => {
    Alert.alert(
      'Accept Payment Plan',
      `Accept R${arrangement.monthly_instalment.toFixed(2)}/mo × ${arrangement.number_of_instalments} instalments from ${arrangement.tenant?.full_name || 'tenant'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          onPress: async () => {
            try {
              await paymentDisputesApi.acceptArrangement(arrangement.id, ownerId!);
              if (ownerId) fetchDataForOwner(ownerId);
              Alert.alert('Accepted', 'Payment arrangement accepted. The tenant will be notified.');
            } catch (err) {
              Alert.alert('Error', 'Failed to accept arrangement');
            }
          },
        },
      ]
    );
  };

  const handleRejectArrangement = (arrangement: any) => {
    Alert.alert(
      'Reject Payment Plan',
      `Decline the proposed instalment plan from ${arrangement.tenant?.full_name || 'tenant'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentDisputesApi.rejectArrangement(arrangement.id, ownerId!);
              if (ownerId) fetchDataForOwner(ownerId);
            } catch (err) {
              Alert.alert('Error', 'Failed to reject arrangement');
            }
          },
        },
      ]
    );
  };

  const handleEscalate = (escalation: ArrearsEscalation) => {
    Alert.alert(
      'Escalate to Legal Action',
      'This will escalate the arrears to legal action stage. The cure period must have expired. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Escalate',
          style: 'destructive',
          onPress: async () => {
            try {
              await arrearsEscalationApi.escalateToLegalAction(escalation.id);
              if (ownerId) fetchDataForOwner(ownerId);
            } catch (err) {
              Alert.alert('Error', 'Failed to escalate');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.navigate('/(owner)/dashboard')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Arrears Management</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.error[50] }]}>
            <Text style={styles.summaryValue}>
              R{(summary?.totalOwed || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.summaryLabel}>Total Owed</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.warning[50] }]}>
            <Text style={styles.summaryValue}>
              R{(summary?.totalInterest || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.summaryLabel}>Interest</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.info[50] }]}>
            <Text style={styles.summaryValue}>{summary?.tenantsInArrears || 0}</Text>
            <Text style={styles.summaryLabel}>Tenants</Text>
          </View>
        </View>

        {/* Legal Notice */}
        <View style={styles.legalNotice}>
          <Ionicons name="information-circle" size={18} color={colors.info[500]} />
          <Text style={styles.legalText}>
            Interest capped at 2% p.a. per Prescribed Rate of Interest Act.
            CPA s14 requires 20 business day cure period before legal action.
          </Text>
        </View>

        {/* Proposed Payment Plans */}
        {arrangements.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary[600]} />
              <Text style={styles.sectionTitle}>
                Proposed Payment Plans ({arrangements.length})
              </Text>
            </View>
            {arrangements.map((arr) => (
              <View key={arr.id} style={styles.arrangementCard}>
                <View style={styles.arrangementHeader}>
                  <View>
                    <Text style={styles.arrangementTenant}>{arr.tenant?.full_name || 'Tenant'}</Text>
                    <Text style={styles.arrangementProperty}>
                      {arr.lease?.property?.title || 'Property'}
                    </Text>
                  </View>
                  <View style={styles.arrangementAmounts}>
                    <Text style={styles.arrangementMonthly}>
                      R{arr.monthly_instalment.toFixed(2)}/mo
                    </Text>
                    <Text style={styles.arrangementTotal}>
                      {arr.number_of_instalments} instalments · R{arr.total_owed.toFixed(2)} total
                    </Text>
                  </View>
                </View>
                <Text style={styles.arrangementDate}>
                  Starts {new Date(arr.start_date).toLocaleDateString('en-ZA')} · Proposed{' '}
                  {new Date(arr.created_at).toLocaleDateString('en-ZA')}
                </Text>
                <View style={styles.arrangementActions}>
                  <TouchableOpacity
                    style={styles.acceptArrBtn}
                    onPress={() => handleAcceptArrangement(arr)}
                  >
                    <Text style={styles.acceptArrBtnText}>Accept Plan</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectArrBtn}
                    onPress={() => handleRejectArrangement(arr)}
                  >
                    <Text style={styles.rejectArrBtnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Escalation List */}
        {(!summary?.escalations || summary.escalations.length === 0) ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle-outline" size={64} color={colors.success[500]} />
            <Text style={styles.emptyTitle}>No Arrears</Text>
            <Text style={styles.emptyText}>All tenants are up to date with payments</Text>
          </View>
        ) : (
          summary.escalations.map((escalation) => {
            const config = STAGE_CONFIG[escalation.stage] || STAGE_CONFIG.friendly_reminder;
            return (
              <View key={escalation.id} style={styles.escalationCard}>
                <View style={styles.escalationHeader}>
                  <View style={[styles.stageBadge, { backgroundColor: config.color + '20' }]}>
                    <Ionicons name={config.icon as any} size={16} color={config.color} />
                    <Text style={[styles.stageText, { color: config.color }]}>{config.label}</Text>
                  </View>
                  <Text style={styles.escalationAmount}>
                    R{escalation.total_owed.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                  </Text>
                </View>

                <View style={styles.escalationDetails}>
                  <Text style={styles.detailText}>
                    Principal: R{escalation.amount_owed.toFixed(2)} | Interest: R{escalation.interest_accrued.toFixed(2)}
                  </Text>
                  {escalation.cure_period_ends_at && (
                    <Text style={styles.detailText}>
                      Cure deadline: {new Date(escalation.cure_period_ends_at).toLocaleDateString('en-ZA')}
                    </Text>
                  )}
                </View>

                <View style={styles.escalationActions}>
                  <TouchableOpacity
                    style={styles.resolveButton}
                    onPress={() => handleResolve(escalation)}
                  >
                    <Text style={styles.resolveButtonText}>Resolve</Text>
                  </TouchableOpacity>

                  {(escalation.stage === 'cure_period' || escalation.stage === 'breach_notice') && (
                    <TouchableOpacity
                      style={styles.escalateButton}
                      onPress={() => handleEscalate(escalation)}
                    >
                      <Text style={styles.escalateButtonText}>Escalate</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
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
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  legalNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.info[50],
    padding: 12,
    borderRadius: 10,
    gap: 8,
    marginBottom: 20,
  },
  legalText: {
    flex: 1,
    fontSize: 12,
    color: colors.info[700],
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
    marginTop: 4,
  },
  escalationCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  escalationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '700',
  },
  escalationAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.error[500],
  },
  escalationDetails: {
    marginBottom: 12,
  },
  detailText: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  escalationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  resolveButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.success[500],
    alignItems: 'center',
  },
  resolveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  escalateButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.error[500],
    alignItems: 'center',
  },
  escalateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  arrangementCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  arrangementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  arrangementTenant: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  arrangementProperty: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  arrangementAmounts: {
    alignItems: 'flex-end',
  },
  arrangementMonthly: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary[600],
  },
  arrangementTotal: {
    fontSize: 11,
    color: colors.text.secondary,
    marginTop: 2,
  },
  arrangementDate: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 10,
  },
  arrangementActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptArrBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.success[500],
    alignItems: 'center',
  },
  acceptArrBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  rejectArrBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background.secondary,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  rejectArrBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
