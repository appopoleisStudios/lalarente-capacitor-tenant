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
import type { Database } from '../../../types/database.types';

// ─── Types ──────────────────────────────────────────────────────────────────

type LeaseRow = Database['public']['Tables']['leases']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type InspectionRow = Database['public']['Tables']['inspections']['Row'];
type MaintenanceRow = Database['public']['Tables']['maintenance_requests']['Row'];
/** Lightweight version with only the fields we query from maintenance_requests */
interface MaintenanceSummary {
  id: string;
  title: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}
type RenewalRow = Database['public']['Tables']['renewal_negotiations']['Row'];
type DepositRow = Database['public']['Tables']['holding_deposits']['Row'];
type ApplicationRow = Database['public']['Tables']['rental_applications']['Row'];

interface LeaseWithJoins extends LeaseRow {
  property: { id: string; title: string; address: string; city: string | null } | null;
  owner: { full_name: string | null; email: string | null; phone: string | null } | null;
}

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

function safeDate(value: string | Date | null | undefined): Date {
  if (value == null) return new Date();
  return new Date(value);
}

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

// ─── Data Fetchers ────────────────────────────────────────────────────────────

async function fetchActiveLease(userId: string): Promise<LeaseWithJoins | null> {
  const { data, error } = await supabase
    .from('leases')
    .select(`
      *,
      property:properties!property_id(id, title, address, city),
      owner:profiles!owner_id(full_name, email, phone)
    `)
    .eq('tenant_id', userId)
    .in('status', [
      'active', 'month_to_month', 'pending_tenant_signature',
      'pending_owner_signature', 'renewal_pending',
    ])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as LeaseWithJoins;
  return row;
}

async function fetchApplications(
  userId: string, propertyId: string
): Promise<ApplicationRow[]> {
  const { data } = await supabase
    .from('rental_applications')
    .select('id, status, created_at, updated_at')
    .eq('tenant_id', userId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data ?? []) as ApplicationRow[];
}

