import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { messagesApi } from '@/src/features/messaging/api/messagesApi';
import { useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '@/src/shared/components';
import { MaintenanceFilters, FilterType } from '@/src/features/owner/components/MaintenanceFilters';
import { StatusBadge, PriorityIndicator } from '@/src/features/maintenance/components';
import { useMaintenanceRequests } from '@/src/features/maintenance/hooks';
import {
  archiveMaintenanceRequest,
  unarchiveMaintenanceRequest,
} from '@/src/features/maintenance/api/requests/maintenanceRequests.api';
import { styles } from './TenantMaintenanceListScreen.styles';

export default function TenantMaintenanceListScreen() {
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
    if (activeFilter === 'archived' || activeFilter === 'all') return true;
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

  const handleCardLongPress = (request: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const isArchived = request.archived_by_tenant;
    Alert.alert(
      isArchived ? 'Unarchive request?' : 'Archive request?',
      isArchived
        ? 'This will move it back to your active list.'
        : 'Archived requests are hidden from your main list. You can view them in the Archived tab.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isArchived ? 'Unarchive' : 'Archive',
          style: isArchived ? 'default' : 'destructive',
          onPress: async () => {
            try {
              if (isArchived) {
                await unarchiveMaintenanceRequest(request.id, 'tenant');
              } else {
                await archiveMaintenanceRequest(request.id, 'tenant');
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    }
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  };

  const handleReportIssue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(tenant)/maintenance/report');
  };

  const handleCardPress = (requestId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(`/(tenant)/maintenance/${requestId}`);
  };

  const handleMessageLandlord = async (request: {
    id: string;
    title: string;
    owner_id?: string | null;
    tenant_id?: string | null;
    property_id?: string | null;
  }) => {
    if (!request.owner_id || !request.tenant_id) {
      Alert.alert('Unavailable', 'Cannot open messages for this request.');
      return;
    }
    try {
      const thread = await messagesApi.getOrCreateThread(
        request.owner_id,
        request.tenant_id,
        request.property_id ?? undefined,
        `Maintenance: ${request.title}`,
        'maintenance'
      );
      router.push(`/(tenant)/messages/${thread.id}`);
    } catch (err) {
      console.error('Open maintenance thread error:', err);
      Alert.alert('Error', 'Could not open messages.');
    }
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
            <Text style={styles.loadingText}>Loading your requests...</Text>
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
              {counts.all} {counts.all !== 1 ? 'issues' : 'issue'} reported
            </Text>
          </View>
          <AnimatedButton onPress={handleReportIssue} testID="maintenance-report-fab">
            <View style={styles.reportButton}>
              <Text style={styles.reportIcon}>+</Text>
            </View>
          </AnimatedButton>
        </View>

        {/* Filters */}
        <MaintenanceFilters
          activeFilter={activeFilter}
          onFilterChange={(f) => setActiveFilter(f)}
          counts={counts}
        />

        {/* Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#002395" />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Requests List */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>{isArchiveView ? '📦' : '✅'}</Text>
                <Text style={styles.emptyTitle}>
                  {isArchiveView
                    ? 'Nothing archived'
                    : activeFilter === 'all'
                      ? 'No issues reported'
                      : 'No issues found'}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {isArchiveView
                    ? 'Long-press any request to archive it'
                    : activeFilter === 'all'
                      ? 'Everything is working great!'
                      : `No ${activeFilter.replace('_', ' ')} issues`}
                </Text>
                {activeFilter === 'all' && (
                  <AnimatedButton onPress={handleReportIssue} testID="maintenance-report-cta">
                    <View style={styles.reportIssueButton}>
                      <Text style={styles.reportIssueButtonText}>Report an Issue</Text>
                    </View>
                  </AnimatedButton>
                )}
              </View>
            ) : (
              <View>
                {filteredRequests.map((request: any) => (
                  <View
                    key={request.id}
                    style={[styles.cardButton, isArchiveView ? { opacity: 0.65 } : undefined]}
                  >
                    <AnimatedButton
                      onPress={() => handleCardPress(request.id)}
                      onLongPress={() => handleCardLongPress(request)}
                      style={styles.cardPressable}
                      testID={`maintenance-card-${request.id}`}
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
                            <View style={[styles.metaItem, styles.metaItemStacked]}>
                              <Text style={styles.metaIcon}>📍</Text>
                              <View style={styles.metaTextBlock}>
                                <Text style={styles.metaText} numberOfLines={1}>
                                  {request.property.title}
                                </Text>
                                {request.property.address ? (
                                  <Text style={styles.metaSubText} numberOfLines={1}>
                                    {request.property.address}
                                    {request.property.city ? `, ${request.property.city}` : ''}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          )}
                          {request.category && (
                            <View style={styles.metaItem}>
                              <Text style={styles.metaIcon}>🔧</Text>
                              <Text style={styles.metaText}>{request.category.name}</Text>
                            </View>
                          )}
                        </View>

                        {/* Vendor Info (if assigned) */}
                        {request.assigned_vendor && (
                          <View style={styles.vendorInfo}>
                            <Text style={styles.vendorLabel}>Assigned to:</Text>
                            <Text style={styles.vendorName}>
                              {request.assigned_vendor.company_name ||
                                request.assigned_vendor.full_name}
                            </Text>
                          </View>
                        )}
                      </View>
                    </AnimatedButton>
                    <View style={styles.cardActions}>
                      <TouchableOpacity
                        style={styles.messageBtn}
                        onPress={() => handleMessageLandlord(request)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                        <Text style={styles.messageBtnText}>Chat with Owner</Text>
                        <View style={{ flex: 1 }} />
                        <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
