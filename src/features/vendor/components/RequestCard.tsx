import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import type { VendorMaintenanceRequest } from '@/src/features/maintenance/api/maintenanceApi';

interface RequestCardProps {
  request: VendorMaintenanceRequest;
  onPress: () => void;
}

export const RequestCard: React.FC<RequestCardProps> = ({ request, onPress }) => {
  // Priority badge color
  const getPriorityColor = () => {
    switch (request.priority) {
      case 'high':
        return colors.error[500];
      case 'medium':
        return colors.warning[500];
      case 'low':
        return colors.info[500];
      default:
        return colors.gray[400];
    }
  };

  // Priority icon
  const getPriorityIcon = () => {
    switch (request.priority) {
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  };

  // Status badge
  const getStatusBadge = () => {
    switch (request.status) {
      case 'open':
        return { text: 'Open', color: colors.success[500] };
      case 'assigned':
        return { text: 'Assigned', color: colors.info[500] };
      case 'in_progress':
        return { text: 'In Progress', color: colors.warning[500] };
      case 'completed':
        return { text: 'Completed', color: colors.gray[500] };
      case 'closed':
        return { text: 'Closed', color: colors.gray[400] };
      default:
        return { text: request.status, color: colors.gray[400] };
    }
  };

  // Quote status indicator
  const getQuoteStatus = () => {
    if (request.my_quote) {
      return {
        icon: '✓',
        text: 'Quote submitted',
        color: colors.success[500],
      };
    }
    if (!request.can_quote) {
      return {
        icon: '⚠️',
        text: 'Category mismatch',
        color: colors.warning[500],
      };
    }
    return {
      icon: '💬',
      text: 'No quote yet',
      color: colors.gray[400],
    };
  };

  const statusBadge = getStatusBadge();
  const quoteStatus = getQuoteStatus();

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Header with priority and status */}
      <View style={styles.header}>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: `${getPriorityColor()}15` }]}>
            <Text style={styles.badgeEmoji}>{getPriorityIcon()}</Text>
            <Text style={[styles.badgeText, { color: getPriorityColor() }]}>
              {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: `${statusBadge.color}15` }]}>
            <Text style={[styles.badgeText, { color: statusBadge.color }]}>
              {statusBadge.text}
            </Text>
          </View>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {request.title}
      </Text>

      {/* Property address */}
      {request.property && (
        <View style={styles.propertyRow}>
          <Ionicons name="location-outline" size={16} color={colors.gray[500]} />
          <Text style={styles.propertyText} numberOfLines={1}>
            {request.property.address}, {request.property.city}
          </Text>
        </View>
      )}

      {/* Category and date */}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          {request.category && (
            <>
              <Ionicons name="construct-outline" size={14} color={colors.gray[500]} />
              <Text style={styles.metaText}>{request.category.name}</Text>
            </>
          )}
        </View>
        <Text style={styles.metaText}>• {formatDate(request.created_at)}</Text>
      </View>

      {/* Quote status indicator */}
      <View style={[styles.quoteStatus, { backgroundColor: `${quoteStatus.color}10` }]}>
        <Text style={styles.quoteStatusEmoji}>{quoteStatus.icon}</Text>
        <Text style={[styles.quoteStatusText, { color: quoteStatus.color }]}>
          {quoteStatus.text}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

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
  header: {
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  badgeEmoji: {
    fontSize: 12,
  },
  badgeText: {
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
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  propertyText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  quoteStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  quoteStatusEmoji: {
    fontSize: 14,
  },
  quoteStatusText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
