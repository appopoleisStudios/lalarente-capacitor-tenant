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
  kind: 'quote_request' | 'po_received' | 'job_assigned' | 'closure_status' | 'payment' | 'message';
  title: string;
  body: string;
  icon: string;
  iconColor: string;
  bgColor: string;
  route: string;
  timestamp: string;
};

export default function VendorNotificationsScreen() {
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

      // 1. Pending quote requests — maintenance requests pushed to this vendor
      const { data: quoteRequests } = await supabase
        .from('maintenance_requests')
        .select('id, title, description, created_at, property:properties!property_id(title), owner:profiles!owner_id(full_name)')
        .eq('vendor_id', user.id)
        .in('status', ['open', 'assigned'])
        .is('selected_quote_id', null)
        .order('created_at', { ascending: false });

      (quoteRequests ?? []).forEach((r: any) => {
        items.push({
          id: `quote-${r.id}`,
          kind: 'quote_request',
          title: 'New Quote Request',
          body: `${r.owner?.full_name || 'An owner'} needs a quote for "${r.title || 'Maintenance'}" at ${r.property?.title || 'a property'}`,
          icon: 'pricetag',
          iconColor: '#FF9800',
          bgColor: '#FFF3E0',
          route: `/(vendor)/maintenance/${r.id}`,
          timestamp: r.created_at!,
        });
      });

      // 2. PO received — maintenance requests with assigned PO for this vendor
      const { data: requestsWithPO } = await supabase
        .from('maintenance_requests')
        .select('id, title, po_id, created_at, property:properties!property_id(title)')
        .eq('vendor_id', user.id)
        .not('po_id', 'is', null)
        .order('created_at', { ascending: false });

      (requestsWithPO ?? []).forEach((req: any) => {
        items.push({
          id: `po-${req.id}`,
          kind: 'po_received',
          title: 'Purchase Order Issued',
          body: `PO issued for "${req.title || 'Maintenance'}" at ${req.property?.title || 'property'}`,
          icon: 'document-text',
          iconColor: '#2196F3',
          bgColor: '#E3F2FD',
          route: `/(vendor)/jobs/${req.id}`,
          timestamp: req.created_at!,
        });
      });

      // 3. Active jobs assigned to vendor (exclude completed with actual_cost to avoid dupes)
      const { data: activeJobs } = await supabase
        .from('maintenance_requests')
        .select('id, title, status, scheduled_date, created_at, closure_requested_at, closure_approved_at, actual_cost, property:properties!property_id(title)')
        .eq('vendor_id', user.id)
        .in('status', ['in_progress', 'completed'])
        .order('created_at', { ascending: false });

      (activeJobs ?? []).forEach((j: any) => {
        // Don't show completed-with-cost here — those appear in completed jobs section
        if (j.status === 'completed' && j.actual_cost != null) return;
        const isPendingClosure = j.status === 'completed' && j.closure_requested_at && !j.closure_approved_at;
        if (j.status === 'completed' && !isPendingClosure) return; // already handled
        items.push({
          id: `job-${j.id}`,
          kind: 'job_assigned',
          title: j.status === 'in_progress' ? 'Job In Progress' : isPendingClosure ? 'Closure Pending' : 'Job Update',
          body: `"${j.title || 'Maintenance'}" at ${j.property?.title || 'property'}${j.scheduled_date ? ` — ${j.scheduled_date}` : ''}`,
          icon: 'construct',
          iconColor: '#4CAF50',
          bgColor: '#E8F5E9',
          route: `/(vendor)/jobs/${j.id}`,
          timestamp: j.created_at!,
        });
      });

      // 4. Closure approved/rejected — filter via maintenance requests for this vendor
      const { data: vendorActiveRequests } = await supabase
        .from('maintenance_requests')
        .select('id, title')
        .eq('vendor_id', user.id);

      const vendorRequestIds = vendorActiveRequests?.map(r => r.id) || [];

      if (vendorRequestIds.length > 0) {
        const { data: closureReports } = await supabase
          .from('closure_reports')
          .select('id, status, rejected_at, owner_accept_at, created_at, maintenance_request:maintenance_requests!maintenance_request_id(id, title)')
          .in('maintenance_request_id', vendorRequestIds)
          .in('status', ['owner_accepted', 'owner_rejected', 'closed'])
          .order('created_at', { ascending: false })
          .limit(10);

        (closureReports ?? []).forEach((cr: any) => {
          const isApproved = cr.status === 'owner_accepted' || cr.status === 'closed';
          items.push({
            id: `closure-${cr.id}`,
            kind: 'closure_status',
            title: isApproved ? 'Closure Approved' : 'Closure Rejected',
            body: isApproved
              ? `Closure approved for "${cr.maintenance_request?.title || 'Maintenance'}"`
              : `Closure was rejected — please check the job for details`,
            icon: isApproved ? 'checkmark-circle' : 'close-circle',
            iconColor: isApproved ? '#4CAF50' : '#F44336',
            bgColor: isApproved ? '#E8F5E9' : '#FFEBEE',
            route: `/(vendor)/jobs/${cr.maintenance_request?.id}`,
            timestamp: cr.owner_accept_at || cr.rejected_at || cr.created_at!,
          });
        });
      }

      // 5. Completed jobs (potential invoice items)
      const { data: completedJobs } = await supabase
        .from('maintenance_requests')
        .select('id, title, actual_cost, completed_date, created_at, property:properties!property_id(title)')
        .eq('vendor_id', user.id)
        .eq('status', 'completed')
        .not('actual_cost', 'is', null)
        .order('completed_date', { ascending: false })
        .limit(10);

      (completedJobs ?? []).forEach((j: any) => {
        items.push({
          id: `complete-${j.id}`,
          kind: 'payment',
          title: 'Job Completed',
          body: `"${j.title || 'Maintenance'}" at ${j.property?.title || 'property'} — Cost: R${(j.actual_cost || 0).toLocaleString()}`,
          icon: 'checkmark-circle',
          iconColor: '#4CAF50',
          bgColor: '#E8F5E9',
          route: `/(vendor)/jobs/${j.id}`,
          timestamp: j.completed_date || j.created_at!,
        });
      });

      // 6. Unread DB notifications
      const { data: dbNotifs } = await (supabase as any)
        .from('notifications')
        .select('id, type, title, body, data, created_at')
        .eq('user_id', user.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      (dbNotifs ?? []).forEach((n: any) => {
        const isDuplicate = items.some(item => {
          if (n.type === 'quote_requested' && n.data?.requestId) return items.some(i => i.id === `quote-${n.data.requestId}`);
          if (n.type === 'po_sent' && n.data?.poId) return items.some(i => i.id === `po-${n.data.poId}`);
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
            route: '/(vendor)/dashboard',
            timestamp: n.created_at,
          });
        }
      });

      // Sort all by timestamp descending
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setAlerts(items);
    } catch (err) {
      console.error('Error loading vendor notifications:', err);
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
