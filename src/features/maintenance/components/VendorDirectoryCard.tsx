import type { VendorProfile } from '@/src/features/maintenance/api/types/vendor.types';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export const VENDOR_DIRECTORY_CARD_TEST_IDS = {
  card: 'tenant-vendor-card',
  invitedBadge: 'vendor-invited-badge',
} as const;

type Props = {
  vendor: VendorProfile;
  accent: string;
  invited?: boolean;
  selected?: boolean;
  dedicated?: boolean;
  onPress: () => void;
  testID?: string;
};

function formatServiceAreas(vendor: VendorProfile): string | null {
  const labels = (vendor.service_areas ?? [])
    .map((area) => [area.city, area.province].filter(Boolean).join(', '))
    .filter(Boolean);
  if (labels.length === 0) return null;
  return labels.slice(0, 3).join(' · ');
}

export function VendorDirectoryCard({
  vendor,
  accent,
  invited = false,
  selected = false,
  dedicated = false,
  onPress,
  testID = VENDOR_DIRECTORY_CARD_TEST_IDS.card,
}: Props) {
  const completedJobs = vendor.completed_jobs ?? 0;
  const ratingLabel =
    vendor.rating != null && vendor.rating > 0 ? `${vendor.rating.toFixed(1)} stars` : 'No rating';
  const name = vendor.business_name || vendor.full_name || 'Unknown Vendor';
  const areas = formatServiceAreas(vendor);

  return (
    <TouchableOpacity
      testID={testID}
      accessibilityLabel={`${name}, ${ratingLabel}, ${completedJobs} completed job${completedJobs === 1 ? '' : 's'}${invited ? ', already invited' : ''}${selected ? ', selected' : ''}`}
      accessibilityRole="button"
      style={[
        styles.vendorCard,
        selected && !invited && styles.vendorCardSelected,
        invited && styles.vendorCardInvited,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.vendorAvatar, invited && styles.vendorAvatarInvited]}>
        <Ionicons
          name={vendor.business_name ? 'business' : 'person'}
          size={24}
          color={invited ? colors.gray[500] : selected ? '#FFFFFF' : accent}
        />
      </View>
      <View style={styles.vendorInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.vendorName, invited && styles.invitedText]} numberOfLines={1}>
            {name}
          </Text>
          {dedicated ? (
            <View style={styles.dedicatedBadge}>
              <Text style={styles.dedicatedBadgeText}>Dedicated</Text>
            </View>
          ) : null}
        </View>
        {vendor.business_name && vendor.full_name ? (
          <Text style={styles.vendorContact} numberOfLines={1}>
            {vendor.full_name}
          </Text>
        ) : null}
        {areas ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={colors.gray[400]} />
            <Text style={styles.metaText}>{areas}</Text>
          </View>
        ) : null}
        {vendor.trades && vendor.trades.length > 0 ? (
          <Text style={styles.metaText} numberOfLines={1}>
            {vendor.trades.slice(0, 3).join(' · ')}
          </Text>
        ) : null}
        <View style={styles.ratingRow}>
          <Ionicons
            name={vendor.rating != null && vendor.rating > 0 ? 'star' : 'star-outline'}
            size={14}
            color={colors.rsa.gold}
          />
          <Text style={styles.ratingText}>
            {vendor.rating != null && vendor.rating > 0 ? vendor.rating.toFixed(1) : 'No rating'}
          </Text>
          <View style={styles.statDivider} />
          <Ionicons name="checkmark-circle-outline" size={14} color={accent} />
          <Text style={styles.metaText}>
            {completedJobs} completed job{completedJobs === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
      {invited ? (
        <View testID={VENDOR_DIRECTORY_CARD_TEST_IDS.invitedBadge} style={styles.invitedBadge}>
          <Text style={styles.invitedBadgeText}>Invited</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.gray[300]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  vendorCardInvited: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  vendorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e6f7f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorAvatarInvited: {
    backgroundColor: '#e5e7eb',
  },
  vendorInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  vendorName: { flex: 1, fontSize: 15, fontWeight: '700', color: '#111827' },
  invitedText: { color: '#6b7280' },
  vendorContact: { fontSize: 13, color: '#6b7280', marginTop: 1 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  metaText: { fontSize: 12, color: '#9ca3af' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  ratingText: { fontSize: 13, fontWeight: '700', color: '#111827' },
  statDivider: { width: 1, height: 12, backgroundColor: colors.gray[200], marginHorizontal: 2 },
  dedicatedBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dedicatedBadgeText: { fontSize: 10, fontWeight: '700', color: '#1d4ed8' },
  invitedBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  invitedBadgeText: { fontSize: 11, fontWeight: '700', color: '#4b5563' },
});
