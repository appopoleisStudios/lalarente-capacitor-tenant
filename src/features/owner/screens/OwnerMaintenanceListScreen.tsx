import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { MaintenanceFilters } from '../components/MaintenanceFilters';
import { StatusBadge, PriorityIndicator } from '@/src/features/maintenance/components';
import { useMaintenanceRequests } from '@/src/features/maintenance/hooks';
import { styles } from './OwnerMaintenanceListScreen.styles';

type FilterType = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed';

export default function OwnerMaintenanceListScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  
  // Real data from database
  const { requests: allRequests, loading, error, refreshing, onRefresh, refetch } = useMaintenanceRequests();

  // Refresh when screen comes into focus (after delete/update)
  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Filter requests
  const filteredRequests = allRequests.filter((request: any) => {
    if (activeFilter === 'all') return true;
    return request.status === activeFilter;
  });

  // Calculate counts
  const counts = {
    all: allRequests.length,
    open: allRequests.filter((r: any) => r.status === 'open').length,
    assigned: allRequests.filter((r: any) => r.status === 'assigned').length,
    in_progress: allRequests.filter((r: any) => r.status === 'in_progress').length,
    completed: allRequests.filter((r: any) => r.status === 'completed').length,
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const handleNewRequest = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(owner)/maintenance/new');
  };

  const handleCardPress = (requestId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/(owner)/maintenance/${requestId}`);
  };

  // Loading state
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Maintenance</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007A4D" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Maintenance</Text>
              <Text style={styles.headerSubtitle}>Error</Text>
            </View>
          </View>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Failed to load requests</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <AnimatedButton onPress={onRefresh}>
              <View style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </View>
            </AnimatedButton>
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
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Maintenance</Text>
            <Text style={styles.headerSubtitle}>
              {counts.all} total request{counts.all !== 1 ? 's' : ''}
            </Text>
          </View>
          <AnimatedButton onPress={handleNewRequest}>
            <View style={styles.addButton}>
              <Text style={styles.addIcon}>+</Text>
            </View>
          </AnimatedButton>
        </View>

        {/* Filters */}
        <MaintenanceFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={counts}
        />

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007A4D" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Requests List */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔧</Text>
                <Text style={styles.emptyTitle}>No requests found</Text>
                <Text style={styles.emptySubtitle}>All caught up!</Text>
              </View>
            ) : (
              <View>
                {filteredRequests.map((request: any, index: number) => (
                  <AnimatedButton
                    key={request.id}
                    onPress={() => handleCardPress(request.id)}
                    style={styles.cardButton}
                  >
                    <View style={styles.card}>
                      {/* Header */}
                      <View style={styles.cardHeader}>
                        <View style={styles.badges}>
                          <StatusBadge status={request.status} size="small" />
                          <PriorityIndicator priority={request.priority} size="small" />
                        </View>
                        <Text style={styles.date}>{formatDate(request.created_at)}</Text>
                      </View>

                      {/* Title */}
                      <Text style={styles.title} numberOfLines={1}>
                        {request.title}
                      </Text>

                      {/* Description */}
                      <Text style={styles.description} numberOfLines={2}>
                        {request.description}
                      </Text>

                      {/* Property & Category */}
                      <View style={styles.meta}>
                        {request.property && (
                          <View style={styles.metaItem}>
                            <Text style={styles.metaIcon}>📍</Text>
                            <Text style={styles.metaText} numberOfLines={1}>
                              {request.property.title}
                            </Text>
                          </View>
                        )}
                        {request.category && (
                          <View style={styles.metaItem}>
                            <Text style={styles.metaIcon}>🔧</Text>
                            <Text style={styles.metaText}>{request.category.name}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </AnimatedButton>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
