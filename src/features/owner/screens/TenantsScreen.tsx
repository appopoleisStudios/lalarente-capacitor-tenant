import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

const RSA = { blue: '#002395', gold: '#FFB81C' }; // Owner colors

interface Lease {
  id: string;
  property_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  payment_due_day: number | null;
  status: string | null;
  property?: {
    title: string;
    address: string;
  };
  tenant?: {
    full_name: string;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    verification_status: boolean | null;
  };
  next_payment?: {
    due_date: string;
    status: string;
    amount: number;
  } | null;
}

export default function TenantsScreen() {
  const router = useRouter();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'expired'>('active');

  useEffect(() => {
    loadLeases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadLeases = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('leases')
        .select(`
          *,
          property:properties!property_id(title, address),
          tenant:profiles!tenant_id(full_name, email, phone, avatar_url, verification_status)
        `)
        .eq('owner_id', user.id)
        .order('start_date', { ascending: false });

      if (filter === 'active') {
        query = query.eq('status', 'active');
      } else if (filter === 'expired') {
        query = query.eq('status', 'expired');
      }

      const { data, error } = await query;

      if (error) throw error;

      // For each lease, get the next payment
      const leasesWithPayments = await Promise.all(
        (data || []).map(async (lease) => {
          const { data: nextPayment } = await supabase
            .from('payments')
            .select('due_date, status, amount')
            .eq('lease_id', lease.id)
            .eq('status', 'pending')
            .order('due_date', { ascending: true })
            .limit(1)
            .single();

          return {
            ...lease,
            next_payment: nextPayment || null,
          };
        })
      );

      setLeases(leasesWithPayments as Lease[]);
    } catch (error) {
      console.error('Error loading leases:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeases();
  };

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate);
    const today = new Date();
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getPaymentStatus = (nextPayment: Lease['next_payment']) => {
    if (!nextPayment) return null;
    
    const dueDate = new Date(nextPayment.due_date);
    const today = new Date();
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `${Math.abs(diffDays)}d overdue`, color: '#F44336', icon: 'alert-circle' };
    } else if (diffDays === 0) {
      return { text: 'Due today', color: '#FF9800', icon: 'time' };
    } else if (diffDays <= 7) {
      return { text: `Due in ${diffDays}d`, color: '#FF9800', icon: 'time' };
    }
    return { text: `Due ${dueDate.toLocaleDateString()}`, color: '#666', icon: 'calendar' };
  };

  const handleContactTenant = (e: any, tenant: Lease['tenant']) => {
    e.stopPropagation();
    if (!tenant) return;

    Alert.alert(
      'Contact Tenant',
      `${tenant.full_name}\n${tenant.phone || ''}\n${tenant.email || ''}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => tenant.phone && Linking.openURL(`tel:${tenant.phone}`) },
        { text: 'Message', onPress: () => router.push('/(owner)/messages' as any) },
      ]
    );
  };

  const renderLeaseCard = ({ item }: { item: Lease }) => {
    const daysRemaining = getDaysRemaining(item.end_date);
    const isExpiringSoon = daysRemaining <= 60 && daysRemaining > 0;
    const isExpired = daysRemaining <= 0;
    const paymentStatus = getPaymentStatus(item.next_payment);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(owner)/leases/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.tenantInfo}>
            {item.tenant?.avatar_url ? (
              <Image
                source={{ uri: item.tenant.avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.tenant?.full_name?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.tenantDetails}>
              <View style={styles.tenantNameRow}>
                <Text style={styles.tenantName}>{item.tenant?.full_name}</Text>
                {item.tenant?.verification_status && (
                  <Ionicons name="checkmark-circle" size={16} color={RSA.blue} />
                )}
              </View>
              <Text style={styles.propertyTitle}>{item.property?.title}</Text>
              <Text style={styles.propertyAddress}>{item.property?.address}</Text>
            </View>
          </View>
          <View style={styles.statusBadge}>
            {isExpired ? (
              <View style={[styles.badge, styles.badgeExpired]}>
                <Text style={styles.badgeTextExpired}>Expired</Text>
              </View>
            ) : isExpiringSoon ? (
              <View style={[styles.badge, styles.badgeWarning]}>
                <Text style={styles.badgeTextWarning}>Expiring Soon</Text>
              </View>
            ) : (
              <View style={[styles.badge, styles.badgeActive]}>
                <Text style={styles.badgeTextActive}>Active</Text>
              </View>
            )}
          </View>
        </View>

        {/* Payment Status Banner */}
        {paymentStatus && (
          <View style={[styles.paymentBanner, { backgroundColor: `${paymentStatus.color}15` }]}>
            <Ionicons name={paymentStatus.icon as any} size={16} color={paymentStatus.color} />
            <Text style={[styles.paymentBannerText, { color: paymentStatus.color }]}>
              Next payment: {paymentStatus.text} • R {item.next_payment?.amount.toLocaleString()}
            </Text>
          </View>
        )}

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="cash-outline" size={16} color="#666" />
              <Text style={styles.infoLabel}>Monthly Rent</Text>
              <Text style={styles.infoValue}>R {item.monthly_rent.toLocaleString()}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.infoLabel}>
                {isExpired ? 'Expired' : 'Lease Ends'}
              </Text>
              <Text style={[styles.infoValue, isExpiringSoon && styles.infoValueWarning]}>
                {isExpired ? new Date(item.end_date).toLocaleDateString() : `${daysRemaining} days`}
              </Text>
            </View>
          </View>

          <View style={styles.dateRange}>
            <Text style={styles.dateText}>
              {new Date(item.start_date).toLocaleDateString()} → {new Date(item.end_date).toLocaleDateString()}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => handleContactTenant(e, item.tenant)}
          >
            <Ionicons name="chatbubble-outline" size={16} color={RSA.blue} />
            <Text style={styles.actionButtonText}>Contact</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/(owner)/leases/${item.id}`);
            }}
          >
            <Ionicons name="document-text-outline" size={16} color={RSA.blue} />
            <Text style={styles.actionButtonText}>View Lease</Text>
          </TouchableOpacity>
          
          <Ionicons name="chevron-forward" size={20} color="#CCC" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tenants & Leases</Text>
        </View>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Tenants & Leases</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
        >
          <Text style={[styles.filterText, filter === 'active' && styles.filterTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'expired' && styles.filterTabActive]}
          onPress={() => setFilter('expired')}
        >
          <Text style={[styles.filterText, filter === 'expired' && styles.filterTextActive]}>
            Expired
          </Text>
        </TouchableOpacity>
      </View>

      {leases.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>No Tenants Yet</Text>
          <Text style={styles.emptyText}>
            {filter === 'active'
              ? 'You don\'t have any active leases yet.'
              : filter === 'expired'
              ? 'No expired leases found.'
              : 'Start by approving rental applications.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={leases}
          renderItem={renderLeaseCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[RSA.blue]} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterTabActive: {
    backgroundColor: RSA.blue,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tenantInfo: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: RSA.blue,
  },
  tenantDetails: {
    flex: 1,
  },
  tenantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  propertyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  propertyAddress: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    marginLeft: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeActive: {
    backgroundColor: '#E8F5E9',
  },
  badgeTextActive: {
    fontSize: 12,
    fontWeight: '600',
    color: RSA.blue,
  },
  badgeWarning: {
    backgroundColor: '#FFF3E0',
  },
  badgeTextWarning: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9800',
  },
  badgeExpired: {
    backgroundColor: '#FFEBEE',
  },
  badgeTextExpired: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F44336',
  },
  paymentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginTop: 12,
    borderRadius: 8,
  },
  paymentBannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  cardBody: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    marginBottom: 12,
    marginTop: 12,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  infoItem: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoValueWarning: {
    color: '#FF9800',
  },
  dateRange: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 12,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: RSA.blue,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
