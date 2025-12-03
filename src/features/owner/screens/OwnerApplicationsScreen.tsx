import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { applicationsApi, ApplicationWithRelations } from '../../properties/api/applicationsApi';
import type { Database } from '../../../types/database.types';

type ApplicationStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'withdrawn';

export default function OwnerApplicationsScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId?: string }>();
  const [applications, setApplications] = useState<ApplicationWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    // Auto-filter by property if propertyId is provided in route params
    if (propertyId) {
      setSelectedProperty(propertyId);
    }
  }, [propertyId]);

  const loadApplications = async () => {
    try {
      setError(null);
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const data = await applicationsApi.getOwnerApplications(user.id);
      setApplications(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadApplications();
  };

  const getFilteredApplications = () => {
    let filtered = applications;

    if (selectedProperty) {
      filtered = filtered.filter(app => app.property_id === selectedProperty);
    }

    if (selectedStatus) {
      filtered = filtered.filter(app => app.status === selectedStatus);
    }

    return filtered;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return '#9E9E9E';
      case 'submitted':
      case 'under_review':
        return '#FFA500';
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      case 'withdrawn':
        return '#757575';
      default:
        return '#757575';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return 'document-outline';
      case 'submitted':
      case 'under_review':
        return 'time-outline';
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      case 'withdrawn':
        return 'remove-circle-outline';
      default:
        return 'help-circle-outline';
    }
  };

  const renderApplicationCard = ({ item }: { item: ApplicationWithRelations }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(owner)/applications/${item.id}` as any)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.propertyInfo}>
          <Text style={styles.propertyTitle} numberOfLines={1}>
            {item.property?.title || 'Property'}
          </Text>
          <Text style={styles.propertyAddress} numberOfLines={1}>
            {item.property?.address || ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons name={getStatusIcon(item.status)} size={16} color="#FFF" />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={18} color="#666" />
          <Text style={styles.infoText}>{item.tenant?.full_name || 'Unknown'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color="#666" />
          <Text style={styles.infoText}>{item.tenant?.email || ''}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color="#666" />
          <Text style={styles.infoText}>
            Applied: {new Date(item.created_at!).toLocaleDateString()}
          </Text>
        </View>
        {item.affordability_ratio && (
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={18} color="#666" />
            <Text style={styles.infoText}>
              Affordability: {(item.affordability_ratio * 100).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Ionicons name="chevron-forward" size={20} color="#007AFF" />
      </View>
    </TouchableOpacity>
  );

  const renderFilters = () => {
    const statuses = ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'withdrawn'];
    const uniqueProperties = Array.from(
      new Set(applications.map(app => app.property_id))
    ).map(id => applications.find(app => app.property_id === id)?.property);

    return (
      <View style={styles.filtersContainer}>
        <Text style={styles.filterLabel}>Filter by Status:</Text>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[styles.filterButton, !selectedStatus && styles.filterButtonActive]}
            onPress={() => setSelectedStatus(null)}
          >
            <Text style={[styles.filterButtonText, !selectedStatus && styles.filterButtonTextActive]}>
              All
            </Text>
          </TouchableOpacity>
          {statuses.map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, selectedStatus === status && styles.filterButtonActive]}
              onPress={() => setSelectedStatus(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedStatus === status && styles.filterButtonTextActive,
                ]}
              >
                {status}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {uniqueProperties.length > 1 && (
          <>
            <Text style={styles.filterLabel}>Filter by Property:</Text>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[styles.filterButton, !selectedProperty && styles.filterButtonActive]}
                onPress={() => setSelectedProperty(null)}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    !selectedProperty && styles.filterButtonTextActive,
                  ]}
                >
                  All Properties
                </Text>
              </TouchableOpacity>
              {uniqueProperties.map(
                property =>
                  property && (
                    <TouchableOpacity
                      key={property.id}
                      style={[
                        styles.filterButton,
                        selectedProperty === property.id && styles.filterButtonActive,
                      ]}
                      onPress={() => setSelectedProperty(property.id)}
                    >
                      <Text
                        style={[
                          styles.filterButtonText,
                          selectedProperty === property.id && styles.filterButtonTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {property.title}
                      </Text>
                    </TouchableOpacity>
                  )
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading applications...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadApplications}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const filteredApplications = getFilteredApplications();

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
          <Text style={styles.headerTitle}>Applications</Text>
        </View>
      </View>

      {renderFilters()}
      
      {filteredApplications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No applications found</Text>
          <Text style={styles.emptySubtext}>
            {selectedProperty || selectedStatus
              ? 'Try adjusting your filters'
              : 'Applications will appear here when tenants apply'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredApplications}
          renderItem={renderApplicationCard}
          keyExtractor={item => item.id}
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
  filtersContainer: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    alignItems: 'flex-end',
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
