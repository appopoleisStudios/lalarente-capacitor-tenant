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
  kind: 'viewing' | 'maintenance' | 'payment' | 'lease' | 'message' | 'application' | 'termination' | 'dispute';
  title: string;
  body: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  route: string;
  timestamp: string;
};

export default function OwnerNotificationsScreen() {
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
    await loadAlerts();
    // Mark all DB notifications as read so bell count drops on dashboard return
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

      // 1. Pending viewing requests
      const { data: pendingViewings } = await supabase
        .from('viewing_requests')
        .select('id, requested_date, requested_time, created_at, tenant:profiles!tenant_id(full_name), property:properties!property_id(title)')
        .eq('owner_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      (pendingViewings ?? []).forEach(v => {
        items.push({
          id: `viewing-${v.id}`,
          kind: 'viewing',
          title: 'New Viewing Request',
          body: `${(v.tenant as any)?.full_name || 'A tenant'} wants to view ${(v.property as any)?.title || 'your property'} on ${v.requested_date}`,
          icon: 'eye',
          iconColor: '#2196F3',
          bgColor: '#E3F2FD',
          route: `/(owner)/viewings/${v.id}`,
          timestamp: v.created_at!,
        });
      });

      // 2. Pending applications
      const { data: pendingApps } = await supabase
        .from('rental_applications')
        .select('id, created_at, tenant:profiles!tenant_id(full_name), property:properties!property_id(title)')
        .eq('owner_id', user.id)
        .in('status', ['submitted', 'under_review'])
        .order('created_at', { ascending: false });

      (pendingApps ?? []).forEach(a => {
        items.push({
          id: `app-${a.id}`,
          kind: 'application',
          title: 'Application Received',
          body: `${(a.tenant as any)?.full_name || 'Applicant'} applied for ${(a.property as any)?.title || 'your property'}`,
          icon: 'document-text',
          iconColor: '#9C27B0',
          bgColor: '#F3E5F5',
          route: `/(owner)/applications/${a.id}`,
          timestamp: a.created_at!,
        });
      });

      // 3. Active maintenance requests
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select('id, title, status, priority, created_at, property:properties!property_id(title)')
        .eq('owner_id', user.id)
        .in('status', ['open', 'assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(10);

      (maintenance ?? []).forEach(m => {
        const isUrgent = m.priority === 'urgent' || m.priority === 'emergency';
        items.push({
          id: `maint-${m.id}`,
          kind: 'maintenance',
          title: isUrgent ? 'Urgent Maintenance' : 'Maintenance Request',
          body: `${m.title || 'Maintenance'} — ${(m.property as any)?.title || 'Property'} (${(m.status || 'open').replace(/_/g, ' ')})`,
          icon: 'construct',
          iconColor: isUrgent ? '#F44336' : colors.warning[500],
          bgColor: isUrgent ? '#FFEBEE' : colors.warning[50],
          route: `/(owner)/maintenance/${m.id}`,
          timestamp: m.created_at!,
        });
      });

      // 4. Pending early termination requests
      const { data: terminations } = await supabase
        .from('leases')
        .select('id, created_at, tenant:profiles!tenant_id(full_name), property:properties!property_id(title)')
        .eq('owner_id', user.id)
        .eq('status', 'termination_requested')
        .order('created_at', { ascending: false });

      (terminations ?? []).forEach(t => {
        items.push({
          id: `term-${t.id}`,
          kind: 'termination',
          title: 'Early Termination Request',
          body: `${(t.tenant as any)?.full_name || 'Tenant'} requested early termination for ${(t.property as any)?.title || 'your property'}`,
          icon: 'warning',
          iconColor: '#F44336',
          bgColor: '#FFEBEE',
          route: '/(owner)/early-termination',
          timestamp: t.created_at!,
        });
      });

      // 5. Open payment disputes
      const { data: disputes } = await supabase
        .from('payment_disputes')
        .select('id, reason, created_at, payment:payments!payment_id(amount)')
        .in('status', ['open', 'under_review'])
        .order('created_at', { ascending: false })
        .limit(5);

      // Filter to only this owner's disputes via lease join
      (disputes ?? []).forEach(d => {
        items.push({
          id: `dispute-${d.id}`,
          kind: 'dispute',
          title: 'Payment Dispute',
          body: `${d.reason || 'A payment has been disputed'} — R${(d.payment as any)?.amount || 0}`,
          icon: 'alert-circle',
          iconColor: '#FF9800',
          bgColor: '#FFF3E0',
          route: '/(owner)/payment-disputes',
          timestamp: d.created_at!,
        });
      });

      // 6. Payments awaiting confirmation
      const { data: pendingPayments } = await supabase
        .from('payments')
        .select('id, amount, due_date, created_at, tenant:profiles!tenant_id(full_name)')
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(5);

      (pendingPayments ?? []).forEach(p => {
        items.push({
          id: `pmt-${p.id}`,
          kind: 'payment',
          title: 'Payment Awaiting Confirmation',
          body: `R ${(p.amount || 0).toLocaleString()} from ${(p.tenant as any)?.full_name || 'tenant'}`,
          icon: 'card',
          iconColor: colors.info[500],
          bgColor: colors.info[50],
          route: '/(owner)/rent-roll',
          timestamp: p.created_at!,
        });
      });

      // 7. Unread DB notifications (catch-all for system notifications)
      const { data: dbNotifs } = await (supabase as any)
        .from('notifications')
        .select('id, type, title, body, data, created_at')
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      (dbNotifs ?? []).forEach((n: any) => {
        // Avoid duplicates: skip if we already have a matching item
        const isDuplicate = items.some(item => {
          if (n.type === 'viewing_requested' && n.data?.viewingId) return items.some(i => i.id === `viewing-${n.data.viewingId}`);
          if (n.type === 'maintenance_created' && n.data?.requestId) return items.some(i => i.id === `maint-${n.data.requestId}`);
          if (n.type === 'application_received' && n.data?.applicationId) return items.some(i => i.id === `app-${n.data.applicationId}`);
          return false;
        });
        if (!isDuplicate) {
          items.push({
            id: `notif-${n.id}`,
            kind: 'message',
            title: n.title || 'Notification',
            body: n.body || '',
            icon: 'notifications',
            iconColor: colors.info[500],
            bgColor: colors.info[50],
            route: '/(owner)/messages',
            timestamp: n.created_at,
          });
        }
      });

      // Sort all by timestamp descending
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAlerts(items);
    } catch (err) {
      console.error('Error loading owner notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const handleTap = (item: AlertItem) => {
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
          <ActivityIndicator size="large" color={colors.rsa.blue} />
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
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.rsa.blue} />
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
