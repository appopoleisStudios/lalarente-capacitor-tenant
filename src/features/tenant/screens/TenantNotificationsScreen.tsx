import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { colors } from '@/src/shared/theme/colors';

type AlertItem = {
  id: string;
  kind: 'viewing' | 'maintenance' | 'payment' | 'lease' | 'message' | 'notification';
  title: string;
  body: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  route: string;
  params?: Record<string, string>;
  timestamp: string;
  notificationDbId?: string; // ID from notifications table, if this item has one
};

export default function TenantNotificationsScreen() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAlertsAndMarkRead();
    }, [])
  );

  const loadAlertsAndMarkRead = async () => {
    // Load alerts first, then mark all DB notifications as read.
    // This way the list shows all items, but going back to dashboard
    // will show a reduced bell count.
    await loadAlerts();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await (supabase as any)
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('read_at', null);
    } catch (err) {
      // Non-critical
    }
  };

  const loadAlerts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const items: AlertItem[] = [];

      // 0. Fetch unread notifications from DB — we'll match these to items
      //    so tapping an item marks the corresponding DB row as read
      const { data: dbNotifs } = await (supabase as any)
        .from('notifications')
        .select('id, type, data, read_at')
        .eq('user_id', user.id)
        .is('read_at', null);

      const unreadNotifs = dbNotifs ?? [];

      // Helper: find matching notification DB row for a viewing
      const findNotifForViewing = (viewingId: string, types: string[]) => {
        return unreadNotifs.find((n: any) =>
          types.includes(n.type) && n.data?.viewingId === viewingId
        );
      };

      // 1. Viewing responses (declined/approved in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data: viewingResponses } = await supabase
        .from('viewing_requests')
        .select('id, status, requested_date, requested_time, owner_response, alternative_times, updated_at, property_id, property:properties!property_id(title)')
        .eq('tenant_id', user.id)
        .in('status', ['declined', 'approved'])
        .gte('updated_at', thirtyDaysAgo.toISOString())
        .order('updated_at', { ascending: false });

      // Filter out declined viewings where tenant already re-requested
      const declinedResponses = (viewingResponses ?? []).filter(v => v.status !== 'declined');
      const declinedOnly = (viewingResponses ?? []).filter(v => v.status === 'declined');
      if (declinedOnly.length > 0) {
        const propIds = [...new Set(declinedOnly.map((v: any) => v.property_id))];
        const { data: activeForProps } = await supabase
          .from('viewing_requests')
          .select('property_id')
          .eq('tenant_id', user.id)
          .in('status', ['pending', 'approved'])
          .in('property_id', propIds);
        const activeProps = new Set((activeForProps ?? []).map((v: any) => v.property_id));
        declinedOnly.forEach(v => {
          if (!activeProps.has((v as any).property_id)) {
            declinedResponses.push(v);
          }
        });
      }

      declinedResponses.forEach(v => {
        const isApproved = v.status === 'approved';
        const altCount = (v.alternative_times as string[] | null)?.length ?? 0;
        const matchedNotif = findNotifForViewing(v.id, isApproved ? ['viewing_approved'] : ['viewing_declined']);
        items.push({
          id: `viewing-${v.id}`,
          kind: 'viewing',
          title: isApproved ? 'Viewing Approved' : 'Viewing Declined',
          body: isApproved
            ? `Your viewing for ${v.property?.title || 'a property'} has been confirmed.`
            : `${v.property?.title || 'Property'}: ${v.owner_response || 'Owner declined your request.'}${altCount > 0 ? ` (${altCount} alternative time${altCount > 1 ? 's' : ''} proposed)` : ''}`,
          icon: isApproved ? 'checkmark-circle' : 'alert-circle',
          iconColor: isApproved ? '#4CAF50' : '#FF9800',
          bgColor: isApproved ? '#E8F5E9' : '#FFF3E0',
          route: `/(tenant)/viewings/${v.id}`,
          timestamp: v.updated_at ?? v.requested_date,
          notificationDbId: matchedNotif?.id,
        });
      });

      // 2. Pending viewings (awaiting owner response)
      const { data: pendingViewings } = await supabase
        .from('viewing_requests')
        .select('id, requested_date, requested_time, created_at, property:properties!property_id(title)')
        .eq('tenant_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      (pendingViewings ?? []).forEach(v => {
        items.push({
          id: `viewing-pending-${v.id}`,
          kind: 'viewing',
          title: 'Viewing Request Pending',
          body: `${v.property?.title || 'Property'} — ${v.requested_date} at ${v.requested_time?.slice(0, 5) || '—'}`,
          icon: 'time-outline',
          iconColor: '#F9A825',
          bgColor: '#FFF8E1',
          route: `/(tenant)/viewings/${v.id}`,
          timestamp: v.created_at!,
        });
      });

      // 3. Active maintenance requests
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select('id, title, status, created_at')
        .eq('tenant_id', user.id)
        .in('status', ['open', 'assigned', 'in_progress'])
        .order('created_at', { ascending: false });

      (maintenance ?? []).forEach(m => {
        items.push({
          id: `maint-${m.id}`,
          kind: 'maintenance',
          title: 'Maintenance Request',
          body: `${m.title || 'Maintenance'} — ${(m.status || 'open').replace(/_/g, ' ')}`,
          icon: 'construct',
          iconColor: colors.warning[500],
          bgColor: colors.warning[50],
          route: `/(tenant)/maintenance/${m.id}`,
          timestamp: m.created_at!,
        });
      });

      // 4. Pending lease signature
      const { data: pendingLease } = await supabase
        .from('leases')
        .select('id, created_at, property:properties!property_id(title)')
        .eq('tenant_id', user.id)
        .eq('status', 'pending_tenant_signature')
        .limit(1)
        .maybeSingle();

      if (pendingLease) {
        items.push({
          id: `lease-sign-${pendingLease.id}`,
          kind: 'lease',
          title: 'Lease Awaiting Signature',
          body: `Sign your lease for ${pendingLease.property?.title || 'your property'}`,
          icon: 'document-text',
          iconColor: colors.warning[500],
          bgColor: '#FFF8E1',
          route: '/(tenant)/lease',
          timestamp: pendingLease.created_at!,
        });
      }

      // 5. Upcoming payment due
      const { data: duePmt } = await supabase
        .from('payments')
        .select('id, amount, due_date')
        .eq('tenant_id', user.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (duePmt) {
        items.push({
          id: `pmt-${duePmt.id}`,
          kind: 'payment',
          title: 'Payment Due',
          body: `R ${(duePmt.amount || 0).toLocaleString()} due ${new Date(duePmt.due_date).toLocaleDateString('en-ZA')}`,
          icon: 'card',
          iconColor: colors.info[500],
          bgColor: colors.info[50],
          route: '/(tenant)/payments',
          timestamp: duePmt.due_date,
        });
      }

      // Sort all by timestamp descending
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAlerts(items);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleTap = async (item: AlertItem) => {
    // Mark the corresponding notifications DB row as read (if linked)
    if (item.notificationDbId) {
      await (supabase as any)
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', item.notificationDbId);
    }
    router.push(item.route as any);
  };

  const formatTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  };

  const renderItem = ({ item }: { item: AlertItem }) => (
    <TouchableOpacity
      style={[styles.alertCard, { backgroundColor: item.bgColor }]}
      onPress={() => handleTap(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.alertIcon, { backgroundColor: item.iconColor + '20' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.iconColor} />
      </View>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{item.title}</Text>
        <Text style={styles.alertBody} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.alertTime}>{formatTimeAgo(item.timestamp)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#999" />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.rsa.green} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      {alerts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>All caught up!</Text>
          <Text style={styles.emptyBody}>No notifications right now.</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.rsa.green} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    gap: 10,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  alertIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  alertBody: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 11,
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  emptyBody: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});
