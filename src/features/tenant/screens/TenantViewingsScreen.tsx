import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { viewingsApi, ViewingWithRelations } from '../../properties/api/viewingsApi';
import { supabase } from '../../../lib/supabase';

const RSA = { green: '#007A4D', gold: '#FFB81C' };

type ViewingStatus = 'all' | 'pending' | 'approved' | 'declined' | 'completed' | 'cancelled';

const STATUS_FILTERS: { value: ViewingStatus; label: string; icon: string }[] = [
  { value: 'all', label: 'All', icon: 'list' },
  { value: 'pending', label: 'Pending', icon: 'time' },
  { value: 'approved', label: 'Approved', icon: 'checkmark-circle' },
  { value: 'completed', label: 'Completed', icon: 'checkmark-done' },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return '#FF9800';
    case 'approved':
      return '#4CAF50';
    case 'declined':
      return '#F44336';
    case 'completed':
      return '#2196F3';
    case 'cancelled':
      return '#999';
    default:
      return '#999';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return 'time-outline';
    case 'approved':
      return 'checkmark-circle';
    case 'declined':
      return 'close-circle';
    case 'completed':
      return 'checkmark-done-circle';
    case 'cancelled':
      return 'ban';
    default:
      return 'help-circle';
  }
};

export default function TenantViewingsScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);
  const [viewings, setViewings] = useState<ViewingWithRelations[]>([]);
  const [filteredViewings, setFilteredViewings] = useState<ViewingWithRelations[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<ViewingStatus>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadViewings();
      }
    }, [userId])
  );

  useEffect(() => {
    filterViewings();
  }, [viewings, selectedStatus]);

  // Real-time subscription for viewing requests
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('tenant-viewings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'viewing_requests',
          filter: `tenant_id=eq.${userId}`,
        },
        (payload) => {
          console.log('Viewing request change:', payload);
          // Reload viewings when any change occurs
          loadViewings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadViewings = async () => {
    if (!userId) return;

    try {
      const data = await viewingsApi.getTenantViewings(userId);
      setViewings(data);
    } catch (error) {
      console.error('Error loading viewings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterViewings = () => {
    if (selectedStatus === 'all') {
      setFilteredViewings(viewings);
    } else {
      setFilteredViewings(viewings.filter(v => v.status === selectedStatus));
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadViewings();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const isUpcoming = (viewing: ViewingWithRelations) => {
    if (viewing.status !== 'approved') return false;
    const viewingDate = new Date(viewing.confirmed_date || viewing.requested_date);
    return viewingDate >= new Date();
  };

  const renderViewingCard = ({ item }: { item: ViewingWithRelations }) => {
    const upcoming = isUpcoming(item);
    const statusColor = getStatusColor(item.status);
    const statusIcon = getStatusIcon(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, upcoming && styles.upcomingCard]}
        onPress={() =>
          router.push({
            pathname: '/(tenant)/viewings/[id]',
            params: { id: item.id },
          })
        }
      >
        {upcoming && (
          <View style={styles.upcomingBadge}>
            <Ionicons name="alarm" size={14} color="#FFF" />
            <Text style={styles.upcomingText}>Upcoming</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.propertyInfo}>
            <Ionicons name="home" size={20} color={RSA.green} />
            <Text style={styles.propertyTitle} numberOfLines={1}>
              {item.property?.title || 'Property'}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
            <Ionicons name={statusIcon as any} size={16} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.detailText} numberOfLines={1}>
              {item.property?.address}, {item.property?.city}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.detailText}>
              {item.status === 'approved' && item.confirmed_date
                ? `Confirmed: ${formatDate(item.confirmed_date)} at ${item.requested_time}`
                : `Requested: ${formatDate(item.requested_date)} at ${item.requested_time}`}
            </Text>
          </View>

          {item.owner && (
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.owner.full_name}</Text>
            </View>
          )}

          {item.owner_response && (
            <View style={styles.responseBox}>
              <Text style={styles.responseLabel}>Owner Response:</Text>
              <Text style={styles.responseText} numberOfLines={2}>
                {item.owner_response}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            Requested {new Date(item.created_at!).toLocaleDateString('en-ZA')}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>No Viewing Requests</Text>
      <Text style={styles.emptyText}>
        {selectedStatus === 'all'
          ? 'You haven\'t requested any property viewings yet'
          : `No ${selectedStatus} viewing requests`}
      </Text>
      {selectedStatus === 'all' && (
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => router.push('/(tenant)/search')}
        >
          <Text style={styles.browseButtonText}>Browse Properties</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Viewings</Text>
            <View style={styles.placeholder} />
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={RSA.green} />
          </View>
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
          <Text style={styles.headerTitle}>My Viewings</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Status Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
            {STATUS_FILTERS.map((filter) => (
              <TouchableOpacity
                key={filter.value}
                style={[
                  styles.filterChip,
                  selectedStatus === filter.value && styles.filterChipActive,
                ]}
                onPress={() => setSelectedStatus(filter.value)}
              >
                <Ionicons
                  name={filter.icon as any}
                  size={16}
                  color={selectedStatus === filter.value ? '#FFF' : '#666'}
                />
                <Text
                  style={[
                    styles.filterText,
                    selectedStatus === filter.value && styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats */}
        {viewings.length > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{viewings.length}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>
                {viewings.filter(v => v.status === 'pending').length}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {viewings.filter(v => isUpcoming(v)).length}
              </Text>
              <Text style={styles.statLabel}>Upcoming</Text>
            </View>
          </View>
        )}

        {/* Viewings List */}
        <FlatList
          data={filteredViewings}
          renderItem={renderViewingCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={RSA.green}
            />
          }
        />
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
  filtersContainer: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filters: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: RSA.green,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTextActive: {
    color: '#FFF',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: RSA.green,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  upcomingCard: {
    borderColor: RSA.green,
    borderWidth: 2,
  },
  upcomingBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: RSA.green,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  upcomingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  propertyInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 12,
  },
  propertyTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  responseBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 13,
    color: '#333',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  browseButton: {
    backgroundColor: RSA.green,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
