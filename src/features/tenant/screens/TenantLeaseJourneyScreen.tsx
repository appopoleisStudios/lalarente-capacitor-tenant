import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import {
  type TimelineEvent,
  type LeaseWithJoins,
  safeDate,
  formatDate,
  formatTimeAgo,
  fetchActiveLease,
  fetchApplications,
  fetchHoldingDeposits,
  fetchPayments,
  fetchInspections,
  fetchMaintenance,
  fetchRenewals,
  buildApplicationEvents,
  buildDepositEvents,
  buildLeaseSigningEvents,
  buildLeaseStartEvent,
  buildPaymentEvents,
  buildInspectionEvents,
  buildMaintenanceEvents,
  buildCpaNoticeEvents,
  buildRenewalEvents,
  buildLeaseEndEvents,
} from '../utils/leaseJourneyHelpers';

// ─── Style helpers (kept local — render-only, not tested) ────────────────────

const EVENT_ICONS: Record<TimelineEvent['type'], keyof typeof Ionicons.glyphMap> = {
  application_submitted: 'document-text-outline',
  application_approved: 'checkmark-circle-outline',
  holding_deposit_paid: 'shield-checkmark-outline',
  lease_signed_owner: 'create-outline',
  lease_signed_tenant: 'create-outline',
  lease_executed: 'ribbon-outline',
  lease_started: 'home-outline',
  rent_paid: 'cash-outline',
  rent_overdue: 'alert-circle-outline',
  inspection_scheduled: 'calendar-outline',
  inspection_completed: 'clipboard-outline',
  maintenance_opened: 'construct-outline',
  maintenance_resolved: 'checkmark-done-outline',
  notice_80_day: 'notifications-outline',
  notice_60_day: 'notifications-outline',
  notice_40_day: 'warning-outline',
  renewal_pending: 'refresh-outline',
  renewal_accepted: 'checkmark-circle-outline',
  lease_expiring: 'time-outline',
  lease_expired: 'close-circle-outline',
  lease_terminated: 'exit-outline',
};

const EVENT_COLORS: Record<string, string> = {
  error: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  info: '#2563EB',
};

const EVENT_BG: Record<string, string> = {
  error: '#FEF2F2',
  success: '#F0FDF4',
  warning: '#FFFBEB',
  info: '#EFF6FF',
};

