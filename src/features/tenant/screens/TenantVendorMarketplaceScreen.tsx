/**
 * Tenant Vendor Marketplace Screen
 *
 * Browse, search, and select vendors for maintenance services.
 * Accessible from TenantMaintenanceReportScreen when the tenant wants
 * to choose a specific vendor instead of broadcasting to all.
 *
 * Reuses getVendorsByCategory() from vendorDiscovery.api.ts.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import * as Haptics from 'expo-haptics';
import {
  getMaintenanceRequests,
  getVendorDirectory,
  pushToSelectedVendors,
  setPendingVendorSelection,
  vendorMatchesDirectoryQuery,
} from '@/src/features/maintenance/api';
import type { VendorProfile } from '@/src/features/maintenance/api/types/vendor.types';
import { colors } from '@/src/shared/theme/colors';

const GREEN = colors.role.tenant.primary; // RSA Green
const OWNER_BLUE = colors.role.owner.primary;

function formatServiceAreas(vendor: VendorProfile): string | null {
  const labels = (vendor.service_areas ?? [])
    .map((area) => [area.city, area.province].filter(Boolean).join(', '))
    .filter(Boolean);
  if (labels.length === 0) return null;
  return labels.slice(0, 3).join(' · ');
}

// TestIDs for Maestro E2E
export const TENANT_VENDOR_MARKETPLACE_TEST_IDS = {
  searchInput: 'tenant-vendor-search',
  vendorCard: 'tenant-vendor-card',
  selectButton: 'tenant-vendor-select',
} as const;

export default function TenantVendorMarketplaceScreen() {
  const { user } = useAuth();
  const segments = useSegments();
  const isOwner = (segments as string[]).includes('(owner)');
  const accent = isOwner ? OWNER_BLUE : GREEN;
  const { categoryId, categoryName, requestId } = useLocalSearchParams<{
    categoryId?: string;
    categoryName?: string;
    requestId?: string;
  }>();

  const abortRef = useRef<AbortController | null>(null);
  const [vendors, setVendors] = useState<VendorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    abortRef.current = new AbortController();
    loadVendors();
    return () => {
      abortRef.current?.abort();
    };
  }, [categoryId]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await getVendorDirectory({
        categoryId:
          typeof categoryId === 'string' && categoryId.length > 0 ? categoryId : undefined,
      });
      if (abortRef.current?.signal.aborted) return;
      setVendors(data);
    } catch (error: any) {
      console.error('Failed to load vendors:', error);
      Alert.alert('Error', 'Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = useMemo(
    () => vendors.filter((vendor) => vendorMatchesDirectoryQuery(vendor, searchQuery)),
    [vendors, searchQuery]
  );

  const handleSelectVendor = useCallback(
    (vendor: VendorProfile) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedId(vendor.id);
      const label = vendor.business_name || vendor.full_name || 'this vendor';

      if (isOwner) {
        void (async () => {
          if (!user?.id) {
            Alert.alert('Sign in required', 'Sign in again to invite a vendor.');
            setSelectedId(null);
            return;
          }
          try {
            const requests = await getMaintenanceRequests(user.id, 'owner');
            const openJobs = requests.filter((job) =>
              ['open', 'assigned', 'in_progress'].includes(String(job.status))
            );
            if (openJobs.length === 0) {
              Alert.alert(
                'No open jobs',
                `${label} is in the directory. Create or open a maintenance job, then invite them.`,
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => setSelectedId(null) },
                  {
                    text: 'Open jobs',
                    onPress: () => router.push('/(owner)/maintenance'),
                  },
                ]
              );
              return;
            }

            const inviteTo = (jobId: string, title: string) => async () => {
              try {
                await pushToSelectedVendors(jobId, [vendor.id]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Vendor invited', `${label} was invited to quote on "${title}".`);
              } catch (error: any) {
                Alert.alert('Error', error.message || 'Could not invite this vendor.');
              } finally {
                setSelectedId(null);
              }
            };

            const buttons: {
              text: string;
              style?: 'cancel' | 'default' | 'destructive';
              onPress?: () => void;
            }[] = [
              {
                text:
                  openJobs[0].title.length > 28
                    ? `${openJobs[0].title.slice(0, 28)}…`
                    : openJobs[0].title,
                onPress: inviteTo(openJobs[0].id, openJobs[0].title),
              },
            ];
            if (openJobs.length > 1) {
              buttons.push({
                text: 'Choose another job',
                onPress: () => router.push('/(owner)/maintenance'),
              });
            }
            buttons.push({
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setSelectedId(null),
            });
            Alert.alert(`Invite ${label}`, 'Send a quote request on an open job:', buttons);
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not load jobs.');
            setSelectedId(null);
          }
        })();
        return;
      }

      Alert.alert('Request This Vendor', `Send your maintenance request to ${label}?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedId(null) },
        {
          text: 'Continue',
          onPress: () => {
            if (!user?.id) {
              Alert.alert('Sign in required', 'Sign in again to pick a vendor.');
              return;
            }
            setPendingVendorSelection(user.id, vendor);
            router.replace('/(tenant)/maintenance/report');
          },
        },
      ]);
    },
    [isOwner, user?.id]
  );

  const renderVendorCard = useCallback(
    ({ item }: { item: VendorProfile }) => {
      const isSelected = selectedId === item.id;
      return (
        <TouchableOpacity
          testID={TENANT_VENDOR_MARKETPLACE_TEST_IDS.vendorCard}
          accessibilityLabel={`${item.business_name || item.full_name || 'Vendor'}${isSelected ? ', selected' : ''}`}
          accessibilityRole="button"
          style={[styles.vendorCard, isSelected && styles.vendorCardSelected]}
          onPress={() => handleSelectVendor(item)}
          activeOpacity={0.7}
        >
          {/* Avatar */}
          <View style={styles.vendorAvatar}>
            <Ionicons
              name={item.business_name ? 'business' : 'person'}
              size={24}
              color={isSelected ? '#FFFFFF' : accent}
            />
          </View>

          {/* Info */}
          <View style={styles.vendorInfo}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {item.business_name || item.full_name || 'Unknown Vendor'}
            </Text>
            {item.business_name && item.full_name && (
              <Text style={styles.vendorContact} numberOfLines={1}>
                {item.full_name}
              </Text>
            )}
            {item.email && (
              <Text style={styles.vendorEmail} numberOfLines={1}>
                {item.email}
              </Text>
            )}
            {item.phone && (
              <View style={styles.phoneRow}>
                <Ionicons name="call-outline" size={12} color={colors.gray[400]} />
                <Text style={styles.vendorPhone}>{item.phone}</Text>
              </View>
            )}
            {formatServiceAreas(item) && (
              <View style={styles.phoneRow}>
                <Ionicons name="location-outline" size={12} color={colors.gray[400]} />
                <Text style={styles.vendorPhone}>{formatServiceAreas(item)}</Text>
              </View>
            )}
            {item.trades && item.trades.length > 0 && (
              <Text style={styles.vendorEmail} numberOfLines={1}>
                {item.trades.slice(0, 3).join(' · ')}
              </Text>
            )}
            {/* Rating */}
            {item.rating != null && item.rating > 0 && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                <Text style={styles.ratingLabel}>rating</Text>
              </View>
            )}
          </View>

          {/* Arrow */}
          <Ionicons name="chevron-forward" size={20} color={colors.gray[300]} />
        </TouchableOpacity>
      );
    },
    [selectedId, handleSelectVendor]
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={56} color={colors.gray[300]} />
      <Text style={styles.emptyTitle}>No vendors found</Text>
      <Text style={styles.emptyText}>
        {searchQuery
          ? 'Try a different search term.'
          : categoryName
            ? `No vendors are available for ${categoryName} yet.`
            : 'No vendors are registered on the platform yet.'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Find a Vendor</Text>
          {categoryName && <Text style={styles.headerSubtitle}>{categoryName}</Text>}
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.gray[400]} />
        <TextInput
          testID={TENANT_VENDOR_MARKETPLACE_TEST_IDS.searchInput}
          style={styles.searchInput}
          placeholder="Search by name, trade or city..."
          placeholderTextColor={colors.gray[400]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.gray[400]} />
          </TouchableOpacity>
        )}
      </View>

      {/* Info banner */}
      {!loading && vendors.length > 0 && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={16} color={accent} />
          <Text style={styles.infoBannerText}>
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} available. Tap
            a vendor to request them for your maintenance issue.
          </Text>
        </View>
      )}

      {/* Loading */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={styles.loadingText}>Loading vendors...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredVendors}
          keyExtractor={(item) => item.id}
          renderItem={renderVendorCard}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={
            filteredVendors.length === 0 ? styles.emptyList : styles.listContent
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  infoBannerText: { fontSize: 13, color: GREEN, flex: 1 },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },

  // List
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  emptyList: { flex: 1 },

  // Vendor card
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    gap: 12,
  },
  vendorCardSelected: {
    borderColor: GREEN,
    backgroundColor: '#f0fdf4',
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6f7f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorInfo: { flex: 1, gap: 2 },
  vendorName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  vendorContact: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  vendorEmail: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  vendorPhone: { fontSize: 12, color: '#9ca3af' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  ratingLabel: { fontSize: 12, color: '#9ca3af' },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
