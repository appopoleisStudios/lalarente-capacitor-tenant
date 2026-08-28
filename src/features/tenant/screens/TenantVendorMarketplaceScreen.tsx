/**
 * Tenant Vendor Marketplace Screen
 *
 * Browse, search, and select vendors for maintenance services.
 * Accessible from TenantMaintenanceReportScreen when the tenant wants
 * to choose a specific vendor instead of broadcasting to all.
 *
 * Reuses getVendorsByCategory() from vendorDiscovery.api.ts.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useSegments } from 'expo-router';
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
import {
  getInvitedVendorIds,
  getVendorDirectory,
  vendorMatchesDirectoryQuery,
} from '@/src/features/maintenance/api';
import { VendorDirectoryCard } from '@/src/features/maintenance/components/VendorDirectoryCard';
import type { VendorProfile } from '@/src/features/maintenance/api/types/vendor.types';
import { colors } from '@/src/shared/theme/colors';

const GREEN = colors.role.tenant.primary; // RSA Green
const OWNER_BLUE = colors.role.owner.primary;

// TestIDs for Maestro E2E
export const TENANT_VENDOR_MARKETPLACE_TEST_IDS = {
  searchInput: 'tenant-vendor-search',
  vendorCard: 'tenant-vendor-card',
  selectButton: 'tenant-vendor-select',
} as const;

export default function TenantVendorMarketplaceScreen() {
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
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    abortRef.current = new AbortController();
    loadVendors();
    return () => {
      abortRef.current?.abort();
    };
  }, [categoryId, requestId]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await getVendorDirectory({
        categoryId:
          typeof categoryId === 'string' && categoryId.length > 0 ? categoryId : undefined,
      });
      if (abortRef.current?.signal.aborted) return;
      setVendors(data);
      if (typeof requestId === 'string' && requestId.length > 0) {
        try {
          const invited = await getInvitedVendorIds(requestId);
          if (abortRef.current?.signal.aborted) return;
          setInvitedIds(invited);
        } catch (inviteError) {
          console.error('Failed to load invited vendors:', inviteError);
          setInvitedIds(new Set());
        }
      } else {
        setInvitedIds(new Set());
      }
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

  const openVendorDetail = useCallback(
    (vendor: VendorProfile) => {
      const pathname = isOwner
        ? '/(owner)/maintenance/vendor/[id]'
        : '/(tenant)/maintenance/vendor/[id]';
      router.push({
        pathname: pathname as any,
        params: {
          id: vendor.id,
          ...(typeof requestId === 'string' && requestId.length > 0 ? { requestId } : {}),
        },
      });
    },
    [isOwner, requestId]
  );

  const renderVendorCard = useCallback(
    ({ item }: { item: VendorProfile }) => (
      <VendorDirectoryCard
        vendor={item}
        accent={accent}
        invited={invitedIds.has(item.id)}
        onPress={() => openVendorDetail(item)}
      />
    ),
    [accent, invitedIds, openVendorDetail]
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
          <Text style={styles.headerTitle} testID="vendor-directory-title">
            Find a Vendor
          </Text>
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
            {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''} available. Open
            a vendor to see ratings and invite them to quote.
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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  vendorLocation: { fontSize: 12, color: '#9ca3af' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  ratingLabel: { fontSize: 12, color: '#9ca3af' },
  statDivider: { width: 1, height: 12, backgroundColor: colors.gray[200], marginHorizontal: 2 },

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
