import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

interface RequestInfoSectionProps {
  request: any;
}

export function RequestInfoSection({ request }: RequestInfoSectionProps) {
  const daysSinceCreated = Math.floor(
    (Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  const completionDays = request.completed_date
    ? Math.floor(
        (new Date(request.completed_date).getTime() - new Date(request.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <>
      {/* Days Since Created */}
      <View style={styles.daysCard}>
        <Ionicons name="calendar-outline" size={20} color={colors.gray[600]} />
        <Text style={styles.daysText}>
          {daysSinceCreated === 0
            ? 'Created today'
            : daysSinceCreated === 1
            ? 'Created 1 day ago'
            : `Created ${daysSinceCreated} days ago`}
        </Text>
        {completionDays !== null && (
          <Text style={styles.daysSubtext}>
            {' '}
            • Completed in {completionDays} {completionDays === 1 ? 'day' : 'days'}
          </Text>
        )}
      </View>

      {/* Property Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="home" size={20} color={colors.gray[600]} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Property</Text>
            <Text style={styles.infoValue}>{request.property?.title}</Text>
            <Text style={styles.infoSubtext}>
              {request.property?.address}, {request.property?.city}
            </Text>
          </View>
        </View>
      </View>

      {/* Tenant Info */}
      {request.tenant && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="person" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Reported By</Text>
              <Text style={styles.infoValue}>{request.tenant.full_name}</Text>
              <Text style={styles.infoSubtext}>{request.tenant.phone}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Category */}
      {request.category && (
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="pricetag" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Category</Text>
              <Text style={styles.infoValue}>{request.category.name}</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  daysCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  daysText: {
    fontSize: 14,
    color: colors.gray[700],
    marginLeft: 8,
    fontWeight: '500',
  },
  daysSubtext: {
    fontSize: 13,
    color: colors.gray[500],
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.gray[500],
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  infoSubtext: {
    fontSize: 14,
    color: colors.gray[600],
  },
});
