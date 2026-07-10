import { useAuth } from '@/src/contexts/AuthContext';
import {
  getDedicatedVendors,
  getMaintenanceRequestById,
  getVendorsByCategory,
  inviteVendorByEmail,
  pushToOpenMarket,
  pushToSelectedVendors,
  searchVendorByEmail,
} from '@/src/features/maintenance/api';
import type { MaintenanceRequestWithRelations } from '@/src/features/maintenance/api/types/maintenance.types';
import type { VendorProfile } from '@/src/features/maintenance/api/types/vendor.types';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const RSA = { blue: '#002395' };

interface VendorWithCategory extends VendorProfile {
  isDedicated?: boolean;
}

export default function VendorSelectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();

  const abortRef = useRef<AbortController | null>(null);
  const [dedicatedVendors, setDedicatedVendors] = useState<VendorProfile[]>([]);
  const [categoryVendors, setCategoryVendors] = useState<VendorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'browse' | 'invite'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<VendorProfile | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (id) {
      abortRef.current = new AbortController();
      loadData();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch the request to get property_id and category_id
      const req = await getMaintenanceRequestById(id);

      if (abortRef.current?.signal.aborted) return;

      if (!req) {
        throw new Error('Request not found');
      }

      const propertyId = req.property_id;
      const categoryId = req.category_id;

      // 2. Fetch dedicated vendors for the property
      if (propertyId) {
        try {
          const dedicated = await getDedicatedVendors(propertyId, categoryId || undefined);
          if (abortRef.current?.signal.aborted) return;
          setDedicatedVendors(dedicated);
          // Pre-select dedicated vendors
          setSelectedIds(new Set(dedicated.map((v: VendorProfile) => v.id)));
        } catch (e) {
          console.error('Failed to fetch dedicated vendors:', e);
          setDedicatedVendors([]);
        }
      }

      // 3. Fetch all vendors in the category for browsing
      if (categoryId) {
        try {
          const vendors = await getVendorsByCategory(categoryId);
          if (abortRef.current?.signal.aborted) return;
          setCategoryVendors(vendors);
        } catch (e) {
          console.error('Failed to fetch category vendors:', e);
          setCategoryVendors([]);
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      Alert.alert('Error', error.message || 'Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  const toggleVendor = useCallback((vendorId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  }, []);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSearchVendorByEmail = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      Alert.alert('Enter Email', 'Please enter a vendor email address to search.');
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. vendor@example.com).');
      return;
    }

    try {
      setInviting(true);
      const vendor = await searchVendorByEmail(email);
      if (vendor) {
        setInviteResult(vendor);
        // Auto-select the found vendor
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.add(vendor.id);
          return next;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setInviteResult(null);
        Alert.alert(
          'Vendor Not Found',
          `No vendor with email "${email}" is registered on the platform. You can send an invitation email for them to join.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Send Invitation',
              onPress: async () => {
                try {
                  await inviteVendorByEmail(email, id, profile?.full_name || 'Owner');
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert('Invitation Sent', `An invitation has been sent to ${email}.`);
                  setInviteEmail('');
                } catch (err: any) {
                  console.error('Error sending invitation:', err);
                  Alert.alert('Error', err.message || 'Failed to send invitation');
                }
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error searching vendor:', error);
      Alert.alert('Error', error.message || 'Failed to search vendor');
    } finally {
      setInviting(false);
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) {
      Alert.alert('No Vendors Selected', 'Please select at least one vendor to invite.');
      return;
    }

    Alert.alert(
      'Send Invitations',
      `Send the maintenance request to ${selectedIds.size} selected vendor${selectedIds.size > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send to Vendors',
          onPress: async () => {
            try {
              setSubmitting(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              const vendorIds = Array.from(selectedIds);
              const result = await pushToSelectedVendors(id, vendorIds);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                'Success',
                `Request sent to ${result.vendorsNotified} vendor${result.vendorsNotified !== 1 ? 's' : ''}.`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to send to vendors');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const handlePushToOpenMarket = async () => {
    Alert.alert(
      'Push to Open Market',
      'This will make the request visible to all vendors in this category. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Push to Open Market',
          onPress: async () => {
            try {
              setSubmitting(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await pushToOpenMarket(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Request pushed to open market.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to push to open market');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const renderVendorItem = useCallback(
    ({ item }: { item: VendorWithCategory }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <TouchableOpacity
          accessibilityLabel={`${item.business_name || item.full_name || 'Vendor'}${isSelected ? ', selected' : ', not selected'}`}
          accessibilityRole="radio"
          style={[styles.vendorCard, isSelected && styles.vendorCardSelected]}
          onPress={() => toggleVendor(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.vendorAvatar}>
            <Ionicons
              name={item.business_name ? 'business' : 'person'}
              size={22}
              color={isSelected ? '#FFFFFF' : RSA.blue}
            />
          </View>
          <View style={styles.vendorInfo}>
            <View style={styles.vendorNameRow}>
              <Text style={styles.vendorName}>
                {item.business_name || item.full_name || 'Unknown Vendor'}
              </Text>
              {item.isDedicated && (
                <View style={styles.dedicatedBadge}>
                  <Text style={styles.dedicatedBadgeText}>Dedicated</Text>
                </View>
              )}
            </View>
            {item.full_name && item.business_name && (
              <Text style={styles.vendorContact}>{item.full_name}</Text>
            )}
            {item.email && <Text style={styles.vendorEmail}>{item.email}</Text>}
            {item.rating != null && (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#f59e0b" />
                <Text style={styles.ratingText}>
                  {item.rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <View
            style={[
              styles.checkbox,
              isSelected && styles.checkboxSelected,
            ]}
          >
            {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
        </TouchableOpacity>
      );
    },
    [selectedIds, toggleVendor]
  );

  // Merge dedicated and category vendors, mark dedicated ones
  const allVendors: VendorWithCategory[] = React.useMemo(() => {
    const dedicatedIds = new Set(dedicatedVendors.map(v => v.id));
    const merged = [...dedicatedVendors.map(v => ({ ...v, isDedicated: true }))];

    for (const v of categoryVendors) {
      if (!dedicatedIds.has(v.id)) {
        merged.push({ ...v, isDedicated: false });
      }
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return merged.filter(
        v =>
          (v.business_name && v.business_name.toLowerCase().includes(q)) ||
          (v.full_name && v.full_name.toLowerCase().includes(q)) ||
          (v.email && v.email.toLowerCase().includes(q))
      );
    }

    return merged;
  }, [dedicatedVendors, categoryVendors, searchQuery]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading vendors...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Select Vendors</Text>
          <Text style={styles.headerSubtitle}>
            {selectedIds.size} vendor{selectedIds.size !== 1 ? 's' : ''} selected
          </Text>
        </View>
      </View>

      {/* Tab selector */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          accessibilityLabel="Browse vendors tab"
          accessibilityRole="tab"
          style={[styles.tab, activeTab === 'browse' && styles.tabActive]}
          onPress={() => setActiveTab('browse')}
        >
          <Ionicons
            name="search"
            size={16}
            color={activeTab === 'browse' ? '#FFFFFF' : colors.gray[500]}
          />
          <Text style={[styles.tabText, activeTab === 'browse' && styles.tabTextActive]}>
            Browse Vendors
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Invite by email tab"
          accessibilityRole="tab"
          style={[styles.tab, activeTab === 'invite' && styles.tabActive]}
          onPress={() => setActiveTab('invite')}
        >
          <Ionicons
            name="mail"
            size={16}
            color={activeTab === 'invite' ? '#FFFFFF' : colors.gray[500]}
          />
          <Text style={[styles.tabText, activeTab === 'invite' && styles.tabTextActive]}>
            Invite by Email
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'browse' ? (
        <>
          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={colors.gray[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name, business or email..."
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

          {/* Vendor list */}
          {allVendors.length > 0 ? (
            <FlatList
              data={allVendors}
              keyExtractor={item => item.id}
              renderItem={renderVendorItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <View style={styles.sectionInfo}>
                  <Ionicons name="information-circle" size={16} color={RSA.blue} />
                  <Text style={styles.sectionInfoText}>
                    Select vendors to invite. Dedicated vendors are pre-selected.
                  </Text>
                </View>
              }
              ListFooterComponent={<View style={{ height: 120 }} />}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No vendors found</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'Try a different search term.'
                  : 'No vendors are available for this category. Try inviting by email.'}
              </Text>
            </View>
          )}
        </>
      ) : (
        /* Invite by Email tab */
        <View style={styles.inviteContainer}>
          <View style={styles.inviteCard}>
            <Ionicons name="mail-outline" size={32} color={RSA.blue} />
            <Text style={styles.inviteTitle}>Invite Vendor by Email</Text>
            <Text style={styles.inviteSubtitle}>
              Search for an existing vendor, or send an invitation to join the platform.
            </Text>

            <View style={styles.emailInputRow}>
              <TextInput
                style={styles.emailInput}
                placeholder="vendor@example.com"
                placeholderTextColor={colors.gray[400]}
                value={inviteEmail}
                onChangeText={text => {
                  setInviteEmail(text);
                  setInviteResult(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                accessibilityLabel="Search vendor by email"
                accessibilityRole="button"
                style={[styles.emailSearchButton, inviting && { opacity: 0.6 }]}
                onPress={handleSearchVendorByEmail}
                disabled={inviting}
              >
                {inviting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="search" size={16} color="#FFFFFF" />
                    <Text style={styles.emailSearchButtonText}>Find</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {inviteResult && (
              <View style={styles.inviteResultCard}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success[500]} />
                <View style={styles.inviteResultInfo}>
                  <Text style={styles.inviteResultName}>
                    {inviteResult.business_name || inviteResult.full_name}
                  </Text>
                  <Text style={styles.inviteResultEmail}>{inviteResult.email}</Text>
                </View>
                <Ionicons name="checkmark-done" size={20} color={colors.success[500]} />
              </View>
            )}
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>

            <TouchableOpacity
              accessibilityLabel="Push request to open market"
              accessibilityRole="button"
              style={styles.quickActionCard}
              onPress={handlePushToOpenMarket}
              disabled={submitting}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="globe-outline" size={24} color={RSA.blue} />
              </View>
              <View style={styles.quickActionInfo}>
                <Text style={styles.quickActionTitle}>Push to Open Market</Text>
                <Text style={styles.quickActionSubtitle}>
                  Visible to all vendors in this category
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          accessibilityLabel="Send invitations to selected vendors"
          accessibilityRole="button"
          style={[styles.footerButton, selectedIds.size === 0 && styles.footerButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || selectedIds.size === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={styles.footerButtonText}>
                Send to {selectedIds.size} Vendor{selectedIds.size !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },

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
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.gray[100],
  },
  tabActive: { backgroundColor: RSA.blue },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.gray[500] },
  tabTextActive: { color: '#FFFFFF' },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },

  // Section info
  sectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  sectionInfoText: { fontSize: 13, color: RSA.blue, flex: 1 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 16 },

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
    borderColor: RSA.blue,
    backgroundColor: '#f0f5ff',
  },
  vendorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorInfo: { flex: 1 },
  vendorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  vendorName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  dedicatedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#eef2ff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: RSA.blue,
  },
  dedicatedBadgeText: { fontSize: 10, fontWeight: '700', color: RSA.blue },
  vendorContact: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  vendorEmail: { fontSize: 12, color: colors.gray[400], marginTop: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray[300],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: RSA.blue, borderColor: RSA.blue },

  // Empty state
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Invite by email tab
  inviteContainer: { flex: 1, padding: 16 },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  inviteSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  emailInputRow: { flexDirection: 'row', gap: 8, width: '100%' },
  emailInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#111827',
  },
  emailSearchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    backgroundColor: RSA.blue,
    borderRadius: 10,
  },
  emailSearchButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  inviteResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  inviteResultInfo: { flex: 1 },
  inviteResultName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  inviteResultEmail: { fontSize: 12, color: '#6b7280', marginTop: 1 },

  // Quick actions
  quickActions: { gap: 12 },
  quickActionsTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  quickActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionInfo: { flex: 1 },
  quickActionTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  quickActionSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Footer
  footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: RSA.blue,
    borderRadius: 12,
  },
  footerButtonDisabled: { opacity: 0.5 },
  footerButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
