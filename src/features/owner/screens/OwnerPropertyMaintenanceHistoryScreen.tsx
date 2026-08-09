import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '@/src/shared/components';
import { StatusBadge, PriorityIndicator } from '@/src/features/maintenance/components';
import { useMaintenanceRequests } from '@/src/features/maintenance/hooks';
import { styles } from './OwnerMaintenanceListScreen.styles';

/**
 * Property-scoped maintenance history (Plane #85).
 *
 * Dedicated pushed route — NOT the Maintenance tab — so a `?propertyId=` param
 * can never stick on the tab bar (the SA REQUEST CHANGES regression: after
 * History → Dashboard → Maintenance, the tab stayed scoped). The tab list
 * remains the full, unfiltered list; this screen carries the property filter
 * and a working back button.
 */
export default function OwnerPropertyMaintenanceHistoryScreen() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();

  const {
    requests: allRequests,
    loading,
    error,
    refreshing,
    onRefresh,
    refetch,
  } = useMaintenanceRequests();

  // Refresh when screen comes into focus (after a request status change)
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const scopedRequests = (allRequests as any[]).filter((r) => r.property_id === propertyId);
  const propertyTitle = scopedRequests[0]?.property?.title;

  const handleCardPress = (requestId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/(owner)/maintenance/${requestId}`);
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

  const header = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle} testID="owner-maintenance-history-title">
          Maintenance History
        </Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {propertyTitle
            ? `${propertyTitle} · ${scopedRequests.length} request${scopedRequests.length !== 1 ? 's' : ''}`
            : `${scopedRequests.length} request${scopedRequests.length !== 1 ? 's' : ''} for this property`}
        </Text>
      </View>
      <AnimatedButton
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          // Deterministic return to the property detail — router.back() from a
          // hidden-tab pushed route can pop to the tab root instead (same
          // pattern as #74/#134/#143 back-stack fixes).
          router.navigate(`/(owner)/properties/${propertyId}` as never);
        }}
        testID="owner-maintenance-history-back"
        accessibilityRole="button"
        accessibilityLabel="Back to Property Details"
      >
        <View style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </View>
      </AnimatedButton>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {header}
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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {header}
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
        {header}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#002395" />
          }
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            {scopedRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔧</Text>
                <Text style={styles.emptyTitle}>No maintenance history</Text>
                <Text style={styles.emptySubtitle}>No requests for this property yet</Text>
              </View>
            ) : (
              <View>
                {scopedRequests.map((request: any, index: number) => (
                  <AnimatedButton
                    key={request.id}
                    onPress={() => handleCardPress(request.id)}
                    style={styles.cardButton}
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

                      {request.category && (
                        <View style={styles.meta}>
                          <View style={styles.metaItem}>
                            <Text style={styles.metaIcon}>🔧</Text>
                            <Text style={styles.metaText}>{request.category.name}</Text>
                          </View>
                        </View>
                      )}
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
