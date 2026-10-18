import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '@/src/shared/components';
import { MaintenanceFilters, FilterType } from '../components/MaintenanceFilters';
import { StatusBadge, PriorityIndicator } from '@/src/features/maintenance/components';
import { useMaintenanceRequests } from '@/src/features/maintenance/hooks';
import {
  archiveMaintenanceRequest,
  unarchiveMaintenanceRequest,
} from '@/src/features/maintenance/api/requests/maintenanceRequests.api';
import { styles } from './OwnerMaintenanceListScreen.styles';

export default function OwnerMaintenanceListScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const isArchiveView = activeFilter === 'archived';

  const {
    requests: allRequests,
    loading,
    error,
    refreshing,
    onRefresh,
    refetch,
  } = useMaintenanceRequests(isArchiveView);

  useFocusEffect(
    React.useCallback(() => {
      refetch();
    }, [refetch])
  );

  const filteredRequests = allRequests.filter((request: any) => {
    if (activeFilter === 'archived') return true;
    if (activeFilter === 'all') return true;
    return request.status === activeFilter;
  });

  const counts = {
    all: isArchiveView ? 0 : allRequests.length,
    open: isArchiveView ? 0 : allRequests.filter((r: any) => r.status === 'open').length,
    assigned: isArchiveView ? 0 : allRequests.filter((r: any) => r.status === 'assigned').length,
    in_progress: isArchiveView
      ? 0
      : allRequests.filter((r: any) => r.status === 'in_progress').length,
    completed: isArchiveView ? 0 : allRequests.filter((r: any) => r.status === 'completed').length,
    archived: isArchiveView ? allRequests.length : 0,
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const handleCardLongPress = (request: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const isArchived = request.archived_by_owner;
    Alert.alert(
      isArchived ? 'Unarchive request?' : 'Archive request?',
      isArchived
        ? 'This will move it back to your active list.'
        : 'Archived requests are hidden from your main list. You can always view them in the Archived tab.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isArchived ? 'Unarchive' : 'Archive',
          style: isArchived ? 'default' : 'destructive',
          onPress: async () => {
            try {
              if (isArchived) {
                await unarchiveMaintenanceRequest(request.id, 'owner');
              } else {
                await archiveMaintenanceRequest(request.id, 'owner');
              }
              refetch();
            } catch {
              Alert.alert('Error', 'Could not update archive status. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Maintenance</Text>
              <Text style={styles.headerSubtitle}>Loading...</Text>
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#002395" />
            <Text style={styles.loadingText}>Loading requests...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Maintenance</Text>
            <Text style={styles.headerSubtitle}>
              {isArchiveView
                ? `${counts.archived} archived`
                : `${counts.all} total request${counts.all !== 1 ? 's' : ''}`}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              accessibilityLabel="Find a vendor"
              accessibilityRole="button"
              testID="owner-find-vendor"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(owner)/maintenance/vendor-directory');
              }}
              style={styles.findVendorButton}
            >
              <Text style={styles.findVendorText}>Find vendor</Text>
            </TouchableOpacity>
            <AnimatedButton
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(owner)/maintenance/new');
              }}
            >
              <View style={styles.addButton}>
                <Text style={styles.addIcon}>+</Text>
              </View>
            </AnimatedButton>
          </View>
        </View>

        {/* Filters */}
        <MaintenanceFilters
          activeFilter={activeFilter}
          onFilterChange={(f) => {
            setActiveFilter(f);
          }}
          counts={counts}
        />

        {/* Hint — only when non-archived list */}
        {!isArchiveView && allRequests.length > 0 && (
          <Text style={{ fontSize: 11, color: '#9ca3af', paddingHorizontal: 16, paddingTop: 8 }}>
            Long-press a request to archive it
          </Text>
        )}

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#002395" />
          }
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>{isArchiveView ? '📦' : '🔧'}</Text>
                <Text style={styles.emptyTitle}>
                  {isArchiveView ? 'Nothing archived' : 'No requests found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isArchiveView ? 'Long-press any request to archive it' : 'All caught up!'}
                </Text>
              </View>
            ) : (
              <View>
                {filteredRequests.map((request: any) => (
                  <AnimatedButton
                    key={request.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push(`/(owner)/maintenance/${request.id}`);
                    }}
                    onLongPress={() => handleCardLongPress(request)}
                    style={
                      isArchiveView ? [styles.cardButton, { opacity: 0.65 }] : styles.cardButton
                    }
                  >
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.badges}>
                          <StatusBadge status={request.status} size="small" />
                          <PriorityIndicator priority={request.priority} size="small" />
                          {request.closure_requested_at && (
                            <View style={styles.closureBadge}>
                              <Text style={styles.closureBadgeText}>Closure</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.date}>{formatDate(request.created_at)}</Text>
                      </View>

                      <Text style={styles.title} numberOfLines={1}>
                        {request.title}
                      </Text>

                      <Text style={styles.description} numberOfLines={2}>
                        {request.description}
                      </Text>

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
