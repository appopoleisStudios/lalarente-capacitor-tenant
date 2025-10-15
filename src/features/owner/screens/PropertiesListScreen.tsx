import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { PropertyCard } from '../components/PropertyCard';
import { styles } from './PropertiesListScreen.styles';

// Mock data
const MOCK_PROPERTIES = [
  {
    id: '1',
    title: 'Rosebank Lofts 2B',
    address: '123 Oxford Road',
    city: 'Johannesburg',
    province: 'Gauteng',
    rent_amount: 12500,
    bedrooms: 2,
    bathrooms: 1,
    parking_spaces: 1,
    status: 'occupied' as const,
    images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400'],
  },
  {
    id: '2',
    title: 'Sandton View',
    address: '45 Rivonia Road',
    city: 'Sandton',
    province: 'Gauteng',
    rent_amount: 18000,
    bedrooms: 3,
    bathrooms: 2,
    parking_spaces: 2,
    status: 'available' as const,
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400'],
  },
  {
    id: '3',
    title: 'Umhlanga Heights',
    address: '789 Lighthouse Road',
    city: 'Umhlanga',
    province: 'KwaZulu-Natal',
    rent_amount: 15000,
    bedrooms: 2,
    bathrooms: 2,
    parking_spaces: 1,
    status: 'maintenance' as const,
  },
];

export default function PropertiesListScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied' | 'maintenance' | 'vacant'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'rent_desc' | 'rent_asc'>('newest');

  const filteredProperties = useMemo(() => {
    let result = [...MOCK_PROPERTIES];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.address.toLowerCase().includes(query) ||
          p.city.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Sort
    if (sortBy === 'rent_desc') {
      result.sort((a, b) => b.rent_amount - a.rent_amount);
    } else if (sortBy === 'rent_asc') {
      result.sort((a, b) => a.rent_amount - b.rent_amount);
    }

    return result;
  }, [searchQuery, statusFilter, sortBy]);

  const handleView = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to property detail
  };

  const handleEdit = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Navigate to edit property
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
          <AnimatedButton onPress={() => router.push('/owner/add-property')}>
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
                {(['all', 'available', 'occupied', 'maintenance', 'vacant'] as const).map((status) => (
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

        {/* Properties List */}
        <FlatList
          data={filteredProperties}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PropertyCard property={item} onView={handleView} onEdit={handleEdit} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
      </View>
    </SafeAreaView>
  );
}
