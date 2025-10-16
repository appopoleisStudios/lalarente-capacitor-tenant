import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@/src/shared/theme/colors';
import { vendorMaintenanceApi } from '@/src/features/maintenance/api/maintenanceApi';
import type { VendorMaintenanceRequest } from '@/src/features/maintenance/api/maintenanceApi';
import { RequestCard } from '@/src/features/vendor/components/RequestCard';
import { supabase } from '@/src/lib/supabase';

type StatusFilter = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed';

export const VendorMaintenanceListScreen: React.FC = () => {
  const router = useRouter();
  const [requests, setRequests] = useState<VendorMaintenanceRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<VendorMaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Categories for filter dropdown
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  // Get current user
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  };

  // Load categories
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  // Load requests
  const loadRequests = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setPage(1);
      } else {
        setLoading(true);
      }
      setError(null);

      const user = await getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Build filters
      const filters: any = {};

      if (statusFilter !== 'all') {
        filters.status = statusFilter;
      }

      if (categoryFilter !== 'all') {
        filters.category = categoryFilter;
      }

      const data = await vendorMaintenanceApi.getAvailableRequests(user.id, filters);

      if (isRefresh) {
        setRequests(data);
        setHasMore(data.length >= PAGE_SIZE);
      } else {
        setRequests(prev => page === 1 ? data : [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      }
    } catch (err: any) {
      console.error('Error loading requests:', err);
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Apply filters and search
  const applyFilters = useCallback(() => {
    let filtered = [...requests];

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        req =>
          req.title.toLowerCase().includes(query) ||
          req.description.toLowerCase().includes(query) ||
          req.property?.address.toLowerCase().includes(query) ||
          req.property?.city.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  }, [requests, searchQuery]);

  // Initial load
  useEffect(() => {
    loadCategories();
    loadRequests();
  }, []);

  // Reload when filters change
  useEffect(() => {
    loadRequests();
  }, [statusFilter, categoryFilter]);

  // Apply filters when requests or search changes
  useEffect(() => {
    applyFilters();
  }, [requests, searchQuery, applyFilters]);

  // Handle refresh
  const handleRefresh = () => {
    loadRequests(true);
  };

  // Handle load more
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      loadRequests();
    }
  };

  // Handle request press
  const handleRequestPress = (request: VendorMaintenanceRequest) => {
    router.push(`/(vendor)/maintenance/${request.id}` as any);
  };

  // Status filter buttons
  const statusFilters: Array<{ key: StatusFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'assigned', label: 'Assigned' },
  ];

  // Render filter button
  const renderFilterButton = (filter: { key: StatusFilter; label: string }) => {
    const isActive = statusFilter === filter.key;
    return (
      <TouchableOpacity
        key={filter.key}
        style={[styles.filterButton, isActive && styles.filterButtonActive]}
        onPress={() => setStatusFilter(filter.key)}
      >
        <Text style={[styles.filterButtonText, isActive && styles.filterButtonTextActive]}>
          {filter.label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Render category dropdown
  const renderCategoryDropdown = () => (
    <View style={styles.categoryDropdown}>
      <TouchableOpacity
        style={styles.categoryButton}
        onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
      >
        <Ionicons name="construct-outline" size={18} color={colors.text.secondary} />
        <Text style={styles.categoryButtonText}>
          {categoryFilter === 'all'
            ? 'All Categories'
            : categories.find(c => c.id === categoryFilter)?.name || 'Category'}
        </Text>
        <Ionicons
          name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.text.secondary}
        />
      </TouchableOpacity>

      {showCategoryDropdown && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setCategoryFilter('all');
              setShowCategoryDropdown(false);
            }}
          >
            <Text
              style={[
                styles.dropdownItemText,
                categoryFilter === 'all' && styles.dropdownItemTextActive,
              ]}
            >
              All Categories
            </Text>
            {categoryFilter === 'all' && (
              <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
            )}
          </TouchableOpacity>

          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={styles.dropdownItem}
              onPress={() => {
                setCategoryFilter(category.id);
                setShowCategoryDropdown(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  categoryFilter === category.id && styles.dropdownItemTextActive,
                ]}
              >
                {category.name}
              </Text>
              {categoryFilter === category.id && (
                <Ionicons name="checkmark" size={20} color={colors.primary[500]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color={colors.gray[300]} />
      <Text style={styles.emptyStateTitle}>No requests found</Text>
      <Text style={styles.emptyStateText}>
        {searchQuery
          ? 'Try adjusting your search or filters'
          : 'Check back later for new maintenance requests'}
      </Text>
    </View>
  );

  // Render error state
  const renderErrorState = () => (
    <View style={styles.errorState}>
      <Ionicons name="alert-circle-outline" size={64} color={colors.error[500]} />
      <Text style={styles.errorStateTitle}>Something went wrong</Text>
      <Text style={styles.errorStateText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => loadRequests(true)}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );

  // Render footer
  const renderFooter = () => {
    if (!loading || refreshing) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary[500]} />
      </View>
    );
  };

  if (loading && !refreshing && requests.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Loading requests...</Text>
      </View>
    );
  }

  if (error && requests.length === 0) {
    return <View style={styles.container}>{renderErrorState()}</View>;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Maintenance Requests</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="refresh" size={24} color={colors.text.primary} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={colors.text.tertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search requests..."
            placeholderTextColor={colors.text.tertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.statusFilters}
        >
          {statusFilters.map(renderFilterButton)}
        </ScrollView>

        {renderCategoryDropdown()}
      </View>

      {/* Request List */}
      <FlatList
        data={filteredRequests}
        renderItem={({ item }) => (
          <RequestCard request={item} onPress={() => handleRequestPress(item)} />
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    paddingVertical: 0,
  },
  filtersContainer: {
    backgroundColor: colors.background.default,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  statusFilters: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.background.tertiary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  filterButtonActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[500],
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  filterButtonTextActive: {
    color: colors.text.inverse,
  },
  categoryDropdown: {
    paddingHorizontal: 16,
    marginTop: 12,
    position: 'relative',
    zIndex: 1000,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  categoryButtonText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '500',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    backgroundColor: colors.background.default,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 300,
    zIndex: 1001,
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.text.primary,
  },
  dropdownItemTextActive: {
    fontWeight: '600',
    color: colors.primary[500],
  },
  listContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  errorState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  errorStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorStateText: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary[500],
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
