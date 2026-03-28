import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedButton } from './AnimatedButton';

interface ViewingRequest {
  id: string;
  property_title: string;
  tenant_name: string;
  requested_date: string;
  requested_time: string;
  status: string;
  alternative_times?: string[] | null;
}

interface ViewingRequestsSectionProps {
  viewings: ViewingRequest[];
  pendingCount: number;
}

export const ViewingRequestsSection = ({ viewings, pendingCount }: ViewingRequestsSectionProps) => {
  const router = useRouter();

  if (viewings.length === 0) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'approved':
        return { bg: '#D1FAE5', text: '#065F46' };
      case 'declined':
        return { bg: '#FEE2E2', text: '#991B1B' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
  };

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Viewing Requests</Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <AnimatedButton onPress={() => router.push('/(owner)/viewings' as any)}>
          <Text style={styles.seeAll}>See All</Text>
        </AnimatedButton>
      </View>
      {viewings.slice(0, 3).map((viewing) => {
        const statusColor = getStatusColor(viewing.status);
        return (
          <AnimatedButton
            key={viewing.id}
            style={styles.card}
            onPress={() => router.push(`/(owner)/viewings/${viewing.id}` as any)}
          >
            <View style={styles.cardInner}>
              <View style={styles.iconContainer}>
                <Ionicons name="calendar-outline" size={20} color="#002395" />
              </View>
              <View style={styles.info}>
                <Text style={styles.property} numberOfLines={1}>
                  {viewing.property_title}
                </Text>
                <Text style={styles.tenant} numberOfLines={1}>
                  {viewing.tenant_name}
                </Text>
                {viewing.status === 'declined' && viewing.alternative_times && viewing.alternative_times.length > 0 && (
                  <Text style={styles.altOffered}>Alt. times offered</Text>
                )}
              </View>
              <View style={styles.dateContainer}>
                <Text style={styles.date}>{formatDate(viewing.requested_date)}</Text>
                <Text style={styles.time}>{viewing.requested_time}</Text>
              </View>
              <View style={[styles.status, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusText, { color: statusColor.text }]}>
                  {viewing.status}
                </Text>
              </View>
            </View>
          </AnimatedButton>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#FF9800',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#002395',
  },
  card: {
    marginBottom: 8,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  property: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  tenant: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  dateContainer: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  date: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  time: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  status: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  altOffered: {
    fontSize: 10,
    color: '#0369A1',
    fontWeight: '600',
    marginTop: 2,
  },
});
