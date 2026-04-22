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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { MessagesSection } from '../components/MessagesSection';
import { styles } from './OwnerDashboardScreen.styles';
import { supabase } from '../../../lib/supabase';
import { viewingsApi } from '../../properties/api/viewingsApi';
import { messagesApi } from '../../messaging/api/messagesApi';
import { useOwnerDashboard } from '../hooks/useOwnerDashboard';
import { Ionicons } from '@expo/vector-icons';

export default function OwnerDashboardScreen() {
  const router = useRouter();
  const [viewingRequests, setViewingRequests] = useState<any[]>([]);
  const [pendingViewingsCount, setPendingViewingsCount] = useState(0);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [messageThreads, setMessageThreads] = useState<any[]>([]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [recentCancellations, setRecentCancellations] = useState<any[]>([]);
  const [pendingAlternativesCount, setPendingAlternativesCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const ownerIdRef = useRef<string | null>(null);

  // Use custom hook for dashboard data (enterprise pattern)
  const { data: dashboardData, loading, error, refetch } = useOwnerDashboard(ownerId);

  useEffect(() => {
    initOwner();
  }, []);

  // Re-load viewings + messages + unread notif count on every screen focus
  useFocusEffect(
    useCallback(() => {
      const id = ownerIdRef.current;
      if (id) {
        loadViewingRequests(id);
        loadMessages(id);
        loadRecentCancellations(id);
        refetch();
        // Refresh unread notification count from DB
        (async () => {
          const { count } = await (supabase as any)
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', id)
            .is('read_at', null);
          setUnreadNotifCount(count || 0);
        })();
      }
    }, [])
  );

  const handlePullToRefresh = async () => {
    setRefreshing(true);
    const id = ownerIdRef.current;
    if (id) {
      await Promise.all([
        loadViewingRequests(id),
        loadMessages(id),
        loadRecentCancellations(id),
        refetch(),
      ]);
    }
    setRefreshing(false);
  };

  const initOwner = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      ownerIdRef.current = user.id;
      setOwnerId(user.id);
      loadViewingRequests(user.id);
      loadMessages(user.id);
    }
  };

  const loadMessages = async (userId: string) => {
    try {
      const threads = await messagesApi.getUserThreads(userId, 'owner');
      // Sort by unread first, then by recency
      const sorted = [...threads].sort((a, b) => {
        const aUnread = a.unread_count_owner ?? 0;
        const bUnread = b.unread_count_owner ?? 0;
        if (bUnread !== aUnread) return bUnread - aUnread;
        return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime();
      });

      const totalUnread = threads.reduce((sum, t) => sum + (t.unread_count_owner ?? 0), 0);
      setTotalUnreadMessages(totalUnread);
      setMessageThreads(sorted.slice(0, 3).map(t => ({
        id: t.id,
        tenant_name: (t as any).tenant?.full_name ?? 'Tenant',
        subject: t.subject,
        unread_count: t.unread_count_owner ?? 0,
        last_message_at: t.last_message_at,
        category: t.category,
      })));
    } catch (err) {
      console.error('Error loading messages for dashboard:', err);
    }
  };

  const loadViewingRequests = async (userId?: string) => {
    try {
      const ownerIdToUse = userId || ownerId;
      if (!ownerIdToUse) return;

      const viewings = await viewingsApi.getOwnerViewings(ownerIdToUse);

      const recentViewings = viewings
        .filter(v => ['pending', 'approved', 'expired', 'declined'].includes(v.status) && v.created_at)
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
            alternative_times: v.alternative_times,
          };
        })
      );

      setViewingRequests(formattedViewings);
      setPendingViewingsCount(viewings.filter(v => v.status === 'pending').length);

      // Count declined viewings where owner offered alternatives (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const withAlt = viewings.filter(
        v => v.status === 'declined' &&
          v.alternative_times && v.alternative_times.length > 0 &&
          (v.updated_at ?? v.created_at ?? '') >= sevenDaysAgo
      );
      setPendingAlternativesCount(withAlt.length);
    } catch (error) {
      console.error('Error loading viewing requests:', error);
    }
  };

  const loadRecentCancellations = async (userId: string) => {
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('viewing_requests')
        .select(`
          id, requested_date, requested_time, updated_at,
          property:properties!property_id(title),
          tenant:profiles!tenant_id(full_name)
        `)
        .eq('owner_id', userId)
        .eq('status', 'cancelled')
        .gte('cancelled_at', twentyFourHoursAgo)
        .order('cancelled_at', { ascending: false })
        .limit(3);

      setRecentCancellations(data ?? []);
    } catch (err) {
      console.error('Error loading recent cancellations:', err);
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

  const notificationCount = unreadNotifCount + pendingViewingsCount
    + dashboardData.pendingTerminations
    + dashboardData.openDisputes;

  // Dynamic documents from real data
  const documents = [
    { name: 'Lease Contracts', icon: 'document-text-outline', type: 'active-leases', info: `${dashboardData.documents.activeLeases} Active` },
    { name: 'Invoices', icon: 'cash-outline', type: 'recent-invoices', info: `${dashboardData.documents.recentInvoices} Total` },
    { name: 'Vendor Quotes', icon: 'clipboard-outline', type: 'pending-quotes', info: `${dashboardData.documents.pendingQuotes} For Review` },
    { name: 'Tax Reports', icon: 'calculator-outline', type: 'tax', info: 'SARS ITR12' },
    { name: 'Compliance', icon: 'shield-checkmark-outline', type: 'compliance', info: 'FICA + COC' },
    { name: 'Deposits', icon: 'wallet-outline', type: 'deposits', info: 'Interest + Refunds' },
    { name: 'Holding Deposits', icon: 'lock-closed-outline', type: 'holding-deposit', info: `${dashboardData.documents.holdingDepositsActive} Active` },
    { name: 'Lease Renewals', icon: 'refresh-outline', type: 'renewals', info: 'CPA Notices' },
    { name: 'Insurance', icon: 'umbrella-outline', type: 'insurance', info: 'Claims Tracker' },
    { name: 'Disputes', icon: 'alert-circle-outline', type: 'payment-disputes', info: dashboardData.openDisputes > 0 ? `${dashboardData.openDisputes} Open` : 'Payment Queries' },
    { name: 'Inspections', icon: 'search-outline', type: 'inspections', info: 'Move-In / Out' },
    { name: 'Statements', icon: 'bar-chart-outline', type: 'statements', info: 'Monthly Income' },
  ];

  // Success state - render dashboard with real data
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.headerTitle}>Portfolio Dashboard</Text>
              <Text style={styles.headerSubtitle}>
                Welcome back, {dashboardData.userName}
              </Text>
            </View>
          </View>
          <AnimatedButton onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push('/(owner)/notifications' as any);
          }}>
            <View style={styles.notificationInner}>
              <Ionicons name="notifications-outline" size={24} color="#111827" />
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor="#002395" />
          }
        >
          {/* Portfolio Card - Real Data */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <PortfolioCard {...dashboardData.portfolio} userName={dashboardData.userName} />
          </Animated.View>

          {/* Urgent Action Alerts */}
          {dashboardData.pendingTerminations > 0 && (
            <Animated.View entering={FadeInDown.delay(140).duration(400)}>
              <TouchableOpacity
                style={styles.terminationAlertCard}
                onPress={() => router.push('/(owner)/early-termination' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle" size={24} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.terminationAlertTitle}>
                    {dashboardData.pendingTerminations} Early Termination {dashboardData.pendingTerminations === 1 ? 'Request' : 'Requests'} Pending
                  </Text>
                  <Text style={styles.terminationAlertSub}>CPA s14 — Tenant statutory right to exit</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#DC2626" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {dashboardData.openDisputes > 0 && (
            <Animated.View entering={FadeInDown.delay(155).duration(400)}>
              <TouchableOpacity
                style={styles.processingAlertCard}
                onPress={() => router.push('/(owner)/payment-disputes' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-half-outline" size={24} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.processingAlertTitle}>
                    {dashboardData.openDisputes} Payment Dispute{dashboardData.openDisputes > 1 ? 's' : ''} Open
                  </Text>
                  <Text style={styles.processingAlertSub}>Tenants have raised payment queries</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {dashboardData.processingPayments > 0 && (
            <Animated.View entering={FadeInDown.delay(160).duration(400)}>
              <TouchableOpacity
                style={styles.processingAlertCard}
                onPress={() => router.push('/(owner)/rent-roll' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="hourglass-outline" size={24} color="#7C3AED" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.processingAlertTitle}>
                    {dashboardData.processingPayments} Payment{dashboardData.processingPayments > 1 ? 's' : ''} Awaiting Confirmation
                  </Text>
                  <Text style={styles.processingAlertSub}>Tenants have submitted payment — confirm receipt</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#7C3AED" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Declined Viewings — Alternatives Offered */}
          {pendingAlternativesCount > 0 && pendingViewingsCount === 0 && (
            <Animated.View entering={FadeInDown.delay(163).duration(400)}>
              <TouchableOpacity
                style={styles.alternativesAlertCard}
                onPress={() => router.push('/(owner)/viewings' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal-outline" size={24} color="#0369A1" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alternativesAlertTitle}>
                    {pendingAlternativesCount} Viewing{pendingAlternativesCount > 1 ? 's' : ''} — Alternatives Offered
                  </Text>
                  <Text style={styles.alternativesAlertSub}>Waiting for tenant to choose a new time slot</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#0369A1" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Pending Viewing Requests */}
          {pendingViewingsCount > 0 && (
            <Animated.View entering={FadeInDown.delay(165).duration(400)}>
              <TouchableOpacity
                style={styles.viewingAlertCard}
                onPress={() => router.push('/(owner)/viewings' as any)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={24} color="#B45309" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.viewingAlertTitle}>
                    {pendingViewingsCount} Viewing {pendingViewingsCount === 1 ? 'Request' : 'Requests'} Awaiting Response
                  </Text>
                  <Text style={styles.viewingAlertSub}>Tenants are waiting — approve or suggest a new time</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#B45309" />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Recently Cancelled Viewings */}
          {recentCancellations.length > 0 && (
            <Animated.View entering={FadeInDown.delay(170).duration(400)}>
              {recentCancellations.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.cancellationCard}
                  onPress={() => router.push({ pathname: '/(owner)/viewings/[id]' as any, params: { id: c.id } })}
                  activeOpacity={0.8}
                >
                  <Ionicons name="information-circle" size={22} color="#6B7280" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cancellationText}>
                      {(c.tenant as any)?.full_name ?? 'A tenant'} cancelled their viewing for {(c.property as any)?.title ?? 'a property'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </Animated.View>
          )}

          {/* Analytics Grid - Real Data */}
          <Animated.View entering={FadeInDown.delay(200).duration(500)}>
            <AnalyticsGrid {...dashboardData.analytics} />
          </Animated.View>

          {/* Documents Section - Real counts */}
          <Animated.View entering={FadeInDown.delay(300).duration(500)}>
            <DocumentsSection documents={documents} />
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

          {/* Messages Section - Unread threads */}
          {messageThreads.length > 0 && (
            <Animated.View entering={FadeInDown.delay(475).duration(500)}>
              <MessagesSection threads={messageThreads} totalUnread={totalUnreadMessages} />
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