function eventStyle(type: TimelineEvent['type']) {
  switch (type) {
    case 'rent_overdue':
    case 'lease_expired':
    case 'notice_40_day':
    case 'lease_terminated':
      return { color: EVENT_COLORS.error, bg: EVENT_BG.error };
    case 'rent_paid':
    case 'application_approved':
    case 'lease_executed':
    case 'lease_signed_owner':
    case 'lease_signed_tenant':
    case 'lease_started':
    case 'maintenance_resolved':
    case 'renewal_accepted':
      return { color: EVENT_COLORS.success, bg: EVENT_BG.success };
    case 'notice_80_day':
    case 'notice_60_day':
    case 'lease_expiring':
    case 'renewal_pending':
      return { color: EVENT_COLORS.warning, bg: EVENT_BG.warning };
    default:
      return { color: EVENT_COLORS.info, bg: EVENT_BG.info };
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function TenantLeaseJourneyScreen() {
  const router = useRouter();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaseStatus, setLeaseStatus] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string>('');

  const loadTimeline = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const lease = await fetchActiveLease(user.id);
      if (!lease) {
        setEvents([]);
        setLeaseStatus(null);
        setPropertyName('');
        return;
      }

      setLeaseStatus(lease.status);
      setPropertyName(lease.property?.title || 'Property');
      const allEvents: TimelineEvent[] = [];

      // Fetch all data in parallel
      const [
        apps,
        deposits,
        payments,
        inspections,
        maintenance,
        renewals,
      ] = await Promise.all([
        fetchApplications(user.id, lease.property_id!),
        fetchHoldingDeposits(user.id, lease.property_id!),
        fetchPayments(lease.id),
        fetchInspections(lease.id),
        fetchMaintenance(user.id, lease.property_id!),
        fetchRenewals(lease.id),
      ]);

      // Build timeline segments
      allEvents.push(...buildApplicationEvents(apps));
      allEvents.push(...buildDepositEvents(deposits));
      allEvents.push(...buildLeaseSigningEvents(lease));
      allEvents.push(buildLeaseStartEvent(lease));
      allEvents.push(...buildPaymentEvents(payments));
      allEvents.push(...buildInspectionEvents(inspections));
      allEvents.push(...buildMaintenanceEvents(maintenance));
      allEvents.push(...buildCpaNoticeEvents(lease));
      allEvents.push(...buildRenewalEvents(renewals));
      allEvents.push(...buildLeaseEndEvents(lease));

      // Sort by date (newest first)
      allEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading lease journey:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lease journey');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTimeline();
    setRefreshing(false);
  };

  // ── Render ──

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      </SafeAreaView>
    );
  }

  if (!leaseStatus) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="map-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No Active Lease</Text>
          <Text style={styles.emptyText}>
            You need an active lease to view your journey timeline.
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push('/(tenant)/search')}
          >
            <Text style={styles.searchButtonText}>Search Properties</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTimeline}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Lease Journey</Text>
            <Text style={styles.headerSubtitle}>{propertyName}</Text>
          </View>
          <TouchableOpacity
            style={styles.leaseButton}
            onPress={() => router.push('/(tenant)/lease')}
          >
            <Ionicons name="document-text" size={22} color="#16A34A" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#16A34A" />
          }
        >
          {/* Timeline */}
          <View style={styles.timelineContainer}>
            {events.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="time-outline" size={48} color="#CCC" />
                <Text style={styles.emptyStateText}>No events yet</Text>
              </View>
            ) : (
              events.map((event, index) => {
                const isLast = index === events.length - 1;
                const { color: eventColor, bg: eventBg } = eventStyle(event.type);
                const iconName = EVENT_ICONS[event.type];

                return (
                  <View key={event.id} style={styles.eventRow}>
                    {/* Timeline line + dot */}
                    <View style={styles.timelineColumn}>
                      <View style={[styles.timelineDot, { backgroundColor: eventColor }]}>
                        <Ionicons name={iconName} size={14} color="#FFF" />
                      </View>
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>

                    {/* Event card */}
                    <View
                      style={[
                        styles.eventCard,
                        { backgroundColor: eventBg, borderLeftColor: eventColor },
                      ]}
                    >
                      <View style={styles.eventHeader}>
                        <Text style={[styles.eventTitle, { color: eventColor }]}>
                          {event.title}
                        </Text>
                        {event.status === 'completed' && (
                          <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                        )}
                        {event.status === 'overdue' && (
                          <Ionicons name="alert-circle" size={16} color="#DC2626" />
                        )}
                        {event.status === 'warning' && (
                          <Ionicons name="time" size={16} color="#D97706" />
                        )}
                      </View>
                      <Text style={styles.eventSubtitle} numberOfLines={2}>
                        {event.subtitle}
                      </Text>
                      <Text style={styles.eventDate}>
                        {formatDate(event.date)} · {formatTimeAgo(event.date)}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendTitle}>Understanding Your Timeline</Text>
            <View style={styles.legendItems}>
              <LegendItem color="#16A34A" label="Completed" />
              <LegendItem color="#D97706" label="Upcoming / In progress" />
              <LegendItem color="#DC2626" label="Overdue / Action needed" />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const LegendItem = ({ color, label }: { color: string; label: string }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendLabel}>{label}</Text>
  </View>
);

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  leaseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  timelineContainer: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  eventRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineColumn: {
    width: 40,
    alignItems: 'center',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E5E7EB',
  },
  eventCard: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  eventSubtitle: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 6,
  },
  eventDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  searchButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#16A34A',
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#16A34A',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  legend: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  legendItems: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
});
