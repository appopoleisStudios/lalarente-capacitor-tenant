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
import { calculateExpiryNoticeDate } from '../../../shared/utils/businessDayCalculator';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimelineEvent {
  id: string;
  type:
    | 'application_submitted'
    | 'application_approved'
    | 'holding_deposit_paid'
    | 'lease_signed_owner'
    | 'lease_signed_tenant'
    | 'lease_executed'
    | 'lease_started'
    | 'rent_paid'
    | 'rent_overdue'
    | 'inspection_scheduled'
    | 'inspection_completed'
    | 'maintenance_opened'
    | 'maintenance_resolved'
    | 'notice_80_day'
    | 'notice_60_day'
    | 'notice_40_day'
    | 'renewal_pending'
    | 'renewal_accepted'
    | 'lease_expiring'
    | 'lease_expired'
    | 'lease_terminated';
  title: string;
  subtitle: string;
  date: Date;
  status: 'completed' | 'pending' | 'overdue' | 'warning';
  metadata?: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Safely create a Date, defaulting to now if value is null/undefined */
function safeDate(value: string | Date | null | undefined): Date {
  if (value == null) return new Date();
  return new Date(value);
}

function unpackRelation<T>(value: T | T[] | null | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function getEventIcon(type: TimelineEvent['type']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'application_submitted': return 'document-text-outline';
    case 'application_approved': return 'checkmark-circle-outline';
    case 'holding_deposit_paid': return 'shield-checkmark-outline';
    case 'lease_signed_owner':
    case 'lease_signed_tenant': return 'create-outline';
    case 'lease_executed': return 'ribbon-outline';
    case 'lease_started': return 'home-outline';
    case 'rent_paid': return 'cash-outline';
    case 'rent_overdue': return 'alert-circle-outline';
    case 'inspection_scheduled': return 'calendar-outline';
    case 'inspection_completed': return 'clipboard-outline';
    case 'maintenance_opened': return 'construct-outline';
    case 'maintenance_resolved': return 'checkmark-done-outline';
    case 'notice_80_day': return 'notifications-outline';
    case 'notice_60_day': return 'notifications-outline';
    case 'notice_40_day': return 'warning-outline';
    case 'renewal_pending': return 'refresh-outline';
    case 'renewal_accepted': return 'checkmark-circle-outline';
    case 'lease_expiring': return 'time-outline';
    case 'lease_expired': return 'close-circle-outline';
    case 'lease_terminated': return 'exit-outline';
  }
}

function getEventColor(type: TimelineEvent['type']): string {
  switch (type) {
    case 'rent_overdue':
    case 'lease_expired':
    case 'notice_40_day':
    case 'lease_terminated': return '#DC2626';
    case 'rent_paid':
    case 'application_approved':
    case 'lease_executed':
    case 'lease_signed_owner':
    case 'lease_signed_tenant':
    case 'lease_started':
    case 'maintenance_resolved':
    case 'renewal_accepted': return '#16A34A';
    case 'notice_80_day':
    case 'notice_60_day':
    case 'lease_expiring':
    case 'renewal_pending': return '#D97706';
    default: return '#2563EB';
  }
}

function getEventBg(type: TimelineEvent['type']): string {
  switch (type) {
    case 'rent_overdue':
    case 'lease_expired':
    case 'lease_terminated': return '#FEF2F2';
    case 'rent_paid':
    case 'application_approved':
    case 'lease_executed':
    case 'maintenance_resolved':
    case 'renewal_accepted':
    case 'lease_started': return '#F0FDF4';
    case 'notice_80_day':
    case 'notice_60_day':
    case 'lease_expiring':
    case 'renewal_pending': return '#FFFBEB';
    default: return '#EFF6FF';
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `In ${Math.abs(diffDays)} days`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
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

      // 1. Get active lease
      const { data: lease, error: leaseError } = await supabase
        .from('leases')
        .select(`
          *,
          property:properties!property_id(id, title, address, city),
          owner:profiles!owner_id(full_name, email, phone)
        `)
        .eq('tenant_id', user.id)
        .in('status', ['active', 'month_to_month', 'pending_tenant_signature', 'pending_owner_signature', 'renewal_pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leaseError) throw leaseError;
      if (!lease) {
        setEvents([]);
        setLeaseStatus(null);
        setPropertyName('');
        return;
      }

      const leaseRecord = lease as Record<string, unknown>;
      const resolved = {
        ...leaseRecord,
        property: unpackRelation(leaseRecord.property as any),
        owner: unpackRelation(leaseRecord.owner as any),
      } as any;

      setLeaseStatus(resolved.status);
      setPropertyName(resolved.property?.title || 'Property');
      const timeline: TimelineEvent[] = [];

      // 2. Application events
      const { data: apps } = await supabase
        .from('rental_applications')
        .select('id, status, created_at, updated_at')
        .eq('tenant_id', user.id)
        .eq('property_id', resolved.property_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (apps && apps.length > 0) {
        const app = apps[0];
        timeline.push({
          id: `app-submitted-${app.id}`,
          type: 'application_submitted',
          title: 'Application Submitted',
          subtitle: 'Your rental application was submitted',
          date: safeDate(app.created_at),
          status: 'completed',
        });

        if (app.status === 'approved') {
          timeline.push({
            id: `app-approved-${app.id}`,
            type: 'application_approved',
            title: 'Application Approved',
            subtitle: 'Landlord approved your application',
            date: safeDate(app.updated_at),
            status: 'completed',
          });
        }
      }

      // 3. Holding deposit
      const { data: deposits } = await supabase
        .from('holding_deposits')
        .select('id, created_at, status, paid_at')
        .eq('tenant_id', user.id)
        .eq('property_id', resolved.property_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (deposits && deposits.length > 0) {
        const dep = deposits[0];
        const paidDate = dep.paid_at || dep.created_at;
        timeline.push({
          id: `holding-deposit-${dep.id}`,
          type: 'holding_deposit_paid',
          title: 'Holding Deposit Paid',
          subtitle: dep.status === 'paid' ? 'Holding deposit secured your spot' : 'Holding deposit recorded',
          date: safeDate(paidDate),
          status: dep.status === 'paid' ? 'completed' : 'pending',
        });
      }

      // 4. Lease signing events
      if (resolved.owner_signed_at) {
        timeline.push({
          id: `lease-signed-owner-${resolved.id}`,
          type: 'lease_signed_owner',
          title: 'Owner Signed Lease',
          subtitle: resolved.owner?.full_name || 'Landlord signed the lease agreement',
          date: safeDate(resolved.owner_signed_at),
          status: 'completed',
        });
      }

      if (resolved.owner_signed_at || resolved.tenant_signed_at) {
        // If only one has signed, the other is pending
        const otherSigned = resolved.owner_signed_at ? 'tenant' : 'owner';
        timeline.push({
          id: `lease-signed-${resolved.id}`,
          type: resolved.tenant_signed_at ? 'lease_signed_tenant' : 'lease_signed_owner',
          title: resolved.tenant_signed_at ? 'You Signed Lease' : `Awaiting ${otherSigned === 'owner' ? 'Owner' : 'Your'} Signature`,
          subtitle: resolved.tenant_signed_at
            ? 'You have signed the lease agreement'
            : `${otherSigned === 'owner' ? 'Owner' : 'You'} still need to sign the lease`,
          date: safeDate(resolved.tenant_signed_at || resolved.created_at),
          status: resolved.tenant_signed_at ? 'completed' : 'pending',
        });
      }

      if (resolved.executed_at) {
        timeline.push({
          id: `lease-executed-${resolved.id}`,
          type: 'lease_executed',
          title: 'Lease Executed',
          subtitle: 'The lease is now legally binding',
          date: safeDate(resolved.executed_at),
          status: 'completed',
        });
      }

      // 5. Lease start
      const startDate = safeDate(resolved.start_date);
      const now = new Date();
      timeline.push({
        id: `lease-start-${resolved.id}`,
        type: 'lease_started',
        title: 'Lease Started',
        subtitle: `${formatDate(startDate)} — ${resolved.property?.address || ''}`,
        date: startDate,
        status: startDate <= now ? 'completed' : 'pending',
      });

      // 6. Payments
      const { data: payments } = await supabase
        .from('payments')
        .select('id, amount, due_date, paid_date, status, type')
        .eq('lease_id', resolved.id)
        .order('due_date', { ascending: false });

      if (payments) {
        // Recent payments (last 12)
        const recentPayments = payments.slice(0, 12);
        for (const payment of recentPayments) {
          const dueDate = safeDate(payment.due_date);
          const isOverdue = payment.status === 'pending' && dueDate < now;
          const isPaid = payment.status === 'completed' || !!payment.paid_date;
          const isPending = payment.status === 'pending' && dueDate >= now;

          if (isPaid) {
            timeline.push({
              id: `payment-paid-${payment.id}`,
              type: 'rent_paid',
              title: `Rent Paid — R${(payment.amount || 0).toLocaleString()}`,
              subtitle: `Paid ${payment.paid_date ? formatDate(safeDate(payment.paid_date)) : ''}`,
              date: safeDate(payment.paid_date || payment.due_date),
              status: 'completed',
            });
          } else if (isOverdue) {
            timeline.push({
              id: `payment-overdue-${payment.id}`,
              type: 'rent_overdue',
              title: `Rent Overdue — R${(payment.amount || 0).toLocaleString()}`,
              subtitle: `Due ${formatDate(dueDate)} — payment overdue`,
              date: dueDate,
              status: 'overdue',
            });
          } else if (isPending) {
            timeline.push({
              id: `payment-pending-${payment.id}`,
              type: 'rent_overdue', // Use same icon but mark as pending/warning
              title: `Rent Due — R${(payment.amount || 0).toLocaleString()}`,
              subtitle: `Due ${formatDate(dueDate)}`,
              date: dueDate,
              status: 'warning',
              metadata: { paymentId: payment.id },
            });
          }
        }
      }

      // 7. Inspections
      const { data: inspections } = await supabase
        .from('inspections')
        .select('id, type, scheduled_date, status, completed_date, created_at')
        .eq('lease_id', resolved.id)
        .order('scheduled_date', { ascending: false });

      const inspectionList = (inspections as any[]) ?? [];
      for (const insp of inspectionList) {
        const completedDate = insp.completed_date as string | null;
        const isCompleted = insp.status === 'completed' || !!completedDate;
        timeline.push({
          id: `inspection-${insp.id}`,
          type: isCompleted ? 'inspection_completed' : 'inspection_scheduled',
          title: `${isCompleted ? 'Completed' : 'Scheduled'} — ${
            insp.type === 'move_in' ? 'Move-In' :
            insp.type === 'move_out' ? 'Move-Out' : 'Periodic'
          } Inspection`,
          subtitle: isCompleted
            ? `Completed ${formatDate(safeDate(completedDate!))}`
            : `Scheduled for ${formatDate(safeDate(insp.scheduled_date))}`,
          date: safeDate(isCompleted ? completedDate! : insp.scheduled_date),
          status: isCompleted ? 'completed' : 'pending',
        });
      }

      // 8. Maintenance requests
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select('id, title, status, created_at')
        .eq('tenant_id', user.id)
        .eq('property_id', resolved.property_id)
        .order('created_at', { ascending: false });

      const maintList = (maintenance as any[]) ?? [];
      for (const req of maintList) {
        const isResolved = req.status === 'completed';
        timeline.push({
          id: `maintenance-${req.id}`,
          type: isResolved ? 'maintenance_resolved' : 'maintenance_opened',
          title: req.title || 'Maintenance Request',
          subtitle: isResolved              ? `Resolved ${formatDate(safeDate(req.updated_at || req.created_at))}`
              : `Opened ${formatDate(safeDate(req.created_at))}`,
          date: safeDate(isResolved ? (req.updated_at || req.created_at) : req.created_at),
          status: isResolved ? 'completed' : 'pending',
        });
      }

      // 9. CPA notice dates (80, 60, 40 business days before expiry)
      const endDate = safeDate(resolved.end_date);
      const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry > 0 && resolved.status === 'active') {
        const notice80Due = calculateExpiryNoticeDate(endDate, 80);
        const notice60Due = calculateExpiryNoticeDate(endDate, 60);
        const notice40Due = calculateExpiryNoticeDate(endDate, 40);

        if (daysUntilExpiry <= 120) {
          const notice80Sent = !!resolved.notice_80_sent_at;
          timeline.push({
            id: `notice-80-${resolved.id}`,
            type: 'notice_80_day',
            title: `80-Day Notice${notice80Sent ? ' Sent' : ' Due'}`,
            subtitle: notice80Sent
              ? `Sent ${formatDate(safeDate(resolved.notice_80_sent_at || resolved.created_at))}`
              : `Due ${formatDate(notice80Due)} — CPA renewal notice`,
            date: notice80Due,
            status: notice80Sent ? 'completed' : (notice80Due <= now ? 'overdue' : 'warning'),
          });
        }

        if (daysUntilExpiry <= 90) {
          const notice60Sent = !!resolved.notice_60_sent_at;
          timeline.push({
            id: `notice-60-${resolved.id}`,
            type: 'notice_60_day',
            title: `60-Day Notice${notice60Sent ? ' Sent' : ' Due'}`,
            subtitle: notice60Sent
              ? `Sent ${formatDate(safeDate(resolved.notice_60_sent_at || resolved.created_at))}`
              : `Due ${formatDate(notice60Due)} — CPA renewal notice`,
            date: notice60Due,
            status: notice60Sent ? 'completed' : (notice60Due <= now ? 'overdue' : 'warning'),
          });
        }

        if (daysUntilExpiry <= 60) {
          const notice40Sent = !!resolved.notice_40_sent_at;
          timeline.push({
            id: `notice-40-${resolved.id}`,
            type: 'notice_40_day',
            title: `40-Day Notice${notice40Sent ? ' Sent' : ' Due'}`,
            subtitle: notice40Sent
              ? `Sent ${formatDate(safeDate(resolved.notice_40_sent_at || resolved.created_at))}`
              : `Due ${formatDate(notice40Due)} — CPA renewal deadline approaching`,
            date: notice40Due,
            status: notice40Sent ? 'completed' : (notice40Due <= now ? 'overdue' : 'warning'),
          });
        }
      }

      // 10. Renewal negotiations
      const { data: renewals } = await supabase
        .from('renewal_negotiations')
        .select('id, status, created_at, response_at')
        .eq('lease_id', resolved.id)
        .order('created_at', { ascending: false });

      if (renewals && renewals.length > 0) {
        for (const renewal of renewals) {
          timeline.push({
            id: `renewal-${renewal.id}`,
            type: renewal.status === 'accepted' ? 'renewal_accepted' : 'renewal_pending',
            title: renewal.status === 'accepted' ? 'Renewal Accepted' : 'Renewal Proposed',
            subtitle: renewal.status === 'accepted'
              ? `Renewed ${formatDate(safeDate(renewal.response_at || renewal.created_at))}`
              : `Proposed ${formatDate(safeDate(renewal.created_at))}`,
            date: safeDate(renewal.response_at || renewal.created_at),
            status: renewal.status === 'accepted' ? 'completed' : 'pending',
          });
        }
      }

      // 11. Lease end / expiry
      if (resolved.status === 'active' || resolved.status === 'month_to_month') {
        if (daysUntilExpiry <= 120 && daysUntilExpiry > 0) {
          timeline.push({
            id: `lease-expiring-${resolved.id}`,
            type: 'lease_expiring',
            title: `Lease Expiring in ${daysUntilExpiry} days`,
            subtitle: `Ends ${formatDate(endDate)}`,
            date: endDate,
            status: daysUntilExpiry <= 30 ? 'overdue' : 'warning',
          });
        } else if (daysUntilExpiry <= 0) {
          timeline.push({
            id: `lease-expired-${resolved.id}`,
            type: 'lease_expired',
            title: 'Lease Expired',
            subtitle: `Ended ${formatDate(endDate)}`,
            date: endDate,
            status: 'overdue',
          });
        }
      }

      if (resolved.status === 'early_terminated') {
        timeline.push({
          id: `lease-terminated-${resolved.id}`,
          type: 'lease_terminated',
          title: 'Lease Terminated Early',
          subtitle: resolved.terminated_at
            ? `Terminated ${formatDate(safeDate(resolved.terminated_at))}`
            : 'Early termination processed',
          date: safeDate(resolved.terminated_at || resolved.updated_at),
          status: 'overdue',
        });
      }

      // Sort by date (newest first)
      timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEvents(timeline);
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
                const eventColor = getEventColor(event.type);
                const eventBg = getEventBg(event.type);
                const iconName = getEventIcon(event.type);

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
