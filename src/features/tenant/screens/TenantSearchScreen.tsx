import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import type { PropertyWithRelations } from '../../properties/api/propertiesApi';

export default function TenantSearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [properties, setProperties] = useState<PropertyWithRelations[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<PropertyWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [propertyType, setPropertyType] = useState<string | null>(null);

  useEffect(() => {
    loadProperties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, properties, minPrice, maxPrice, bedrooms, propertyType]);

  const loadProperties = async () => {
    try {
      setError(null);
      // Fetch all available properties
      const { data, error: fetchError } = await supabase
        .from('properties')
        .select(`
          *,
          owner:profiles!owner_id(id, full_name, email, phone)
        `)
        .eq('status', 'available')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      
      setProperties((data as PropertyWithRelations[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load properties');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...properties];

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title?.toLowerCase().includes(query) ||
          p.address?.toLowerCase().includes(query) ||
          p.city?.toLowerCase().includes(query) ||
          p.province?.toLowerCase().includes(query)
      );
    }

    // Price range
    if (minPrice) {
      const min = parseFloat(minPrice);
      filtered = filtered.filter((p) => (p.rent_amount || 0) >= min);
    }
    if (maxPrice) {
      const max = parseFloat(maxPrice);
      filtered = filtered.filter((p) => (p.rent_amount || 0) <= max);
    }

    // Bedrooms
    if (bedrooms !== null) {
      filtered = filtered.filter((p) => (p.bedrooms || 0) >= bedrooms);
    }

    // Property type
    if (propertyType) {
      filtered = filtered.filter((p) => p.property_type === propertyType);
    }

    setFilteredProperties(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProperties();
  };

  const clearFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setBedrooms(null);
    setPropertyType(null);
    setSearchQuery('');
  };

  const renderPropertyCard = ({ item }: { item: PropertyWithRelations }) => {
    const mainImage = item.images && item.images.length > 0 ? item.images[0] : null;

    return (
      <TouchableOpacity
        style={styles.propertyCard}
        onPress={() => router.push(`/(tenant)/properties/${item.id}` as any)}
      >
        {mainImage ? (
          <Image source={{ uri: mainImage }} style={styles.propertyImage} />
        ) : (
          <View style={[styles.propertyImage, styles.noImage]}>
            <Ionicons name="home-outline" size={48} color="#CCC" />
          </View>
        )}

        <View style={styles.propertyInfo}>
          <Text style={styles.propertyTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#666" />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.city}, {item.province}
            </Text>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="bed-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.bedrooms || 0}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="water-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.bathrooms || 0}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="car-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.parking_spaces || 0}</Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceText}>R {(item.rent_amount || 0).toLocaleString()}</Text>
            <Text style={styles.priceLabel}>/month</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading properties...</Text>
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
          <TouchableOpacity style={styles.retryButton} onPress={loadProperties}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by location, title..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="options-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        {showFilters && (
          <View style={styles.filtersPanel}>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Price Range</Text>
              <View style={styles.priceInputs}>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Min"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={minPrice}
                  onChangeText={setMinPrice}
                />
                <Text style={styles.priceSeparator}>-</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="Max"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                />
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Bedrooms</Text>
              <View style={styles.optionButtons}>
                {[1, 2, 3, 4].map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.optionButton, bedrooms === num && styles.optionButtonActive]}
                    onPress={() => setBedrooms(bedrooms === num ? null : num)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        bedrooms === num && styles.optionButtonTextActive,
                      ]}
                    >
                      {num}+
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Property Type</Text>
              <View style={styles.optionButtons}>
                {['house', 'apartment', 'townhouse'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionButton,
                      propertyType === type && styles.optionButtonActive,
                    ]}
                    onPress={() => setPropertyType(propertyType === type ? null : type)}
                  >
                    <Text
                      style={[
                        styles.optionButtonText,
                        propertyType === type && styles.optionButtonTextActive,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <Text style={styles.clearButtonText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Results Count */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {filteredProperties.length} {filteredProperties.length === 1 ? 'property' : 'properties'} found
          </Text>
        </View>

        {/* Property List */}
        {filteredProperties.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="home-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No properties found</Text>
            <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProperties}
            renderItem={renderPropertyCard}
            keyExtractor={(item) => item.id}
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
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  filterButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  filtersPanel: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  priceSeparator: {
    fontSize: 16,
    color: '#666',
  },
  optionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionButtonText: {
    fontSize: 14,
    color: '#666',
  },
  optionButtonTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  clearButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
  },
  resultsText: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  propertyCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5F5F5',
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  propertyInfo: {
    padding: 16,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
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
