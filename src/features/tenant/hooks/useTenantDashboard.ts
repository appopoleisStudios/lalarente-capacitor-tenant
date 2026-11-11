import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/src/lib/supabase';
import { paymentsApi } from '../../properties/api/paymentsApi';
import { messagesApi } from '../../messaging/api/messagesApi';
import { checkTenantProfileCompleteness } from '../utils/profileCompleteness';
import { queryKeys } from '@/src/core/query/queryKeys';

export interface TenantDashboardData {
  userName: string;
  activeLease: any | null;
  nextPayment: any | null;
  recentPayments: any[];
  maintenanceRequests: any[];
  upcomingViewings: any[];
  pendingApplications: any[];
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
  pendingInspection: any | null;
  notifications: any[];
  viewingAlerts: any[];
}

export function useTenantDashboard(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.tenant.dashboard(userId ?? undefined),
    queryFn: () => fetchDashboardData(userId!),
    enabled: !!userId,
  });
}

export function useTenantDashboardQueryClient() {
  return useQueryClient();
}

async function fetchDashboardData(userId: string): Promise<TenantDashboardData> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single();

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const [leaseResult, payments, maintenanceResult, viewingsResult] = await Promise.all([
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
  ]);

  if (leaseResult.error) throw new Error(`leases: ${leaseResult.error.message}`);
  if (maintenanceResult.error)
    throw new Error(`maintenance_requests: ${maintenanceResult.error.message}`);
  if (viewingsResult.error) throw new Error(`viewing_requests: ${viewingsResult.error.message}`);

  // Filter out past appointments using the effective date (confirmed_date ?? requested_date),
  // then cap to 3. Must filter before limiting: a SQL LIMIT(3) could fill the
  // buffer with historical records and hide future appointments entirely.
  const upcomingViewings = filterUpcomingViewings(viewingsResult.data ?? [], new Date()).slice(0, 3);

  const upcoming = payments.find((p) => p.status === 'pending') ?? null;
  const recent = payments.filter((p) => p.status === 'completed').slice(0, 3);

  const { data: recentDeclined, error: declinedError } = await supabase
    .from('viewing_requests')
    .select(
      'id, status, requested_date, requested_time, confirmed_date, owner_response, alternative_times, updated_at, created_at, property_id, property:properties!property_id(id, title)'
    )
    .eq('tenant_id', userId)
    .eq('status', 'declined')
    .gte('created_at', twoWeeksAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  if (declinedError) throw new Error(`viewing_requests (declined): ${declinedError.message}`);

  let filteredAlerts = recentDeclined ?? [];
  if (filteredAlerts.length > 0) {
    const declinedPropertyIds = [...new Set(filteredAlerts.map((v: any) => v.property_id))];
    const { data: activeForProps } = await supabase
      .from('viewing_requests')
      .select('property_id')
      .eq('tenant_id', userId)
      .in('status', ['pending', 'approved'])
      .in('property_id', declinedPropertyIds);
    const activePropertyIds = new Set((activeForProps ?? []).map((v: any) => v.property_id));
    filteredAlerts = filteredAlerts.filter((v: any) => !activePropertyIds.has(v.property_id));
  }

  if (filteredAlerts.length > 0) {
    const { data: readNotifs } = await (supabase as any)
      .from('notifications')
      .select('data')
      .eq('user_id', userId)
      .in('type', ['viewing_declined', 'viewing_approved'])
      .not('read_at', 'is', null);
    if (readNotifs && readNotifs.length > 0) {
      const readViewingIds = new Set(readNotifs.map((n: any) => n.data?.viewingId).filter(Boolean));
      filteredAlerts = filteredAlerts.filter((v: any) => !readViewingIds.has(v.id));
    }
  }

  const { data: unreadNotifs } = await (supabase as any)
    .from('notifications')
    .select('id, type, title, body, data, created_at')
    .eq('user_id', userId)
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: apps } = await supabase
    .from('rental_applications')
    .select('id, status, created_at, property:properties!property_id(id, title)')
    .eq('tenant_id', userId)
    .in('status', ['submitted', 'under_review', 'pending_verification'])
    .order('created_at', { ascending: false })
    .limit(3);

  const threads = await messagesApi.getUserThreads(userId, 'tenant');
  const sorted = [...threads].sort((a, b) => {
    const aUnread = a.unread_count_tenant ?? 0;
    const bUnread = b.unread_count_tenant ?? 0;
    if (bUnread !== aUnread) return bUnread - aUnread;
    return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime();
  });
  const unreadTotal = threads.reduce((sum, t) => sum + (t.unread_count_tenant ?? 0), 0);

  const { data: pendingInsp } = await supabase
    .from('inspections')
    .select('id, type, scheduled_date, property:properties!property_id(title)')
    .eq('tenant_id', userId)
    .eq('status', 'pending_signatures')
    .limit(1)
    .maybeSingle();

  let profileMissing: string[] | undefined;
  const completeness = await checkTenantProfileCompleteness(userId);
  if (completeness.status === 'ok') {
    profileMissing = completeness.complete ? [] : completeness.missing;
  }

  return {
    userName: profile?.full_name || 'Tenant',
    activeLease: leaseResult.data ?? null,
    nextPayment: upcoming,
    recentPayments: recent,
    maintenanceRequests: maintenanceResult.data ?? [],
    upcomingViewings,
    pendingApplications: apps ?? [],
    messageThreads: sorted.slice(0, 3).map((t) => ({
      id: t.id,
      owner_name: (t as any).owner?.full_name ?? 'Landlord',
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

function filterUpcomingViewings(viewings: any[], today: Date): any[] {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return viewings.filter((v) => {
    const effectiveDateStr = v.confirmed_date ?? v.requested_date;
    if (!effectiveDateStr) return false;
    return new Date(effectiveDateStr) >= startOfToday;
  });
}
