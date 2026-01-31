/**
 * Owner Dashboard Screen
 *
 * Enterprise-level dashboard implementation with:
 * - Proper separation of concerns (UI vs data fetching)
 * - Custom hooks for data management
 * - Comprehensive error handling
 * - Loading states
 * - Type safety
 * - Real-time data from existing APIs
 *
 * @module OwnerDashboardScreen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, ActivityIndicator, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { PortfolioCard } from '../components/PortfolioCard';
import { AnalyticsGrid } from '../components/AnalyticsGrid';
import { DocumentsSection } from '../components/DocumentsSection';
import { MaintenanceSection } from '../components/MaintenanceSection';
import { ApplicantsSection } from '../components/ApplicantsSection';
import { ViewingRequestsSection } from '../components/ViewingRequestsSection';
import { ActivitySection } from '../components/ActivitySection';
import { styles } from './OwnerDashboardScreen.styles';
import { supabase } from '../../../lib/supabase';
import { viewingsApi } from '../../properties/api/viewingsApi';
import { useOwnerDashboard } from '../hooks/useOwnerDashboard';
import { Ionicons } from '@expo/vector-icons';

// Static documents data (until documents module is implemented)
const STATIC_DOCUMENTS = [
  { name: 'Lease Contracts', icon: '📄', type: 'lease', info: 'Active/Past' },
  { name: 'Invoices', icon: '💰', type: 'invoice', info: 'Latest' },
  { name: 'Vendor Quotes', icon: '📋', type: 'quote', info: 'For Review' },
  { name: 'Tax Reports', icon: '⚖️', type: 'tax', info: 'Annual' },
  { name: 'Compliance', icon: '🛡️', type: 'compliance', info: 'FICA/COC' },
];

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const [notificationCount] = useState(3);
  const [viewingRequests, setViewingRequests] = useState<any[]>([]);
  const [pendingViewingsCount, setPendingViewingsCount] = useState(0);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  // Use custom hook for dashboard data (enterprise pattern)
  const { data: dashboardData, loading, error, refetch } = useOwnerDashboard(ownerId);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (ownerId) {
        loadViewingRequests();
      }
    }, [ownerId])
  );

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      loadViewingRequests(user.id);
    }
  };

  const loadViewingRequests = async (userId?: string) => {
    try {
      const ownerIdToUse = userId || ownerId;
      if (!ownerIdToUse) return;

      const viewings = await viewingsApi.getOwnerViewings(ownerIdToUse);

      const recentViewings = viewings
        .filter(v => ['pending', 'approved'].includes(v.status) && v.created_at)
        .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
        .slice(0, 5);

      const formattedViewings = await Promise.all(
        recentViewings.map(async (v) => {
          const { data: property } = await supabase
            .from('properties')
            .select('title')
            .eq('id', v.property_id)
            .single();

          const { data: tenant } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', v.tenant_id)
            .single();

          return {
            id: v.id,
            property_title: property?.title || 'Property',
            tenant_name: tenant?.full_name || 'Tenant',
            requested_date: v.requested_date,
            requested_time: v.requested_time,
            status: v.status,
          };
        })
      );

      setViewingRequests(formattedViewings);
      setPendingViewingsCount(viewings.filter(v => v.status === 'pending').length);
    } catch (error) {
      console.error('Error loading viewing requests:', error);
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color="#002395" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state with retry
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <Ionicons name="alert-circle" size={64} color="#DC2626" />
          <Text style={styles.errorTitle}>Unable to load dashboard</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Ionicons name="refresh" size={20} color="#FFF" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // No data state (edge case - user might not have properties yet)
  if (!dashboardData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centerContent]}>
          <Ionicons name="home-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Welcome to LaLarente</Text>
          <Text style={styles.emptyMessage}>Start by adding your first property</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Success state - render dashboard with real data
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
              <View style={styles.backButtonInner}>
                <Text style={styles.backIcon}>←</Text>
              </View>
            </AnimatedButton>
            <View>
              <Text style={styles.headerTitle}>Portfolio Dashboard</Text>
              <Text style={styles.headerSubtitle}>
                Welcome back, {dashboardData.userName}
              </Text>
            </View>
          </View>
          <AnimatedButton onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}>
            <View style={styles.notificationInner}>
              <Text style={styles.bellIcon}>🔔</Text>
              {notificationCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{notificationCount}</Text>
                </View>
              )}
            </View>
          </AnimatedButton>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
        >
          {/* Portfolio Card - Real Data */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <PortfolioCard {...dashboardData.portfolio} userName={dashboardData.userName} />
          </Animated.View>

          {/* Analytics Grid - Real Data */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <AnalyticsGrid {...dashboardData.analytics} />
          </Animated.View>

          {/* Documents Section - Static data for now */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <DocumentsSection documents={STATIC_DOCUMENTS} />
          </Animated.View>

          {/* Maintenance Section - Real Data */}
          {dashboardData.maintenance.length > 0 && (
            <Animated.View entering={FadeInDown.delay(400).duration(500)}>
              <MaintenanceSection maintenance={dashboardData.maintenance} />
            </Animated.View>
          )}

          {/* Viewing Requests Section - Real Data */}
          {viewingRequests.length > 0 && (
            <Animated.View entering={FadeInDown.delay(450).duration(500)}>
              <ViewingRequestsSection
                viewings={viewingRequests}
                pendingCount={pendingViewingsCount}
              />
            </Animated.View>
          )}

          {/* Applicants Section - Real Data */}
          {dashboardData.applicants.length > 0 && (
            <Animated.View entering={FadeInDown.delay(500).duration(500)}>
              <ApplicantsSection applicants={dashboardData.applicants} />
            </Animated.View>
          )}

          {/* Activity Feed - Real Data */}
          {dashboardData.recentActivity.length > 0 && (
            <Animated.View entering={FadeInDown.delay(600).duration(500)}>
              <ActivitySection activities={dashboardData.recentActivity} />
            </Animated.View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
