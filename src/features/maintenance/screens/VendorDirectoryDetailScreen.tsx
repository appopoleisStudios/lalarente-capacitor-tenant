import { useAuth } from '@/src/contexts/AuthContext';
import {
  VendorAlreadyInvitedError,
  getInvitedVendorIds,
  getMaintenanceRequests,
  getVendorById,
  getVendorQuoteInvitation,
  pushToSelectedVendors,
  setPendingVendorSelection,
} from '@/src/features/maintenance/api';
import type { VendorQuoteRequest } from '@/src/features/maintenance/api/types/vendor.types';
import { bootstrapVendorMaintenanceThread } from '@/src/features/messaging/api/vendorThreadApi';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OWNER_BLUE = colors.role.owner.primary;
const TENANT_GREEN = colors.role.tenant.primary;

export const VENDOR_DETAIL_TEST_IDS = {
  title: 'vendor-detail-title',
  invite: 'vendor-detail-invite',
  alreadyInvited: 'vendor-already-invited',
  message: 'vendor-detail-message',
  invitedBy: 'vendor-detail-invited-by',
} as const;

function invitedByLabel(invitation: VendorQuoteRequest | null): string | null {
  if (!invitation) return null;
  if (invitation.inviter_name && invitation.invited_by_role) {
    return `Invited by ${invitation.inviter_name} (${invitation.invited_by_role})`;
  }
  if (invitation.invited_by_role) {
    return `Invited by the ${invitation.invited_by_role}`;
  }
  return 'Already invited to quote on this job';
}

