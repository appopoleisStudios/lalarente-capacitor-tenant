import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { PropertyCard } from '../components/PropertyCard';
import { useProperties } from '../../properties/hooks/useProperties';
import { supabase } from '../../../lib/supabase';
import { styles } from './PropertiesListScreen.styles';

export default function PropertiesListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'rented' | 'maintenance'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'rent_desc' | 'rent_asc'>('newest');

  // Get current user ID
  const [userId, setUserId] = useState<string | null>(null);
  
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Fetch properties using the hook
  const { properties, loading, error, refreshing, refresh } = useProperties({
    ownerId: userId || undefined,
    autoFetch: !!userId,
  });

  const filteredProperties = useMemo(() => {
    let result = [...properties];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.address?.toLowerCase().includes(query) ||
          p.city?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Sort
    if (sortBy === 'rent_desc') {
      result.sort((a, b) => (b.rent_amount || 0) - (a.rent_amount || 0));
    } else if (sortBy === 'rent_asc') {
      result.sort((a, b) => (a.rent_amount || 0) - (b.rent_amount || 0));
    } else {
      // newest - sort by created_at descending
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    return result;
  }, [properties, searchQuery, statusFilter, sortBy]);

  const handleView = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(owner)/properties/${id}`);
  };

  const handleEdit = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Navigate to edit property screen
    router.push(`/(owner)/properties/${id}`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <AnimatedButton
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.back();
              }}
              hapticType="medium"
            >
              <View style={styles.backButton}>
                <Text style={styles.backIcon}>←</Text>
              </View>
            </AnimatedButton>
            <Text style={styles.headerTitle}>My Properties</Text>
          </View>
          <AnimatedButton onPress={() => router.push('/(owner)/add-property')}>
            <View style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Add Property</Text>
            </View>
          </AnimatedButton>
        </View>

        {/* Search & Filters */}
        <View style={styles.filtersContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search title, address, city"
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filtersRow}>
            {/* Status Filter */}
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerLabel}>Status:</Text>
              <View style={styles.pickerButtons}>
                {(['all', 'available', 'rented', 'maintenance'] as const).map((status) => (
                  <AnimatedButton key={status} onPress={() => setStatusFilter(status)}>
                    <View style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </View>
                  </AnimatedButton>
                ))}
              </View>
            </View>

            {/* Sort */}
            <View style={styles.pickerWrapper}>
              <Text style={styles.pickerLabel}>Sort:</Text>
              <View style={styles.pickerButtons}>
                {(['newest', 'rent_desc', 'rent_asc'] as const).map((sort) => (
                  <AnimatedButton key={sort} onPress={() => setSortBy(sort)}>
                    <View style={[styles.filterChip, sortBy === sort && styles.filterChipActive]}>
                      <Text style={[styles.filterChipText, sortBy === sort && styles.filterChipTextActive]}>
                        {sort === 'newest' ? 'Newest' : sort === 'rent_desc' ? 'High-Low' : 'Low-High'}
                      </Text>
                    </View>
                  </AnimatedButton>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading properties...</Text>
          </View>
        )}

        {/* Error State */}
        {error && !loading && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Error Loading Properties</Text>
            <Text style={styles.errorText}>{error}</Text>
            <AnimatedButton onPress={refresh}>
              <View style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </View>
            </AnimatedButton>
          </View>
        )}

        {/* Properties List */}
        {!loading && !error && (
          <FlatList
            data={filteredProperties}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PropertyCard property={item} onView={handleView} onEdit={handleEdit} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor="#10b981"
                colors={['#10b981']}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No properties yet</Text>
                <Text style={styles.emptyText}>Add your first property to start managing rent and maintenance.</Text>
                <AnimatedButton onPress={() => router.push('/owner/add-property')}>
                  <View style={styles.emptyButton}>
                    <Text style={styles.emptyButtonText}>+ Add Property</Text>
                  </View>
                </AnimatedButton>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
