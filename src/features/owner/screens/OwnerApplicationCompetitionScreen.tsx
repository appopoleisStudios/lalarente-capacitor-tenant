/**
 * Owner Application Competition Screen
 *
 * Compare and rank tenant applicants for a property.
 * Shortlist, set backups, and select the winning tenant.
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
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import {
  applicationCompetitionApi,
  RankedApplication,
} from '@/src/features/applications/api/applicationCompetition.api';
import { colors } from '@/src/shared/theme/colors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
  });

const CREDIT_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: '#D97706' },
  passed: { label: 'Passed ✓', color: colors.rsa.green },
  failed: { label: 'Failed', color: colors.rsa.red },
  waived: { label: 'Waived', color: '#6B7280' },
};

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Submitted', color: '#D97706', bg: '#FEF3C7' },
  under_review: { label: 'Under Review', color: colors.rsa.blue, bg: '#E6EBF5' },
  shortlisted: { label: 'Shortlisted', color: colors.rsa.green, bg: '#E6F7F0' },
  backup: { label: 'Backup', color: '#7C3AED', bg: '#EDE9FE' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerApplicationCompetitionScreen() {
  const router = useRouter();
  const { propertyId, propertyTitle } = useLocalSearchParams<{
    propertyId: string;
    propertyTitle?: string;
  }>();

  const [applications, setApplications] = useState<RankedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (propertyId) loadApplications();
    }, [propertyId])
  );

  const loadApplications = async () => {
    setLoading(true);
    try {
      const data = await applicationCompetitionApi.getRankedApplications(propertyId!);
      setApplications(data);
    } catch (err: any) {
      console.error('Error loading applications:', err);
      Alert.alert('Error', 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleShortlist = async (app: RankedApplication) => {
    setActionLoading(app.id);
    try {
      await applicationCompetitionApi.shortlistApplication(app.id);
      loadApplications();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to shortlist');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetBackup = async (app: RankedApplication) => {
    const nextRank = applications.filter(a => a.status === 'backup').length + 1;
    setActionLoading(app.id);
    try {
      await applicationCompetitionApi.setBackupRank(app.id, nextRank);
      loadApplications();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to set backup');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectWinner = (app: RankedApplication) => {
    Alert.alert(
      'Select Tenant',
      `Select ${app.tenant?.full_name || 'this applicant'} as your tenant?\n\nAll other applications will be marked as backup. You can still decline and promote a backup if needed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Select as Tenant',
          onPress: async () => {
            setActionLoading(app.id);
            try {
              await applicationCompetitionApi.selectWinner(propertyId!, app.id);
              Alert.alert(
                'Tenant Selected',
                `${app.tenant?.full_name} has been approved. Proceed to create the lease.`,
                [
                  {
                    text: 'Create Lease',
                    onPress: () => router.push(`/(owner)/leases/create?applicationId=${app.id}` as any),
                  },
                  { text: 'Later', style: 'cancel' },
                ]
              );
              loadApplications();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to select tenant');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handlePromoteBackup = () => {
    Alert.alert(
      'Promote Next Backup',
      'The primary tenant has fallen through. Promote the highest-ranked backup applicant to approved?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              const promotedId = await applicationCompetitionApi.promoteNextBackup(propertyId!);
              if (promotedId) {
                Alert.alert('Success', 'Backup applicant has been promoted to approved.');
                loadApplications();
              } else {
                Alert.alert('No Backups', 'There are no backup applicants to promote.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to promote backup');
            }
          },
        },
      ]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasApproved = applications.some(a => a.status === 'approved');
  const hasBackup = applications.some(a => a.status === 'backup');
  const shortlisted = applications.filter(a => a.status === 'shortlisted');
  const reviewing = applications.filter(a =>
    ['submitted', 'under_review'].includes(a.status)
  );
  const backup = applications.filter(a => a.status === 'backup');

  const renderApp = ({ item }: { item: RankedApplication }) => {
    const statusInfo = STATUS_INFO[item.status] || STATUS_INFO.submitted;
    const creditInfo = item.credit_check_status
      ? CREDIT_LABEL[item.credit_check_status]
      : null;
    const isLoading = actionLoading === item.id;
    const canShortlist = ['submitted', 'under_review'].includes(item.status);
    const canSetBackup = item.status === 'shortlisted';
    const canSelect = ['submitted', 'under_review', 'shortlisted'].includes(item.status);
    const affordabilityOk = item.affordability_ratio !== null && item.affordability_ratio <= 30;

    return (
      <View style={styles.appCard}>
        {/* Header Row */}
        <View style={styles.appHeader}>
          <View style={styles.appHeaderLeft}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {(item.tenant?.full_name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.appHeaderInfo}>
              <Text style={styles.tenantName}>{item.tenant?.full_name || 'Unknown'}</Text>
              <Text style={styles.tenantContact}>
                {item.tenant?.email || item.tenant?.phone || ''}
              </Text>
            </View>
          </View>
          <View style={styles.appHeaderRight}>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </Text>
            </View>
            {item.backup_rank && (
              <Text style={styles.backupRankText}>Backup #{item.backup_rank}</Text>
            )}
          </View>
        </View>

        {/* Score Bar */}
        {item.score !== null && (
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Score</Text>
            <View style={styles.scoreBar}>
              <View style={[styles.scoreFill, { width: `${Math.min(item.score, 100)}%` }]} />
            </View>
            <Text style={styles.scoreValue}>{item.score}/100</Text>
          </View>
        )}

        {/* Metrics */}
        <View style={styles.metricsRow}>
          {item.affordability_ratio !== null && (
            <View style={styles.metricChip}>
              <Ionicons
                name={affordabilityOk ? 'checkmark-circle' : 'alert-circle'}
                size={14}
                color={affordabilityOk ? colors.rsa.green : '#D97706'}
              />
              <Text style={[
                styles.metricChipText,
                { color: affordabilityOk ? colors.rsa.green : '#D97706' },
              ]}>
                {item.affordability_ratio.toFixed(0)}% of income
              </Text>
            </View>
          )}
          {creditInfo && (
            <View style={styles.metricChip}>
              <Ionicons name="card" size={14} color={creditInfo.color} />
              <Text style={[styles.metricChipText, { color: creditInfo.color }]}>
                {creditInfo.label}
              </Text>
            </View>
          )}
          <View style={styles.metricChip}>
            <Ionicons name="calendar-outline" size={14} color={colors.text.secondary} />
            <Text style={styles.metricChipText}>{formatDate(item.created_at)}</Text>
          </View>
        </View>

        {/* Actions */}
        {!hasApproved && (
          <View style={styles.actionsRow}>
            {canShortlist && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => handleShortlist(item)}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color={colors.rsa.blue} />
                  : <Text style={styles.actionBtnSecondaryText}>Shortlist</Text>
                }
              </TouchableOpacity>
            )}
            {canSetBackup && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => handleSetBackup(item)}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color={colors.rsa.blue} />
                  : <Text style={styles.actionBtnSecondaryText}>Mark Backup</Text>
                }
              </TouchableOpacity>
            )}
            {canSelect && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrimary]}
                onPress={() => handleSelectWinner(item)}
                disabled={isLoading}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.actionBtnPrimaryText}>Select Tenant</Text>
                }
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Applications</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Applications</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {propertyTitle || 'Property'} · {applications.length} applicant{applications.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={[
          ...shortlisted,
          ...reviewing,
          ...(hasApproved ? applications.filter(a => a.status === 'approved') : []),
          ...backup,
        ]}
        keyExtractor={item => item.id}
        renderItem={renderApp}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{applications.length}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.rsa.green }]}>
                  {shortlisted.length}
                </Text>
                <Text style={styles.statLabel}>Shortlisted</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: '#7C3AED' }]}>
                  {backup.length}
                </Text>
                <Text style={styles.statLabel}>Backup</Text>
              </View>
            </View>

            {/* Approved Banner */}
            {hasApproved && (
              <View style={styles.approvedBanner}>
                <Ionicons name="checkmark-circle" size={20} color={colors.rsa.green} />
                <Text style={styles.approvedText}>Tenant selected. Lease can now be created.</Text>
                {hasBackup && (
                  <TouchableOpacity onPress={handlePromoteBackup} style={styles.promoteBtn}>
                    <Text style={styles.promoteBtnText}>Promote Backup</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={56} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Applications</Text>
            <Text style={styles.emptySubtitle}>
              Applications will appear here once tenants apply for this property
            </Text>
          </View>
        }
      />
    </SafeAreaView>
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
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text.primary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  approvedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F7F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 4,
  },
  approvedText: {
    flex: 1,
    fontSize: 14,
    color: colors.rsa.green,
    fontWeight: '600',
  },
  promoteBtn: {
    backgroundColor: colors.rsa.green,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  promoteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  appCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.rsa.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  appHeaderInfo: { flex: 1 },
  tenantName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tenantContact: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  appHeaderRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  backupRankText: {
    fontSize: 11,
    color: '#7C3AED',
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
    width: 36,
  },
  scoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background.secondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 8,
    backgroundColor: colors.rsa.green,
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
    width: 48,
    textAlign: 'right',
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.secondary,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metricChipText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderColor: colors.border.default,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  actionBtnSecondary: {
    borderWidth: 1,
    borderColor: colors.rsa.blue,
  },
  actionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rsa.blue,
  },
  actionBtnPrimary: {
    backgroundColor: colors.rsa.blue,
    flex: 2,
  },
  actionBtnPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.rsa.white,
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
});
