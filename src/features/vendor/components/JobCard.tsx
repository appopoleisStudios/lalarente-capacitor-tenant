import type { VendorMaintenanceRequest } from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface JobCardProps {
  job: VendorMaintenanceRequest;
  onPress: () => void;
}

export function JobCard({ job, onPress }: JobCardProps) {
  // Get status badge config
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'assigned':
        return {
          label: 'Assigned',
          color: colors.rsa.green,
          bgColor: `${colors.rsa.green}15`,
          icon: 'checkmark-circle' as const,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          color: colors.rsa.blue,
          bgColor: `${colors.rsa.blue}15`,
          icon: 'time' as const,
        };
      case 'completed':
        return {
          label: 'Completed',
          color: colors.rsa.green,
          bgColor: `${colors.rsa.green}15`,
          icon: 'checkmark-done-circle' as const,
        };
      default:
        return {
          label: status,
          color: colors.gray[500],
          bgColor: colors.gray[100],
          icon: 'ellipse' as const,
        };
    }
  };

  const statusConfig = getStatusConfig(job.status);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  // Format currency
  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return 'R 0';
    return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
        <Ionicons name={statusConfig.icon} size={16} color={statusConfig.color} />
        <Text style={[styles.statusText, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {job.title}
      </Text>

      {/* Property Address */}
      {job.property && (
        <View style={styles.row}>
          <Ionicons name="location" size={16} color={colors.gray[500]} />
          <Text style={styles.address} numberOfLines={1}>
            {job.property.address}, {job.property.city}
          </Text>
        </View>
      )}

      {/* PO Number and Amount */}
      <View style={styles.infoRow}>
        {job.po_id && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>PO:</Text>
            <Text style={styles.infoValue}>{job.po_id.slice(0, 8)}...</Text>
          </View>
        )}
        {job.my_quote?.total_amount && (
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Amount:</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(job.my_quote.total_amount)}
            </Text>
          </View>
        )}
      </View>

      {/* Timeline Info */}
      <View style={styles.footer}>
        <View style={styles.row}>
          <Ionicons name="calendar-outline" size={14} color={colors.gray[500]} />
          <Text style={styles.footerText}>
            {job.status === 'assigned' && 'Scheduled: '}
            {job.status === 'in_progress' && 'Started: '}
            {job.status === 'completed' && 'Completed: '}
            {formatDate(job.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: colors.gray[600],
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.gray[500],
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: colors.text.primary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: colors.gray[500],
  },
});
