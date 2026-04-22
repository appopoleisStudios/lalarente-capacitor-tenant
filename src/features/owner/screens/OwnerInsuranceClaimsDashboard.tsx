/**
 * Owner Insurance Claims Dashboard
 *
 * Overview of all insurance claims across the owner's portfolio.
 * Links maintenance requests to insurance claims for damage incidents.
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
import { insuranceClaimsApi, InsuranceClaim, ClaimStatus, ClaimType } from '@/src/features/insurance/api/insuranceClaims.api';
import { colors } from '@/src/shared/theme/colors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatZAR = (amount: number) =>
  `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CLAIM_STATUS_INFO: Record<ClaimStatus, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#6B7280', bg: '#F3F4F6' },
  submitted: { label: 'Submitted', color: '#D97706', bg: '#FEF3C7' },
  acknowledged: { label: 'Acknowledged', color: colors.rsa.blue, bg: '#E6EBF5' },
  assessment: { label: 'Under Assessment', color: '#7C3AED', bg: '#EDE9FE' },
  approved: { label: 'Approved', color: colors.rsa.green, bg: '#E6F7F0' },
  partially_approved: { label: 'Partially Approved', color: '#16A34A', bg: '#DCFCE7' },
  rejected: { label: 'Rejected', color: colors.rsa.red, bg: '#FEF2F2' },
  paid_out: { label: 'Paid Out', color: colors.rsa.green, bg: '#E6F7F0' },
  closed: { label: 'Closed', color: '#6B7280', bg: '#F3F4F6' },
};

const CLAIM_TYPE_ICONS: Record<ClaimType, string> = {
  fire_damage: 'flame',
  water_damage: 'water',
  storm_damage: 'thunderstorm',
  theft: 'lock-open',
  vandalism: 'hammer',
  structural_damage: 'home',
  electrical_damage: 'flash',
  plumbing: 'water-outline',
  natural_disaster: 'leaf',
  other: 'ellipsis-horizontal-circle',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function OwnerInsuranceClaimsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [summary, setSummary] = useState({
    totalClaims: 0,
    activeClaims: 0,
    totalClaimed: 0,
    totalPaidOut: 0,
    pendingAmount: 0,
  });
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'closed'>('all');

  useFocusEffect(
    useCallback(() => {
      loadClaims();
    }, [])
  );

  const loadClaims = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [allClaims, claimSummary] = await Promise.all([
        insuranceClaimsApi.getOwnerClaims(user.id),
        insuranceClaimsApi.getClaimsSummary(user.id),
      ]);

      setClaims(allClaims);
      setSummary(claimSummary);
    } catch (err: any) {
      console.error('Error loading insurance claims:', err);
      Alert.alert('Error', 'Failed to load insurance claims');
    } finally {
      setLoading(false);
    }
  };

  const filteredClaims = claims.filter(c => {
    if (filterStatus === 'active') return !['closed', 'rejected', 'paid_out'].includes(c.status);
    if (filterStatus === 'closed') return ['closed', 'rejected', 'paid_out'].includes(c.status);
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.title}>Insurance Claims</Text>
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
        <Text style={styles.title}>Insurance Claims</Text>
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => router.push('/(owner)/insurance/new')}
        >
          <Ionicons name="add" size={22} color={colors.rsa.white} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{summary.totalClaims}</Text>
            <Text style={styles.statLabel}>Total Claims</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#D97706' }]}>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{summary.activeClaims}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, { borderColor: colors.rsa.green }]}>
            <Text style={[styles.statValue, { color: colors.rsa.green }]}>
              {formatZAR(summary.totalPaidOut)}
            </Text>
            <Text style={styles.statLabel}>Paid Out</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.rsa.blue }]}>
              {formatZAR(summary.pendingAmount)}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'active', 'closed'] as const).map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filterStatus === f && styles.filterTabActive]}
              onPress={() => setFilterStatus(f)}
            >
              <Text style={[styles.filterTabText, filterStatus === f && styles.filterTabTextActive]}>
                {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Resolved'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Claims List */}
        {filteredClaims.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>
              {filterStatus === 'all' ? 'No Claims Yet' : `No ${filterStatus === 'active' ? 'Active' : 'Resolved'} Claims`}
            </Text>
            <Text style={styles.emptySubtitle}>
              {filterStatus === 'all'
                ? 'Tap + to start a new insurance claim'
                : 'Claims will appear here once they match this filter'}
            </Text>
            {filterStatus === 'all' && (
              <TouchableOpacity
                style={styles.newClaimButton}
                onPress={() => router.push('/(owner)/insurance/new')}
              >
                <Ionicons name="add-circle" size={18} color={colors.rsa.white} />
                <Text style={styles.newClaimButtonText}>New Claim</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredClaims.map((claim) => {
            const statusInfo = CLAIM_STATUS_INFO[claim.status];
            const claimIcon = CLAIM_TYPE_ICONS[claim.claim_type] || 'document';
            const property = (claim as any).property;

            return (
              <TouchableOpacity
                key={claim.id}
                style={styles.claimCard}
                onPress={() => router.push(`/(owner)/insurance/${claim.id}`)}
              >
                {/* Claim Type Icon */}
                <View style={styles.claimIcon}>
                  <Ionicons name={claimIcon as any} size={24} color={colors.rsa.blue} />
                </View>

                <View style={styles.claimInfo}>
                  <View style={styles.claimTop}>
                    <Text style={styles.claimType}>
                      {claim.claim_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                      <Text style={[styles.statusText, { color: statusInfo.color }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  {property && (
                    <Text style={styles.propertyName}>{property.title}</Text>
                  )}

                  <Text style={styles.claimDescription} numberOfLines={2}>
                    {claim.description}
                  </Text>

                  <View style={styles.claimBottom}>
                    <Text style={styles.claimDate}>
                      {new Date(claim.incident_date).toLocaleDateString('en-ZA')}
                    </Text>
                    <View style={styles.claimAmounts}>
                      <Text style={styles.estimatedLabel}>Est: </Text>
                      <Text style={styles.estimatedAmount}>
                        {formatZAR(claim.estimated_cost)}
                      </Text>
                      {claim.approved_amount != null && (
                        <>
                          <Text style={styles.approvedSeparator}> → </Text>
                          <Text style={[styles.approvedAmount, { color: colors.rsa.green }]}>
                            {formatZAR(claim.approved_amount)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.gray[300]} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
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
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  newButton: {
    backgroundColor: colors.rsa.blue,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: colors.background.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterTabTextActive: {
    color: colors.rsa.blue,
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
    maxWidth: 240,
    lineHeight: 20,
  },
  newClaimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.rsa.blue,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  newClaimButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.white,
  },
  claimCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  claimIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E6EBF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimInfo: {
    flex: 1,
    gap: 4,
  },
  claimTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  claimType: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  propertyName: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  claimDescription: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  claimBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  claimDate: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  claimAmounts: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  estimatedLabel: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  estimatedAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.primary,
  },
  approvedSeparator: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  approvedAmount: {
    fontSize: 13,
    fontWeight: '700',
  },
});