async function fetchHoldingDeposits(
  userId: string, propertyId: string
): Promise<DepositRow[]> {
  const { data } = await supabase
    .from('holding_deposits')
    .select('id, created_at, status, paid_at')
    .eq('tenant_id', userId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(1);
  return (data ?? []) as DepositRow[];
}

async function fetchPayments(leaseId: string): Promise<PaymentRow[]> {
  const { data } = await supabase
    .from('payments')
    .select('id, amount, due_date, paid_date, status, type')
    .eq('lease_id', leaseId)
    .order('due_date', { ascending: false })
    .limit(12);
  return (data ?? []) as PaymentRow[];
}

async function fetchInspections(leaseId: string): Promise<InspectionRow[]> {
  const { data } = await supabase
    .from('inspections')
    .select('id, type, scheduled_date, status, completed_date, created_at')
    .eq('lease_id', leaseId)
    .order('scheduled_date', { ascending: false });
  return (data ?? []) as InspectionRow[];
}

async function fetchMaintenance(
  userId: string, propertyId: string
): Promise<MaintenanceSummary[]> {
  const { data } = await supabase
    .from('maintenance_requests')
    .select('id, title, status, created_at, updated_at')
    .eq('tenant_id', userId)
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as MaintenanceSummary[];
}

async function fetchRenewals(leaseId: string): Promise<RenewalRow[]> {
  const { data } = await supabase
    .from('renewal_negotiations')
    .select('id, status, created_at, response_at')
    .eq('lease_id', leaseId)
    .order('created_at', { ascending: false });
  return (data ?? []) as RenewalRow[];
}

// ─── Timeline Builders ────────────────────────────────────────────────────────

function buildApplicationEvents(
  apps: ApplicationRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (apps.length === 0) return events;

  const app = apps[0];
  events.push({
    id: `app-submitted-${app.id}`,
    type: 'application_submitted',
    title: 'Application Submitted',
    subtitle: 'Your rental application was submitted',
    date: safeDate(app.created_at),
    status: 'completed',
  });

  if (app.status === 'approved') {
    events.push({
      id: `app-approved-${app.id}`,
      type: 'application_approved',
      title: 'Application Approved',
      subtitle: 'Landlord approved your application',
      date: safeDate(app.updated_at),
      status: 'completed',
    });
  }

  return events;
}

function buildDepositEvents(
  deposits: DepositRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  if (deposits.length === 0) return events;

  const dep = deposits[0];
  const paidDate = dep.paid_at || dep.created_at;
  events.push({
    id: `holding-deposit-${dep.id}`,
    type: 'holding_deposit_paid',
    title: 'Holding Deposit Paid',
    subtitle: dep.status === 'paid'
      ? 'Holding deposit secured your spot'
      : 'Holding deposit recorded',
    date: safeDate(paidDate),
    status: dep.status === 'paid' ? 'completed' : 'pending',
  });

  return events;
}

function buildLeaseSigningEvents(
  lease: LeaseWithJoins
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const ownerSignedAt = lease.owner_signed_at;
  const tenantSignedAt = lease.tenant_signed_at;
  const executedAt = lease.executed_at;

  if (ownerSignedAt) {
    events.push({
      id: `lease-signed-owner-${lease.id}`,
      type: 'lease_signed_owner',
      title: 'Owner Signed Lease',
      subtitle: lease.owner?.full_name || 'Landlord signed the lease agreement',
      date: safeDate(ownerSignedAt),
      status: 'completed',
    });
  }

  if (tenantSignedAt) {
    events.push({
      id: `lease-signed-tenant-${lease.id}`,
      type: 'lease_signed_tenant',
      title: 'You Signed Lease',
      subtitle: 'You have signed the lease agreement',
      date: safeDate(tenantSignedAt),
      status: 'completed',
    });
  } else if (ownerSignedAt) {
    events.push({
      id: `lease-signed-awaiting-${lease.id}`,
      type: 'lease_signed_tenant',
      title: 'Awaiting Your Signature',
      subtitle: 'You still need to sign the lease',
      date: safeDate(lease.created_at),
      status: 'pending',
    });
  }

  if (executedAt) {
    events.push({
      id: `lease-executed-${lease.id}`,
      type: 'lease_executed',
      title: 'Lease Executed',
      subtitle: 'The lease is now legally binding',
      date: safeDate(executedAt),
      status: 'completed',
    });
  }

  return events;
}

function buildPaymentEvents(
  payments: PaymentRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();

  for (const payment of payments) {
    const dueDate = safeDate(payment.due_date);
    const isPaid = payment.status === 'completed' || !!payment.paid_date;
    const isOverdue = payment.status === 'pending' && dueDate < now;

    if (isPaid) {
      events.push({
        id: `payment-paid-${payment.id}`,
        type: 'rent_paid',
        title: `Rent Paid — R${(payment.amount || 0).toLocaleString()}`,
        subtitle: `Paid ${payment.paid_date ? formatDate(safeDate(payment.paid_date)) : ''}`,
        date: safeDate(payment.paid_date || payment.due_date),
        status: 'completed',
      });
    } else if (isOverdue) {
      events.push({
        id: `payment-overdue-${payment.id}`,
        type: 'rent_overdue',
        title: `Rent Overdue — R${(payment.amount || 0).toLocaleString()}`,
        subtitle: `Due ${formatDate(dueDate)} — payment overdue`,
        date: dueDate,
        status: 'overdue',
      });
    } else {
      events.push({
        id: `payment-pending-${payment.id}`,
        type: 'rent_overdue',
        title: `Rent Due — R${(payment.amount || 0).toLocaleString()}`,
        subtitle: `Due ${formatDate(dueDate)}`,
        date: dueDate,
        status: 'warning',
        metadata: { paymentId: payment.id },
      });
    }
  }

  return events;
}

function buildInspectionEvents(
  inspections: InspectionRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const insp of inspections) {
    const isCompleted = insp.status === 'completed' || !!insp.completed_date;
    const typeLabel = insp.type === 'move_in' ? 'Move-In'
      : insp.type === 'move_out' ? 'Move-Out' : 'Periodic';

    events.push({
      id: `inspection-${insp.id}`,
      type: isCompleted ? 'inspection_completed' : 'inspection_scheduled',
      title: `${isCompleted ? 'Completed' : 'Scheduled'} — ${typeLabel} Inspection`,
      subtitle: isCompleted
        ? `Completed ${formatDate(safeDate(insp.completed_date))}`
        : `Scheduled for ${formatDate(safeDate(insp.scheduled_date))}`,
      date: safeDate(isCompleted ? insp.completed_date : insp.scheduled_date),
      status: isCompleted ? 'completed' : 'pending',
    });
  }

  return events;
}

function buildMaintenanceEvents(
  maintenance: MaintenanceSummary[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const req of maintenance) {
    const isResolved = req.status === 'completed';
    events.push({
      id: `maintenance-${req.id}`,
      type: isResolved ? 'maintenance_resolved' : 'maintenance_opened',
      title: req.title || 'Maintenance Request',
      subtitle: isResolved
        ? `Resolved ${formatDate(safeDate(req.updated_at || req.created_at))}`
        : `Opened ${formatDate(safeDate(req.created_at))}`,
      date: safeDate(isResolved ? (req.updated_at || req.created_at) : req.created_at),
      status: isResolved ? 'completed' : 'pending',
    });
  }

  return events;
}

