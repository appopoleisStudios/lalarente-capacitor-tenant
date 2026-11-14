import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { paymentsApi, PaymentWithRelations } from '../../properties/api/paymentsApi';
import { messagesApi } from '../../messaging/api/messagesApi';
import { checkTenantProfileCompleteness } from '../utils/profileCompleteness';
import { queryKeys } from '@/src/core/query/queryKeys';
import { readDashboardCache, writeDashboardCache } from '@/src/shared/utils/dashboardCache';

interface ActiveLeaseProperty {
  id: string;
  title: string;
  address: string;
  city: string;
  rent_amount: number | null;
  media_3d_url: string | null;
}

interface ActiveLeaseOwner {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface ActiveLease {
  id: string;
  status: string;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  lease_type: string;
  deposit_amount?: number | null;
  deposit_total_interest?: number | null;
  property: ActiveLeaseProperty | null;
  owner: ActiveLeaseOwner | null;
}

interface MaintenanceRequest {
  id: string;
  status: string;
  description: string;
  title?: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface UpcomingViewing {
  id: string;
  requested_date: string;
  requested_time: string | null;
  confirmed_date: string | null;
  status: string;
  owner_response: string | null;
  alternative_times?: string[] | null;
  updated_at?: string | null;
  created_at?: string | null;
  property_id?: string;
  property: { id: string; title: string; address?: string } | null;
}

interface PendingApplication {
  id: string;
  status: string;
  created_at: string | null;
  property: { id: string; title: string } | null;
}

interface PendingInspection {
  id: string;
  type: string;
  scheduled_date: string;
  property: { title: string } | null;
}

interface DashboardNotification {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface TenantDashboardData {
  userName: string;
  activeLease: ActiveLease | null;
  nextPayment: PaymentWithRelations | null;
  recentPayments: PaymentWithRelations[];
  maintenanceRequests: MaintenanceRequest[];
  upcomingViewings: UpcomingViewing[];
  pendingApplications: PendingApplication[];
  messageThreads: {
    id: string;
    owner_name: string;
    subject: string;
    unread_count: number;
    last_message_at: string | null;
    category: string | null;
  }[];
  totalUnreadMessages: number;
  profileMissing: string[] | undefined;
  pendingInspection: PendingInspection | null;
  notifications: DashboardNotification[];
  viewingAlerts: UpcomingViewing[];
}

export function useTenantDashboard(userId: string | null) {
  // Last dashboard for this tenant, shown while the first fetch runs.
  const [cached, setCached] = useState<TenantDashboardData | undefined>(undefined);
  useEffect(() => {
    if (!userId) return;
    readDashboardCache<TenantDashboardData>('tenant', userId).then((c) => {
      if (c) {
        console.log('[perf] tenant dashboard cache painted');
        setCached(c);
      }
    });
  }, [userId]);

  return useQuery({
    queryKey: queryKeys.tenant.dashboard(userId ?? undefined),
    queryFn: async () => {
      const startedAt = Date.now();
      const data = await fetchDashboardData(userId!);
      console.log(`[perf] tenant dashboard data in ${Date.now() - startedAt}ms`);
      writeDashboardCache('tenant', userId!, data);
      return data;
    },
    enabled: !!userId,
    placeholderData: cached,
  });
}

export function useTenantDashboardQueryClient() {
  return useQueryClient();
}

async function fetchDashboardData(userId: string): Promise<TenantDashboardData> {
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  // One parallel wave for every independent query (these used to run one
  // after another — ~10 round trips before the dashboard could render).
  const [
    { data: profile },
    leaseResult,
    payments,
    maintenanceResult,
    viewingsResult,
    { data: recentDeclined, error: declinedError },
    { data: unreadNotifs },
    { data: apps },
    threads,
    { data: pendingInsp },
    completeness,
  ] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase
      .from('leases')
      .select(
        `*, property:properties!property_id(id, title, address, city, rent_amount, media_3d_url), owner:profiles!owner_id(id, full_name, phone, email)`
      )
      .eq('tenant_id', userId)
      .in('status', ['active', 'pending_tenant_signature', 'pending_owner_signature'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    paymentsApi.getTenantPayments(userId),
    supabase
      .from('maintenance_requests')
      .select('*')
      .eq('tenant_id', userId)
      .in('status', ['open', 'assigned', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('viewing_requests')
      .select(
        'id, requested_date, requested_time, confirmed_date, status, owner_response, property:properties!property_id(id, title, address)'
      )
      .eq('tenant_id', userId)
      .in('status', ['approved', 'pending'])
      .order('requested_date', { ascending: true }),
    supabase
      .from('viewing_requests')
      .select(
        'id, status, requested_date, requested_time, confirmed_date, owner_response, alternative_times, updated_at, created_at, property_id, property:properties!property_id(id, title)'
      )
      .eq('tenant_id', userId)
      .eq('status', 'declined')
      .gte('created_at', twoWeeksAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5),
    (supabase as any)
      .from('notifications')
      .select('id, type, title, body, data, created_at')
      .eq('user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('rental_applications')
      .select('id, status, created_at, property:properties!property_id(id, title)')
      .eq('tenant_id', userId)
      .in('status', ['submitted', 'under_review', 'pending_verification'])
      .order('created_at', { ascending: false })
      .limit(3),
    messagesApi.getUserThreads(userId, 'tenant'),
    supabase
      .from('inspections')
      .select('id, type, scheduled_date, property:properties!property_id(title)')
      .eq('tenant_id', userId)
      .eq('status', 'pending_signatures')
      .limit(1)
      .maybeSingle(),
    checkTenantProfileCompleteness(userId),
  ]);

  if (leaseResult.error) throw new Error(`leases: ${leaseResult.error.message}`);
  if (maintenanceResult.error)
    throw new Error(`maintenance_requests: ${maintenanceResult.error.message}`);
  if (viewingsResult.error) throw new Error(`viewing_requests: ${viewingsResult.error.message}`);
  if (declinedError) throw new Error(`viewing_requests (declined): ${declinedError.message}`);

  // Filter out past appointments using the effective date (confirmed_date ?? requested_date),
  // then cap to 3. Must filter before limiting: a SQL LIMIT(3) could fill the
  // buffer with historical records and hide future appointments entirely.
  const upcomingViewings = filterUpcomingViewings(
    (viewingsResult.data ?? []) as UpcomingViewing[],
    new Date()
  ).slice(0, 3);

  const upcoming = payments.find((p) => p.status === 'pending') ?? null;
  const recent = payments.filter((p) => p.status === 'completed').slice(0, 3);

  // Declined-viewing alerts: hide ones for properties with a newer live
  // request, and ones whose notification was already read (both in parallel).
  let filteredAlerts: UpcomingViewing[] = (recentDeclined ?? []) as unknown as UpcomingViewing[];
  if (filteredAlerts.length > 0) {
    const declinedPropertyIds = [
      ...new Set(filteredAlerts.map((v) => v.property_id).filter((id): id is string => !!id)),
    ];
    const [{ data: activeForProps }, { data: readNotifs }] = await Promise.all([
      supabase
        .from('viewing_requests')
        .select('property_id')
        .eq('tenant_id', userId)
        .in('status', ['pending', 'approved'])
        .in('property_id', declinedPropertyIds),
      (supabase as any)
        .from('notifications')
        .select('data')
        .eq('user_id', userId)
        .in('type', ['viewing_declined', 'viewing_approved'])
        .not('read_at', 'is', null),
    ]);
    const activePropertyIds = new Set(
      ((activeForProps ?? []) as { property_id: string }[]).map((v) => v.property_id)
    );
    filteredAlerts = filteredAlerts.filter(
      (v) => v.property_id && !activePropertyIds.has(v.property_id)
    );
    if (readNotifs && readNotifs.length > 0) {
      const readViewingIds = new Set(
        (readNotifs as { data?: { viewingId?: string } }[])
          .map((n) => n.data?.viewingId)
          .filter(Boolean)
      );
      filteredAlerts = filteredAlerts.filter((v) => !readViewingIds.has(v.id));
    }
  }

  const sorted = [...threads].sort((a, b) => {
    const aUnread = a.unread_count_tenant ?? 0;
    const bUnread = b.unread_count_tenant ?? 0;
    if (bUnread !== aUnread) return bUnread - aUnread;
    return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime();
  });
  const unreadTotal = threads.reduce((sum, t) => sum + (t.unread_count_tenant ?? 0), 0);

  let profileMissing: string[] | undefined;
  if (completeness.status === 'ok') {
    profileMissing = completeness.complete ? [] : completeness.missing;
  }

  return {
    userName: profile?.full_name || 'Tenant',
    activeLease: (leaseResult.data ?? null) as unknown as ActiveLease | null,
    nextPayment: upcoming,
    recentPayments: recent,
    maintenanceRequests: (maintenanceResult.data ?? []) as unknown as MaintenanceRequest[],
    upcomingViewings,
    pendingApplications: (apps ?? []) as unknown as PendingApplication[],
    messageThreads: sorted.slice(0, 3).map((t) => ({
      id: t.id,
      owner_name: (t as { owner?: { full_name?: string } }).owner?.full_name ?? 'Landlord',
      subject: t.subject,
      unread_count: t.unread_count_tenant ?? 0,
      last_message_at: t.last_message_at,
      category: t.category,
    })),
    totalUnreadMessages: unreadTotal,
    profileMissing,
    pendingInspection: pendingInsp ?? null,
    notifications: unreadNotifs ?? [],
    viewingAlerts: filteredAlerts,
  };
}

function filterUpcomingViewings(viewings: UpcomingViewing[], today: Date): UpcomingViewing[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return viewings.filter((v) => {
    const effectiveDateStr = v.confirmed_date ?? v.requested_date;
    if (!effectiveDateStr) return false;
    return new Date(effectiveDateStr) >= startOfToday;
  });
}