export default function VendorDirectoryDetailScreen() {
  const { user } = useAuth();
  const segments = useSegments();
  const isOwner = (segments as string[]).includes('(owner)');
  const role = isOwner ? 'owner' : 'tenant';
  const accent = isOwner ? OWNER_BLUE : TENANT_GREEN;
  const { id, requestId } = useLocalSearchParams<{ id: string; requestId?: string }>();

  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [vendorMissing, setVendorMissing] = useState(false);
  const [vendor, setVendor] = useState<Awaited<ReturnType<typeof getVendorById>>>(null);
  const [invitation, setInvitation] = useState<VendorQuoteRequest | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const profile = await getVendorById(id);
      if (!profile) {
        setVendorMissing(true);
        setVendor(null);
        return;
      }
      setVendorMissing(false);
      setVendor(profile);
      if (requestId) {
        const existing = await getVendorQuoteInvitation(requestId, id);
        setInvitation(existing);
      } else {
        setInvitation(null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not load this vendor.');
    } finally {
      setLoading(false);
    }
  }, [id, requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inviteToJob = async (jobId: string, title: string) => {
    if (!vendor) return;
    try {
      setInviting(true);
      const already = await getInvitedVendorIds(jobId);
      if (already.has(vendor.id)) {
        throw new VendorAlreadyInvitedError();
      }
      await pushToSelectedVendors(jobId, [vendor.id]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const saved = await getVendorQuoteInvitation(jobId, vendor.id);
      setInvitation(saved);
      Alert.alert(
        'Vendor invited',
        `${vendor.business_name || vendor.full_name} was invited to quote on "${title}".`
      );
    } catch (error: any) {
      Alert.alert(
        error instanceof VendorAlreadyInvitedError ? 'Already invited' : 'Error',
        error.message || 'Could not invite this vendor.'
      );
      if (error instanceof VendorAlreadyInvitedError) {
        const saved = await getVendorQuoteInvitation(jobId, vendor.id);
        setInvitation(saved);
      }
    } finally {
      setInviting(false);
    }
  };

  const handleInvite = async () => {
    if (!vendor || !user?.id) {
      Alert.alert('Sign in required', 'Sign in again to invite a vendor.');
      return;
    }
    const label = vendor.business_name || vendor.full_name || 'this vendor';

    if (requestId) {
      await inviteToJob(requestId, 'this job');
      return;
    }

    try {
      const requests = await getMaintenanceRequests(user.id, role);
      const openJobs = requests.filter((job) =>
        ['open', 'assigned', 'in_progress'].includes(String(job.status))
      );
      if (openJobs.length === 0) {
        if (!isOwner) {
          Alert.alert(
            'No open jobs',
            `${label} can be attached to a new maintenance report, or create a job first.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Use on new report',
                onPress: () => {
                  setPendingVendorSelection(user.id, vendor);
                  router.replace('/(tenant)/maintenance/report');
                },
              },
            ]
          );
          return;
        }
        Alert.alert(
          'No open jobs',
          `${label} is in the directory. Open a maintenance job, then invite them to quote.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open jobs', onPress: () => router.push('/(owner)/maintenance') },
          ]
        );
        return;
      }

      const buttons: {
        text: string;
        style?: 'cancel' | 'default' | 'destructive';
        onPress?: () => void;
      }[] = openJobs.slice(0, 3).map((job) => ({
        text: job.title.length > 32 ? `${job.title.slice(0, 32)}…` : job.title,
        onPress: () => {
          void inviteToJob(job.id, job.title);
        },
      }));
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(`Invite ${label}`, 'Send a quote request on an open job:', buttons);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not load jobs.');
    }
  };

  const handleMessage = async () => {
    if (!requestId) {
      Alert.alert(
        'In-app messages',
        'Invite this vendor to a job first. Phone numbers are not shared — talk stays in LalaRente chat after they are assigned.'
      );
      return;
    }
    try {
      const threadId = await bootstrapVendorMaintenanceThread(
        requestId,
        'Hello, I would like to discuss this job in-app.'
      );
      const path = isOwner ? `/(owner)/messages/${threadId}` : `/(tenant)/messages/${threadId}`;
      router.push(path as any);
    } catch (error: any) {
      Alert.alert(
        'Chat after assignment',
        error?.message ||
          'You can message this vendor in-app after they are assigned to the job. Phone numbers are not shown.'
      );
    }
  };

  const completedJobs = vendor?.completed_jobs ?? 0;
  const areas = (vendor?.service_areas ?? [])
    .map((area) => [area.city, area.province].filter(Boolean).join(', '))
    .filter(Boolean);
  const alreadyInvited = Boolean(invitation);
  const whoInvited = invitedByLabel(invitation);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} testID={VENDOR_DETAIL_TEST_IDS.title}>
          Vendor
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : vendorMissing || !vendor ? (
        <View style={styles.centered}>
          <Ionicons name="person-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>Vendor not found</Text>
          <Text style={styles.emptyText}>
            This profile is not in the directory, or it is no longer a vendor account.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={[styles.avatar, { backgroundColor: isOwner ? '#dbeafe' : '#e6f7f0' }]}>
              <Ionicons
                name={vendor.business_name ? 'business' : 'person'}
                size={32}
                color={accent}
              />
            </View>
            <Text style={styles.name}>{vendor.business_name || vendor.full_name || 'Vendor'}</Text>
            {vendor.business_name && vendor.full_name ? (
              <Text style={styles.subName}>{vendor.full_name}</Text>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Ionicons
                name={vendor.rating != null && vendor.rating > 0 ? 'star' : 'star-outline'}
                size={18}
                color={colors.rsa.gold}
              />
              <Text style={styles.statValue}>
                {vendor.rating != null && vendor.rating > 0
                  ? vendor.rating.toFixed(1)
                  : 'No rating'}
              </Text>
              <Text style={styles.statLabel}>Stars</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle-outline" size={18} color={accent} />
              <Text style={styles.statValue}>{completedJobs}</Text>
              <Text style={styles.statLabel}>Completed job{completedJobs === 1 ? '' : 's'}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Trade</Text>
            <Text style={styles.sectionBody}>
              {vendor.trades && vendor.trades.length > 0
                ? vendor.trades.join(' · ')
                : 'No trades listed yet.'}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Service areas</Text>
            <Text style={styles.sectionBody}>
              {areas.length > 0 ? areas.join(' · ') : 'No service areas on file yet.'}
            </Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.sectionBody}>
              {vendor.bio?.trim() ? vendor.bio : 'No bio on file yet.'}
            </Text>
          </View>

          {alreadyInvited ? (
            <View testID={VENDOR_DETAIL_TEST_IDS.alreadyInvited} style={styles.invitedBanner}>
              <Text style={styles.invitedBannerTitle}>Already invited</Text>
              {whoInvited ? (
                <Text testID={VENDOR_DETAIL_TEST_IDS.invitedBy} style={styles.invitedBannerBody}>
                  {whoInvited}
                </Text>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity
            testID={VENDOR_DETAIL_TEST_IDS.invite}
            accessibilityRole="button"
            accessibilityState={{ disabled: alreadyInvited || inviting }}
            style={[
              styles.primaryButton,
              { backgroundColor: accent },
              (alreadyInvited || inviting) && styles.disabledButton,
            ]}
            onPress={() => {
              if (alreadyInvited) return;
              void handleInvite();
            }}
            disabled={alreadyInvited || inviting}
          >
            {inviting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {alreadyInvited ? 'Already invited' : 'Invite to quote'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID={VENDOR_DETAIL_TEST_IDS.message}
            accessibilityRole="button"
            style={styles.secondaryButton}
            onPress={() => void handleMessage()}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={accent} />
            <Text style={[styles.secondaryButtonText, { color: accent }]}>Message in-app</Text>
          </TouchableOpacity>

          {!isOwner && !requestId ? (
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.secondaryButton}
              onPress={() => {
                if (!user?.id || !vendor) return;
                setPendingVendorSelection(user.id, vendor);
                router.replace('/(tenant)/maintenance/report');
              }}
            >
              <Text style={[styles.secondaryButtonText, { color: accent }]}>Use on new report</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 12 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  content: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center' },
  subName: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  sectionBody: { fontSize: 14, color: '#4b5563', lineHeight: 20 },
  invitedBanner: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  invitedBannerTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  invitedBannerBody: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: { opacity: 0.55 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },
});
