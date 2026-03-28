/**
 * Owner Renewals Dashboard
 *
 * Shows all expiring leases with CPA s14 notice status.
 * Allows owners to send notices and manage renewal negotiations.
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
import { leaseExpiryApi, type ExpiringLease, type LeaseExpiryInfo } from '@/src/features/leases/api/leaseExpiry.api';

interface LeaseWithExpiry extends ExpiringLease {
  expiryInfo?: LeaseExpiryInfo;
}

export default function OwnerRenewalsDashboardScreen() {
  const router = useRouter();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [leases, setLeases] = useState<LeaseWithExpiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ownerId) fetchData(ownerId);
    }, [ownerId])
  );

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      fetchData(user.id);
    }
  };

  const fetchData = async (uid: string) => {
    try {
      setLoading(true);
      const expiring = await leaseExpiryApi.getExpiringLeases(uid, 180);

      // Enrich with expiry info
      const enriched: LeaseWithExpiry[] = await Promise.all(
        expiring.map(async (lease) => {
          try {
            const expiryInfo = await leaseExpiryApi.getLeaseExpiryInfo(lease.id);
            return { ...lease, expiryInfo };
          } catch {
            return lease;
          }
        })
      );

      setLeases(enriched);
    } catch (err) {
      console.error('Error fetching renewals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendNotice = async (lease: LeaseWithExpiry, noticeType: '80' | '60' | '40') => {
    Alert.alert(
      `Send ${noticeType}-Day Notice`,
      `This will record that the ${noticeType}-business-day CPA notice was sent for ${(lease.property as any)?.title || 'this property'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              await leaseExpiryApi.recordNoticeSent(lease.id, noticeType);
              if (ownerId) fetchData(ownerId);
              Alert.alert('Notice Recorded', `${noticeType}-day notice has been recorded.`);
            } catch (err) {
              Alert.alert('Error', 'Failed to record notice');
            }
          },
        },
      ]
    );
  };

  const getUrgencyColor = (daysLeft: number) => {
    if (daysLeft <= 30) return colors.error[500];
    if (daysLeft <= 60) return colors.warning[500];
    if (daysLeft <= 90) return colors.secondary[500];
    return colors.primary[500];
  };

  const getResponseLabel = (response: string | null) => {
    switch (response) {
      case 'renew': return { label: 'Wants to Renew', color: colors.success[500] };
      case 'terminate': return { label: 'Will Terminate', color: colors.error[500] };
      case 'negotiate': return { label: 'Wants to Negotiate', color: colors.warning[500] };
      default: return { label: 'No Response', color: colors.gray[400] };
    }
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
        <Text style={styles.headerTitle}>Lease Renewals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* CPA Compliance Banner */}
        <View style={styles.cpaBanner}>
          <Ionicons name="alert-circle" size={20} color={colors.info[500]} />
          <Text style={styles.cpaText}>
            CPA s14(2)(c) requires 80/60/40 business day notices before lease expiry.
            Missing notices may result in automatic month-to-month conversion.
          </Text>
        </View>

        {/* Lease List */}
        {leases.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No Expiring Leases</Text>
            <Text style={styles.emptyText}>No leases expiring in the next 6 months</Text>
          </View>
        ) : (
          leases.map((lease) => {
            const info = lease.expiryInfo;
            const daysLeft = info?.daysUntilExpiry || 0;
            const urgencyColor = getUrgencyColor(daysLeft);
            const response = getResponseLabel(lease.tenant_renewal_response);

            return (
              <View key={lease.id} style={styles.leaseCard}>
                {/* Property & Tenant */}
                <View style={styles.leaseHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.propertyTitle}>{(lease.property as any)?.title || 'Property'}</Text>
                    <Text style={styles.tenantName}>{(lease.tenant as any)?.full_name || 'Tenant'}</Text>
                  </View>
                  <View style={[styles.daysChip, { backgroundColor: urgencyColor + '15' }]}>
                    <Text style={[styles.daysChipText, { color: urgencyColor }]}>
                      {daysLeft}d left
                    </Text>
                  </View>
                </View>

                {/* Expiry Date & Rent */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Expires: {lease.end_date}</Text>
                  <Text style={styles.infoLabel}>R{lease.monthly_rent?.toLocaleString('en-ZA')}/mo</Text>
                </View>

                {/* Tenant Response */}
                <View style={styles.responseRow}>
                  <View style={[styles.responseBadge, { backgroundColor: response.color + '15' }]}>
                    <View style={[styles.responseDot, { backgroundColor: response.color }]} />
                    <Text style={[styles.responseText, { color: response.color }]}>{response.label}</Text>
                  </View>
                </View>

                {/* Notice Status */}
                {info && (
                  <View style={styles.noticeSection}>
                    <Text style={styles.noticeSectionTitle}>CPA Notices</Text>
                    <View style={styles.noticeRow}>
                      {(['80', '60', '40'] as const).map((days) => {
                        const sent = days === '80' ? info.notice80Sent : days === '60' ? info.notice60Sent : info.notice40Sent;
                        const due = days === '80' ? info.notice80Due : days === '60' ? info.notice60Due : info.notice40Due;
                        const isOverdue = !sent && new Date() >= new Date(due);

                        return (
                          <TouchableOpacity
                            key={days}
                            style={[
                              styles.noticeChip,
                              sent && styles.noticeChipSent,
                              isOverdue && styles.noticeChipOverdue,
                            ]}
                            onPress={() => !sent && handleSendNotice(lease, days)}
                            disabled={sent}
                          >
                            <Ionicons
                              name={sent ? 'checkmark-circle' : isOverdue ? 'warning' : 'time-outline'}
                              size={14}
                              color={sent ? colors.success[500] : isOverdue ? colors.error[500] : colors.gray[500]}
                            />
                            <Text style={[
                              styles.noticeChipText,
                              sent && { color: colors.success[500] },
                              isOverdue && { color: colors.error[500] },
                            ]}>
                              {days}d
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push(`/(owner)/leases/${lease.id}` as never)}
                  >
                    <Text style={styles.actionButtonText}>View Lease</Text>
                  </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: colors.background.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  content: { flex: 1, padding: 16 },
  cpaBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.info[50], padding: 14, borderRadius: 12, gap: 10, marginBottom: 20,
  },
  cpaText: { flex: 1, fontSize: 12, color: colors.info[700], lineHeight: 17 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginTop: 16 },
  emptyText: { fontSize: 14, color: colors.text.tertiary, marginTop: 4 },
  leaseCard: {
    backgroundColor: colors.background.default, borderRadius: 12, padding: 16, marginBottom: 12,
  },
  leaseHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  propertyTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  tenantName: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },
  daysChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  daysChipText: { fontSize: 13, fontWeight: '700' },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: 10, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border.default,
  },
  infoLabel: { fontSize: 13, color: colors.text.secondary },
  responseRow: { marginBottom: 12 },
  responseBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 6,
  },
  responseDot: { width: 8, height: 8, borderRadius: 4 },
  responseText: { fontSize: 12, fontWeight: '600' },
  noticeSection: { marginBottom: 12 },
  noticeSectionTitle: { fontSize: 11, fontWeight: '700', color: colors.text.tertiary, marginBottom: 6, textTransform: 'uppercase' },
  noticeRow: { flexDirection: 'row', gap: 8 },
  noticeChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border.default, gap: 4,
  },
  noticeChipSent: { borderColor: colors.success[500], backgroundColor: colors.success[50] },
  noticeChipOverdue: { borderColor: colors.error[500], backgroundColor: colors.error[50] },
  noticeChipText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  actions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: colors.primary[500], alignItems: 'center',
  },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: colors.text.inverse },
});
