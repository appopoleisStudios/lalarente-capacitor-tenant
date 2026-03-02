import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { paymentsApi, PaymentWithRelations, PaymentStats } from '../../properties/api/paymentsApi';
import { propertiesApi } from '../../properties/api/propertiesApi';
import { notificationsApi } from '../../notifications/api/notificationsApi';

interface PropertyPaymentSummary {
  property_id: string;
  property_title: string;
  property_address: string;
  tenant_id: string | null;
  tenant_name: string | null;
  monthly_rent: number;
  next_payment_due: string | null;
  payment_status: 'paid' | 'pending' | 'overdue' | 'processing' | 'no_lease';
  overdue_amount: number;
  last_payment_date: string | null;
  processing_payments: Array<{ id: string; amount: number; transaction_id: string | null }>;
}

export default function OwnerRentRollScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [propertySummaries, setPropertySummaries] = useState<PropertyPaymentSummary[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'paid' | 'pending' | 'overdue' | 'processing'>('all');
  const [confirmingPropertyId, setConfirmingPropertyId] = useState<string | null>(null);

  useEffect(() => {
    loadRentRollData();
  }, []);

  const loadRentRollData = async () => {
    try {
      setError(null);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch payment stats
      const statsData = await paymentsApi.getPaymentStats(user.id);
      setStats(statsData);

      // Fetch all owner properties
      const properties = await propertiesApi.getOwnerProperties(user.id);

      // Fetch all owner payments
      const payments = await paymentsApi.getOwnerPayments(user.id);

      // Build property summaries
      const summaries: PropertyPaymentSummary[] = properties.map(property => {
        // Get payments for this property
        const propertyPayments = payments.filter(p => p.property_id === property.id);
        
        // Find next payment due
        const today = new Date();
        const upcomingPayments = propertyPayments
          .filter(p => p.status === 'pending' && new Date(p.due_date) >= today)
          .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

        // Find overdue payments
        const overduePayments = propertyPayments
          .filter(p => p.status === 'pending' && new Date(p.due_date) < today);

        // Find payments awaiting owner confirmation (tenant submitted EFT)
        const processingPayments = propertyPayments
          .filter(p => p.status === 'processing')
          .map(p => ({ id: p.id, amount: p.amount, transaction_id: (p as any).transaction_id }));

        // Find last paid payment
        const paidPayments = propertyPayments
          .filter(p => p.status === 'completed' && p.paid_date)
          .sort((a, b) => new Date(b.paid_date!).getTime() - new Date(a.paid_date!).getTime());

        const nextPayment = upcomingPayments[0];
        const overdueAmount = overduePayments.reduce((sum, p) => sum + p.amount, 0);
        const lastPayment = paidPayments[0];

        let paymentStatus: 'paid' | 'pending' | 'overdue' | 'processing' | 'no_lease' = 'no_lease';

        if (property.status === 'rented') {
          if (processingPayments.length > 0) {
            paymentStatus = 'processing';
          } else if (overduePayments.length > 0) {
            paymentStatus = 'overdue';
          } else if (nextPayment) {
            const daysUntilDue = Math.ceil((new Date(nextPayment.due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            paymentStatus = daysUntilDue <= 5 ? 'pending' : 'paid';
          } else {
            paymentStatus = 'paid';
          }
        }

        return {
          property_id: property.id,
          property_title: property.title,
          property_address: property.address,
          tenant_id: (nextPayment as any)?.tenant_id || (lastPayment as any)?.tenant_id || null,
          tenant_name: nextPayment?.tenant?.full_name || lastPayment?.tenant?.full_name || null,
          monthly_rent: property.rent_amount || 0,
          next_payment_due: nextPayment?.due_date || null,
          payment_status: paymentStatus,
          overdue_amount: overdueAmount,
          last_payment_date: lastPayment?.paid_date || null,
          processing_payments: processingPayments,
        };
      });

      setPropertySummaries(summaries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rent roll data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadRentRollData();
  };

  const confirmPayments = (item: PropertyPaymentSummary) => {
    if (item.processing_payments.length === 0) return;
    const total = item.processing_payments.reduce((s, p) => s + p.amount, 0);
    const refs = item.processing_payments
      .map(p => p.transaction_id)
      .filter(Boolean)
      .join(', ');
    const refText = refs ? `\nTenant reference: ${refs}` : '';
    Alert.alert(
      'Confirm Payment Receipt',
      `${item.tenant_name || 'Tenant'} has confirmed payment of R ${total.toLocaleString()}.${refText}\n\nConfirm that you have received this payment?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Received',
          onPress: async () => {
            setConfirmingPropertyId(item.property_id);
            try {
              const ids = item.processing_payments.map(p => p.id);
              const { error } = await supabase
                .from('payments')
                .update({ status: 'completed', paid_date: new Date().toISOString() })
                .in('id', ids);
              if (error) throw error;
              Alert.alert('Confirmed', 'Payment marked as received.');
              loadRentRollData();
            } catch (err) {
              Alert.alert('Error', 'Failed to confirm payment.');
            } finally {
              setConfirmingPropertyId(null);
            }
          },
        },
      ]
    );
  };

  const sendPaymentReminder = (item: PropertyPaymentSummary) => {
    if (!item.tenant_id || !item.tenant_name) return;
    Alert.alert(
      'Send Reminder',
      `Send payment reminder to ${item.tenant_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              await notificationsApi.sendNotification({
                user_id: item.tenant_id!,
                type: 'payment_reminder' as any,
                data: { property_id: item.property_id },
              });
              Alert.alert('Success', 'Payment reminder sent');
            } catch {
              Alert.alert('Error', 'Failed to send reminder');
            }
          },
        },
      ]
    );
  };

  const getFilteredSummaries = () => {
    if (selectedFilter === 'all') return propertySummaries;
    return propertySummaries.filter(s => s.payment_status === selectedFilter);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return '#4CAF50';
      case 'processing': return '#7C3AED';
      case 'pending': return '#FFA500';
      case 'overdue': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return 'checkmark-circle';
      case 'processing': return 'hourglass-outline';
      case 'pending': return 'time';
      case 'overdue': return 'alert-circle';
      default: return 'remove-circle-outline';
    }
  };

  const renderSummaryCard = ({ item }: { item: PropertyPaymentSummary }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(owner)/properties/${item.property_id}` as any)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyTitle} numberOfLines={1}>
            {item.property_title}
          </Text>
          <Text style={styles.propertyAddress} numberOfLines={1}>
            {item.property_address}
          </Text>
          {item.tenant_name && (
            <Text style={styles.tenantName}>👤 {item.tenant_name}</Text>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.payment_status) }]}>
          <Ionicons name={getStatusIcon(item.payment_status)} size={16} color="#FFF" />
          <Text style={styles.statusText}>{item.payment_status}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.rentRow}>
          <Text style={styles.rentLabel}>Monthly Rent</Text>
          <Text style={styles.rentAmount}>R {item.monthly_rent.toLocaleString()}</Text>
        </View>

        {item.payment_status === 'overdue' && item.overdue_amount > 0 && (
          <View style={styles.overdueRow}>
            <Ionicons name="warning" size={18} color="#F44336" />
            <Text style={styles.overdueText}>
              Overdue: R {item.overdue_amount.toLocaleString()}
            </Text>
          </View>
        )}

        {item.next_payment_due && (
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.infoText}>
              Next due: {new Date(item.next_payment_due).toLocaleDateString()}
            </Text>
          </View>
        )}

        {item.last_payment_date && (
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#666" />
            <Text style={styles.infoText}>
              Last paid: {new Date(item.last_payment_date).toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      {item.payment_status === 'processing' && (
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={(e) => { e.stopPropagation(); confirmPayments(item); }}
          disabled={confirmingPropertyId === item.property_id}
        >
          {confirmingPropertyId === item.property_id ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={18} color="#FFF" />
              <Text style={styles.confirmButtonText}>
                Confirm Receipt ({item.processing_payments.length})
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
      {(item.payment_status === 'pending' || item.payment_status === 'overdue') && item.tenant_name && (
        <TouchableOpacity
          style={styles.reminderButton}
          onPress={(e) => {
            e.stopPropagation();
            sendPaymentReminder(item);
          }}
        >
          <Ionicons name="notifications-outline" size={18} color="#007AFF" />
          <Text style={styles.reminderButtonText}>Send Reminder</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading rent roll...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadRentRollData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const filteredSummaries = getFilteredSummaries();
  const totalMonthlyIncome = propertySummaries
    .filter(s => s.payment_status !== 'no_lease')
    .reduce((sum, s) => sum + s.monthly_rent, 0);
  const occupancyRate = propertySummaries.length > 0
    ? (propertySummaries.filter(s => s.payment_status !== 'no_lease').length / propertySummaries.length) * 100
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rent Roll</Text>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Ionicons name="cash-outline" size={32} color="#4CAF50" />
          <Text style={styles.summaryValue}>R {totalMonthlyIncome.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Monthly Income</Text>
        </View>
        <View style={styles.summaryCard}>
          <Ionicons name="home-outline" size={32} color="#007AFF" />
          <Text style={styles.summaryValue}>{occupancyRate.toFixed(0)}%</Text>
          <Text style={styles.summaryLabel}>Occupancy</Text>
        </View>
        {stats && (
          <View style={styles.summaryCard}>
            <Ionicons name="alert-circle-outline" size={32} color="#F44336" />
            <Text style={styles.summaryValue}>{stats.overdue_count}</Text>
            <Text style={styles.summaryLabel}>Overdue</Text>
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        {(['all', 'paid', 'processing', 'pending', 'overdue'] as const).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterButton, selectedFilter === filter && styles.filterButtonActive]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text
              style={[
                styles.filterButtonText,
                selectedFilter === filter && styles.filterButtonTextActive,
              ]}
            >
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Property List */}
      {filteredSummaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No properties found</Text>
          <Text style={styles.emptySubtext}>
            {selectedFilter !== 'all'
              ? 'Try adjusting your filter'
              : 'Add properties to start tracking rent'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSummaries}
          renderItem={renderSummaryCard}
          keyExtractor={item => item.property_id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summarySection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    textTransform: 'capitalize',
  },
  filterButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  propertyInfo: {
    flex: 1,
    marginRight: 12,
  },
  propertyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  tenantName: {
    fontSize: 14,
    color: '#007AFF',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  cardBody: {
    gap: 8,
  },
  rentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rentLabel: {
    fontSize: 14,
    color: '#666',
  },
  rentAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
  },
  overdueText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F44336',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    gap: 8,
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  reminderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 8,
  },
  reminderButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