function buildCpaNoticeEvents(
  lease: LeaseWithJoins
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  const endDate = safeDate(lease.end_date);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry <= 0 || lease.status !== 'active') return events;

  const notice80Date = calculateExpiryNoticeDate(endDate, 80);
  const notice60Date = calculateExpiryNoticeDate(endDate, 60);
  const notice40Date = calculateExpiryNoticeDate(endDate, 40);

  if (daysUntilExpiry <= 120) {
    const sent = !!lease.notice_80_sent_at;
    events.push({
      id: `notice-80-${lease.id}`,
      type: 'notice_80_day',
      title: `80-Day Notice${sent ? ' Sent' : ' Due'}`,
      subtitle: sent
        ? `Sent ${formatDate(safeDate(lease.notice_80_sent_at!))}`
        : `Due ${formatDate(notice80Date)} — CPA renewal notice`,
      date: notice80Date,
      status: sent ? 'completed' : (notice80Date <= now ? 'overdue' : 'warning'),
    });
  }

  if (daysUntilExpiry <= 90) {
    const sent = !!lease.notice_60_sent_at;
    events.push({
      id: `notice-60-${lease.id}`,
      type: 'notice_60_day',
      title: `60-Day Notice${sent ? ' Sent' : ' Due'}`,
      subtitle: sent
        ? `Sent ${formatDate(safeDate(lease.notice_60_sent_at!))}`
        : `Due ${formatDate(notice60Date)} — CPA renewal notice`,
      date: notice60Date,
      status: sent ? 'completed' : (notice60Date <= now ? 'overdue' : 'warning'),
    });
  }

  if (daysUntilExpiry <= 60) {
    const sent = !!lease.notice_40_sent_at;
    events.push({
      id: `notice-40-${lease.id}`,
      type: 'notice_40_day',
      title: `40-Day Notice${sent ? ' Sent' : ' Due'}`,
      subtitle: sent
        ? `Sent ${formatDate(safeDate(lease.notice_40_sent_at!))}`
        : `Due ${formatDate(notice40Date)} — CPA renewal deadline approaching`,
      date: notice40Date,
      status: sent ? 'completed' : (notice40Date <= now ? 'overdue' : 'warning'),
    });
  }

  return events;
}

function buildRenewalEvents(
  renewals: RenewalRow[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const renewal of renewals) {
    events.push({
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

  return events;
}

function buildLeaseEndEvents(
  lease: LeaseWithJoins
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const now = new Date();
  const endDate = safeDate(lease.end_date);
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (lease.status === 'early_terminated') {
    events.push({
      id: `lease-terminated-${lease.id}`,
      type: 'lease_terminated',
      title: 'Lease Terminated Early',
      subtitle: lease.terminated_at
        ? `Terminated ${formatDate(safeDate(lease.terminated_at))}`
        : 'Early termination processed',
      date: safeDate(lease.terminated_at || lease.updated_at),
      status: 'overdue',
    });
    return events;
  }

  if (lease.status === 'active' || lease.status === 'month_to_month') {
    if (daysUntilExpiry <= 120 && daysUntilExpiry > 0) {
      events.push({
        id: `lease-expiring-${lease.id}`,
        type: 'lease_expiring',
        title: `Lease Expiring in ${daysUntilExpiry} days`,
        subtitle: `Ends ${formatDate(endDate)}`,
        date: endDate,
        status: daysUntilExpiry <= 30 ? 'overdue' : 'warning',
      });
    } else if (daysUntilExpiry <= 0) {
      events.push({
        id: `lease-expired-${lease.id}`,
        type: 'lease_expired',
        title: 'Lease Expired',
        subtitle: `Ended ${formatDate(endDate)}`,
        date: endDate,
        status: 'overdue',
      });
    }
  }

  return events;
}

function buildLeaseStartEvent(
  lease: LeaseWithJoins
): TimelineEvent {
  const now = new Date();
  const startDate = safeDate(lease.start_date);
  return {
    id: `lease-start-${lease.id}`,
    type: 'lease_started',
    title: 'Lease Started',
    subtitle: `${formatDate(startDate)} — ${lease.property?.address || ''}`,
    date: startDate,
    status: startDate <= now ? 'completed' : 'pending',
  };
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
