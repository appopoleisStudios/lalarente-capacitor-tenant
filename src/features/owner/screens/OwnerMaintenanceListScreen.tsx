import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { MaintenanceStatsCard } from '../components/MaintenanceStatsCard';
import { MaintenanceFilters } from '../components/MaintenanceFilters';
import { StatusBadge, PriorityIndicator } from '@/src/features/maintenance/components';
import { MOCK_MAINTENANCE_REQUESTS, MOCK_USERS } from '@/src/lib/mockData';
import { styles } from './OwnerMaintenanceListScreen.styles';

type FilterType = 'all' | 'open' | 'assigned' | 'in_progress' | 'completed';

export default function OwnerMaintenanceListScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Mock data - filter by owner
  const allRequests = MOCK_MAINTENANCE_REQUESTS.filter(
    (r) => r.owner_id === MOCK_USERS.owner.id
  );

  // Filter requests
  const filteredRequests = allRequests.filter((request) => {
    if (activeFilter === 'all') return true;
    return request.status === activeFilter;
  });

  // Calculate counts
  const counts = {
    all: allRequests.length,
    open: allRequests.filter((r) => r.status === 'open').length,
    assigned: allRequests.filter((r) => r.status === 'assigned').length,
    in_progress: allRequests.filter((r) => r.status === 'in_progress').length,
    completed: allRequests.filter((r) => r.status === 'completed').length,
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
          showsVerticalScrollIndicator={false}
        >
          {/* Stats Cards */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <MaintenanceStatsCard
              openCount={counts.open}
              assignedCount={counts.assigned}
              inProgressCount={counts.in_progress}
              completedCount={counts.completed}
            />
          </Animated.View>

          {/* Requests List */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔧</Text>
                <Text style={styles.emptyTitle}>No requests found</Text>
                <Text style={styles.emptySubtitle}>All caught up!</Text>
              </View>
            ) : (
              <View>
                {filteredRequests.map((request, index) => (
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
