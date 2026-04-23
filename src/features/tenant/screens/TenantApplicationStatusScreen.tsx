/**
 * Tenant Application Status Screen
 *
 * Shows all rental applications with current status, position in queue,
 * shortlist status, and affordability ratio.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/shared/theme/colors';

interface HoldingDepositSummary {
  id: string;
  application_id: string | null;
  amount: number;
  status: string;
  payment_deadline: string | null;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApplicationRecord {
  id: string;
  property_id: string;
  status: string;
  backup_rank: number | null;
  shortlisted: boolean;
  affordability_ratio: number | null;
  credit_check_status: string | null;
  created_at: string;
  property?: {
    id: string;
    title: string;
    address: string;
    rent_amount: number | null;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  icon: string;
}> = {
  draft: { label: 'Draft', color: '#9CA3AF', bg: '#F9FAFB', icon: 'create-outline' },
  submitted: { label: 'Submitted', color: '#D97706', bg: '#FEF3C7', icon: 'paper-plane' },
  under_review: { label: 'Under Review', color: colors.rsa.blue, bg: '#E6EBF5', icon: 'eye' },
  shortlisted: { label: 'Shortlisted', color: colors.rsa.green, bg: '#E6F7F0', icon: 'star' },
  backup: { label: 'Backup', color: '#7C3AED', bg: '#EDE9FE', icon: 'bookmark' },
  approved: { label: 'Approved', color: colors.rsa.green, bg: '#E6F7F0', icon: 'checkmark-circle' },
  rejected: { label: 'Not Selected', color: '#6B7280', bg: '#F3F4F6', icon: 'close-circle' },
  withdrawn: { label: 'Withdrawn', color: '#9CA3AF', bg: '#F9FAFB', icon: 'remove-circle' },
};

const CREDIT_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#D97706' },
  passed: { label: 'Passed', color: colors.rsa.green },
  failed: { label: 'Failed', color: colors.rsa.red },
  waived: { label: 'Waived', color: '#6B7280' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TenantApplicationStatusScreen() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [holdingDeposits, setHoldingDeposits] = useState<Record<string, HoldingDepositSummary>>({});
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadApplications();
    }, [])
  );

  const loadApplications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('rental_applications')
        .select(`
          id, property_id, status, backup_rank, shortlisted,
          affordability_ratio, credit_check_status, created_at,
          property:properties!property_id(id, title, address, rent_amount)
        `)
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const apps = (data || []) as unknown as ApplicationRecord[];
      setApplications(apps);

      // Load pending holding deposits keyed by application_id
      if (apps.length > 0) {
        const appIds = apps.map(a => a.id);
        const { data: deposits } = await supabase
          .from('holding_deposits')
          .select('id, application_id, amount, status, payment_deadline')
          .in('application_id', appIds)
          .in('status', ['pending', 'paid']);
        const depositMap: Record<string, HoldingDepositSummary> = {};
        for (const d of (deposits || []) as HoldingDepositSummary[]) {
          if (d.application_id) depositMap[d.application_id] = d;
        }
        setHoldingDeposits(depositMap);
      }
    } catch (err: any) {
      console.error('Error loading applications:', err);
      Alert.alert('Error', 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = (app: ApplicationRecord) => {
    if (!['submitted', 'under_review', 'shortlisted', 'backup'].includes(app.status)) return;

    Alert.alert(
      'Withdraw Application',
      `Withdraw your application for ${app.property?.title}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase
                .from('rental_applications')
                .update({ status: 'withdrawn' })
                .eq('id', app.id);
              loadApplications();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to withdraw');
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
          <Text style={styles.title}>My Applications</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.green} />
        </View>
      </SafeAreaView>
    );
  }

  const active = applications.filter(a =>
    ['submitted', 'under_review', 'shortlisted', 'backup'].includes(a.status)
  );
  const approved = applications.filter(a => a.status === 'approved');
  const past = applications.filter(a =>
    ['rejected', 'withdrawn', 'draft'].includes(a.status)
  );

  const renderSection = (title: string, items: ApplicationRecord[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {items.map(app => (
          <ApplicationCard
            key={app.id}
            app={app}
            deposit={holdingDeposits[app.id] || null}
            onWithdraw={handleWithdraw}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>My Applications</Text>
          <Text style={styles.subtitle}>{applications.length} total</Text>
        </View>
      </View>

      {applications.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Applications Yet</Text>
          <Text style={styles.emptySubtitle}>
            Browse properties and apply — your applications will track here
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(tenant)/search' as any)}
          >
            <Text style={styles.browseButtonText}>Browse Properties</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={() => null}
          ListHeaderComponent={
            <View style={styles.listContent}>
              {renderSection('Approved', approved)}
              {renderSection('Active Applications', active)}
              {renderSection('Past Applications', past)}
            </View>
          }
          keyExtractor={() => 'list'}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

function ApplicationCard({
  app,
  deposit,
  onWithdraw,
}: {
  app: ApplicationRecord;
  deposit: HoldingDepositSummary | null;
  onWithdraw: (a: ApplicationRecord) => void;
}) {
  const router = useRouter();
  const config = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted;
  const creditInfo = app.credit_check_status
    ? CREDIT_CONFIG[app.credit_check_status]
    : null;
  const canWithdraw = ['submitted', 'under_review', 'shortlisted', 'backup'].includes(app.status);
  const affordability = app.affordability_ratio;

  return (
    <View style={styles.appCard}>
      {/* Status Bar */}
      <View style={[styles.statusBar, { backgroundColor: config.bg }]}>
        <View style={styles.statusLeft}>
          <Ionicons name={config.icon as any} size={16} color={config.color} />
          <Text style={[styles.statusLabel, { color: config.color }]}>{config.label}</Text>
        </View>
        {app.backup_rank && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>Backup #{app.backup_rank}</Text>
          </View>
        )}
        {app.shortlisted && app.status === 'shortlisted' && (
          <View style={styles.shortlistBadge}>
            <Ionicons name="star" size={12} color={colors.secondary[500]} />
            <Text style={styles.shortlistText}>Shortlisted</Text>
          </View>
        )}
      </View>

      <View style={styles.appBody}>
        {/* Property */}
        <Text style={styles.propertyTitle} numberOfLines={1}>
          {app.property?.title || 'Property'}
        </Text>
        <Text style={styles.propertyAddress} numberOfLines={1}>
          {app.property?.address || ''}
        </Text>
        {app.property?.rent_amount && (
          <Text style={styles.rentText}>
            R {app.property.rent_amount.toLocaleString('en-ZA')}/month
          </Text>
        )}

        {/* Holding Deposit Banner */}
        {deposit && deposit.status === 'pending' && (
          <TouchableOpacity
            style={styles.depositBanner}
            onPress={() => router.push('/(tenant)/holding-deposit' as any)}
          >
            <Ionicons name="lock-closed" size={16} color="#D97706" />
            <View style={styles.depositBannerText}>
              <Text style={styles.depositBannerTitle}>
                Holding deposit required — R {deposit.amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              {deposit.payment_deadline && (
                <Text style={styles.depositBannerDeadline}>
                  Pay by {new Date(deposit.payment_deadline).toLocaleDateString('en-ZA')} to secure this property
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#D97706" />
          </TouchableOpacity>
        )}
        {deposit && deposit.status === 'paid' && (
          <View style={styles.depositPaidBanner}>
            <Ionicons name="shield-checkmark" size={16} color={colors.rsa.green} />
            <Text style={styles.depositPaidText}>
              Holding deposit paid — property secured
            </Text>
          </View>
        )}

        {/* Metrics */}
        <View style={styles.metricsRow}>
          {affordability !== null && (
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Affordability</Text>
              <Text style={[
                styles.metricValue,
                { color: affordability <= 30 ? colors.rsa.green : '#D97706' },
              ]}>
                {affordability.toFixed(0)}%
              </Text>
              <Text style={styles.metricSub}>of income</Text>
            </View>
          )}
          {creditInfo && (
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Credit Check</Text>
              <Text style={[styles.metricValue, { color: creditInfo.color }]}>
                {creditInfo.label}
              </Text>
            </View>
          )}
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Applied</Text>
            <Text style={styles.metricValue}>{formatDate(app.created_at)}</Text>
          </View>
        </View>

        {/* Approved message */}
        {app.status === 'approved' && (
          <View style={styles.approvedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={colors.rsa.green} />
            <Text style={styles.approvedText}>
              Congratulations! Your application has been approved. Your landlord will contact you to proceed with the lease.
            </Text>
          </View>
        )}

        {/* Backup notice */}
        {app.status === 'backup' && (
          <View style={styles.backupBanner}>
            <Ionicons name="information-circle" size={16} color="#7C3AED" />
            <Text style={styles.backupText}>
              You are backup #{app.backup_rank}. You will be contacted if the primary applicant withdraws.
            </Text>
          </View>
        )}

        {/* Withdraw */}
        {canWithdraw && (
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => onWithdraw(app)}
          >
            <Text style={styles.withdrawButtonText}>Withdraw Application</Text>
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
    padding: 32,
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
  browseButton: {
    backgroundColor: colors.rsa.green,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 8,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
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
  appCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  rankBadge: {
    backgroundColor: '#EDE9FE',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  shortlistBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  shortlistText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  appBody: {
    padding: 16,
    gap: 8,
  },
  propertyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  propertyAddress: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  rentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.rsa.blue,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderColor: colors.border.default,
    marginTop: 4,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  metricSub: {
    fontSize: 10,
    color: colors.text.secondary,
  },
  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    padding: 12,
  },
  approvedText: {
    flex: 1,
    fontSize: 13,
    color: colors.rsa.green,
    lineHeight: 18,
    fontWeight: '500',
  },
  backupBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    padding: 12,
  },
  backupText: {
    flex: 1,
    fontSize: 13,
    color: '#5B21B6',
    lineHeight: 18,
  },
  withdrawButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  withdrawButtonText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  depositBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  depositBannerText: { flex: 1 },
  depositBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  depositBannerDeadline: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  depositPaidBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F7F0',
    borderRadius: 8,
    padding: 10,
  },
  depositPaidText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.rsa.green,
  },
});
