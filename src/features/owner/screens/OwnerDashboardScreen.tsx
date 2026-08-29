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
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton, FeaturePin } from '@/src/shared/components';
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
        return (
          new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
        );
      });

      const totalUnread = threads.reduce((sum, t) => sum + (t.unread_count_owner ?? 0), 0);
      setTotalUnreadMessages(totalUnread);
      setMessageThreads(
        sorted.slice(0, 3).map((t) => ({
          id: t.id,
          tenant_name: (t as any).tenant?.full_name ?? 'Tenant',
          subject: t.subject,
          unread_count: t.unread_count_owner ?? 0,
          last_message_at: t.last_message_at,
          category: t.category,
        }))
      );
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
        .filter(
          (v) => ['pending', 'approved', 'expired', 'declined'].includes(v.status) && v.created_at
        )
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
      setPendingViewingsCount(viewings.filter((v) => v.status === 'pending').length);

      // Count declined viewings where owner offered alternatives (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const withAlt = viewings.filter(
        (v) =>
          v.status === 'declined' &&
          v.alternative_times &&
          v.alternative_times.length > 0 &&
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
        .select(
          `
          id, requested_date, requested_time, updated_at,
          property:properties!property_id(title),
          tenant:profiles!tenant_id(full_name)
        `
        )
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

  const notificationCount =
    unreadNotifCount +
    pendingViewingsCount +
    dashboardData.pendingTerminations +
    dashboardData.openDisputes +
    dashboardData.pendingClosures;

  // Dynamic documents from real data. Docs with actionable counts are flagged
  // `attention` — DocumentsSection renders them as Needs-attention rows (Plane #81),
  // all others collapse into the compact All-documents grid. No destinations removed.
  const documents = [
    {
      name: 'Lease Contracts',
      icon: 'document-text-outline',
      type: 'active-leases',
      info: `${dashboardData.documents.activeLeases} Active`,
    },
    {
      name: 'Invoices',
      icon: 'cash-outline',
      type: 'recent-invoices',
      info: `${dashboardData.documents.recentInvoices} Total`,
    },
    {
      name: 'Vendor Quotes',
      icon: 'clipboard-outline',
      type: 'pending-quotes',
      info: `${dashboardData.documents.pendingQuotes} For Review`,
      attention: dashboardData.documents.pendingQuotes > 0,
    },
    { name: 'Tax Reports', icon: 'calculator-outline', type: 'tax', info: 'SARS ITR12' },
    {
      name: 'Compliance',
      icon: 'shield-checkmark-outline',
      type: 'compliance',
      info: 'FICA + COC',
    },
    { name: 'Deposits', icon: 'wallet-outline', type: 'deposits', info: 'Interest + Refunds' },
    {
      name: 'Holding Deposits',
      icon: 'lock-closed-outline',
      type: 'holding-deposit',
      info: `${dashboardData.documents.holdingDepositsActive} Active`,
      attention: dashboardData.documents.holdingDepositsActive > 0,
    },
    { name: 'Lease Renewals', icon: 'refresh-outline', type: 'renewals', info: 'CPA Notices' },
    { name: 'Insurance', icon: 'umbrella-outline', type: 'insurance', info: 'Claims Tracker' },
    {
      name: 'Disputes',
      icon: 'alert-circle-outline',
      type: 'payment-disputes',
      info:
        dashboardData.openDisputes > 0 ? `${dashboardData.openDisputes} Open` : 'Payment Queries',
      attention: dashboardData.openDisputes > 0,
    },
    {
      name: 'Applications',
      icon: 'people-outline',
      type: 'applications',
      info:
        dashboardData.applicants.length > 0
          ? `${dashboardData.applicants.length} Recent`
          : 'Review & Compare',
      attention: dashboardData.applicants.length > 0,
    },
    { name: 'Inspections', icon: 'search-outline', type: 'inspections', info: 'Move-In / Out' },
    { name: 'Statements', icon: 'bar-chart-outline', type: 'statements', info: 'Monthly Income' },
  ];

  // ─── Above-fold primary CTA (Plane #81) ────────────────────────────────────
  // One clear action, adaptive: the highest-priority urgent item wins, otherwise
  // default to growing the portfolio. All destinations kept — this is a focus
  // surface, not a new screen.
  const primaryAction = (() => {
    if (dashboardData.pendingClosures > 0) {
      return {
        label: 'Approve Job Closures',
        sub: `${dashboardData.pendingClosures} pending review`,
        icon: 'checkmark-done-circle-outline' as const,
        route: '/(owner)/maintenance' as const,
      };
    }
    if (pendingViewingsCount > 0) {
      return {
        label: 'Review Viewing Requests',
        sub: `${pendingViewingsCount} awaiting response`,
        icon: 'calendar-outline' as const,
        route: '/(owner)/viewings' as const,
      };
    }
    if (dashboardData.openDisputes > 0) {
      return {
        label: 'Resolve Payment Disputes',
        sub: `${dashboardData.openDisputes} open`,
        icon: 'shield-half-outline' as const,
        route: '/(owner)/payment-disputes' as const,
      };
    }
    if (dashboardData.pendingTerminations > 0) {
      return {
        label: 'Review Early Terminations',
        sub: `${dashboardData.pendingTerminations} pending`,
        icon: 'alert-circle-outline' as const,
        route: '/(owner)/early-termination' as const,
      };
    }
    if (dashboardData.processingPayments > 0) {
      return {
        label: 'Confirm Tenant Payments',
        sub: `${dashboardData.processingPayments} awaiting confirmation`,
        icon: 'hourglass-outline' as const,
        route: '/(owner)/rent-roll' as const,
      };
    }
    return {
      label: 'Add a Property',
      sub: 'Grow your portfolio',
      icon: 'add-circle-outline' as const,
      route: '/(owner)/add-property' as const,
    };
  })();

  // ─── Needs-attention hub (Plane #81) ───────────────────────────────────────
  // The individual urgent alert cards consolidate into one hub card. Each row
  // keeps its exact destination — nothing is dropped. `count` carries the real
  // item count per row so the badge totals actual urgent items (not categories).
  const attentionItems: {
    key: string;
    icon: string;
    color: string;
    bg: string;
    title: string;
    sub: string;
    route: any;
    count: number;
  }[] = [];
  if (dashboardData.pendingTerminations > 0) {
    attentionItems.push({
      key: 'terminations',
      icon: 'alert-circle',
      color: '#DC2626',
      bg: '#FEF2F2',
      title: `${dashboardData.pendingTerminations} Early Termination${
        dashboardData.pendingTerminations === 1 ? '' : 's'
      } Pending`,
      sub: 'CPA s14 — Tenant statutory right to exit',
      route: '/(owner)/early-termination',
      count: dashboardData.pendingTerminations,
    });
  }
  if (dashboardData.openDisputes > 0) {
    attentionItems.push({
      key: 'disputes',
      icon: 'shield-half-outline',
      color: '#7C3AED',
      bg: '#F5F3FF',
      title: `${dashboardData.openDisputes} Payment Dispute${
        dashboardData.openDisputes > 1 ? 's' : ''
      } Open`,
      sub: 'Tenants have raised payment queries',
      route: '/(owner)/payment-disputes',
      count: dashboardData.openDisputes,
    });
  }
  if (dashboardData.pendingClosures > 0) {
    attentionItems.push({
      key: 'closures',
      icon: 'checkmark-done-circle',
      color: '#007A4D',
      bg: '#F0FDF4',
      title: `${dashboardData.pendingClosures} Job Closure${
        dashboardData.pendingClosures > 1 ? 's' : ''
      } Pending Review`,
      sub: 'Vendors completed work — approve closure',
      route: '/(owner)/maintenance',
      count: dashboardData.pendingClosures,
    });
  }
  if (dashboardData.processingPayments > 0) {
    attentionItems.push({
      key: 'processing-payments',
      icon: 'hourglass-outline',
      color: '#7C3AED',
      bg: '#F5F3FF',
      title: `${dashboardData.processingPayments} Payment${
        dashboardData.processingPayments > 1 ? 's' : ''
      } Awaiting Confirmation`,
      sub: 'Tenants submitted payment — confirm receipt',
      route: '/(owner)/rent-roll',
      count: dashboardData.processingPayments,
    });
  }
  if (pendingAlternativesCount > 0 && pendingViewingsCount === 0) {
    attentionItems.push({
      key: 'alternatives',
      icon: 'swap-horizontal-outline',
      color: '#0369A1',
      bg: '#E0F2FE',
      title: `${pendingAlternativesCount} Viewing${
        pendingAlternativesCount > 1 ? 's' : ''
      } — Alternatives Offered`,
      sub: 'Waiting for tenant to choose a new time slot',
      route: '/(owner)/viewings',
      count: pendingAlternativesCount,
    });
  }
  if (pendingViewingsCount > 0) {
    attentionItems.push({
      key: 'viewings',
      icon: 'calendar-outline',
      color: '#B45309',
      bg: '#FFF3E0',
      title: `${pendingViewingsCount} Viewing${pendingViewingsCount === 1 ? '' : 's'} Awaiting Response`,
      sub: 'Tenants are waiting — approve or suggest a new time',
      route: '/(owner)/viewings',
      count: pendingViewingsCount,
    });
  }
  const attentionTotal = attentionItems.reduce((sum, item) => sum + item.count, 0);

  // Success state - render dashboard with real data
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View>
              <Text style={styles.headerTitle}>Portfolio Dashboard</Text>
              <Text style={styles.headerSubtitle}>Welcome back, {dashboardData.userName}</Text>
              <Text style={styles.headerSubtitle} testID="owner-autopilot-copy">
                Autopilot routes jobs, chases quotes, escalates overdue rent, and reminds viewings.
                Ask Lala to run it now. You still accept quotes and pay.
              </Text>
            </View>
            <FeaturePin
              pinId="owner-dashboard-priority"
              title="Your dashboard, at a glance"
              message="The highlighted action card is what needs you most right now (approve closures, review viewings, confirm payments). 'Needs Attention' lists everything waiting on you. Tap any row to jump straight to it."
              aiRoute="/(owner)/ai-chat"
              aiPrompt="What needs my attention on my dashboard?"
            />
          </View>
          {/* Always-visible Messages entry (Plane #72 parity with tenant). The
              Messages section below only renders when threads exist, so without
              this button the screen is unreachable from the dashboard. */}
          <View style={styles.headerActions}>
            <AnimatedButton
              testID="owner-messages-button"
              accessibilityLabel="Messages"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/(owner)/messages' as any);
              }}
            >
              <View style={styles.notificationInner}>
                <Ionicons name="chatbubbles-outline" size={24} color="#111827" />
                {totalUnreadMessages > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                    </Text>
                  </View>
                )}
              </View>
            </AnimatedButton>
            <AnimatedButton
              testID="notification-bell"
              accessibilityLabel="Notifications"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.push('/(owner)/notifications' as any);
              }}
            >
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
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handlePullToRefresh}
              tintColor="#002395"
            />
          }
        >
          {/* Portfolio Card - Real Data */}
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <PortfolioCard {...dashboardData.portfolio} userName={dashboardData.userName} />
          </Animated.View>

          {/* Above-fold primary CTA (Plane #81) — one adaptive action. Reads as a
              single "next step" hero, distinct from the Needs-attention list. */}
          <Animated.View entering={FadeInDown.delay(140).duration(400)}>
            <TouchableOpacity
              style={styles.primaryCtaCard}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(primaryAction.route as any);
              }}
              activeOpacity={0.85}
              testID="owner-primary-action"
              accessibilityLabel={`Next step: ${primaryAction.label}`}
            >
              <View style={styles.primaryCtaIcon}>
                <Ionicons name={primaryAction.icon} size={24} color="#002395" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.primaryCtaEyebrow}>YOUR NEXT STEP</Text>
                <Text style={styles.primaryCtaTitle}>{primaryAction.label}</Text>
                <Text style={styles.primaryCtaSub}>{primaryAction.sub}</Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={26} color="#002395" />
            </TouchableOpacity>
          </Animated.View>

          {/* Needs-attention hub (Plane #81) — one card, every destination kept.
              Frames as the FULL list, so it complements (not duplicates) the
              single next-step CTA above. */}
          {attentionItems.length > 0 && (
            <Animated.View entering={FadeInDown.delay(155).duration(400)}>
              <View style={styles.attentionHub}>
                <View style={styles.attentionHubHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.attentionHubTitle}>Needs Attention</Text>
                    <Text style={styles.attentionHubSub}>Everything waiting on you</Text>
                  </View>
                  <View style={styles.attentionHubBadge}>
                    <Text style={styles.attentionHubBadgeText}>
                      {attentionTotal > 99 ? '99+' : attentionTotal}
                    </Text>
                  </View>
                </View>
                {attentionItems.map((item, index) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.attentionRow,
                      index < attentionItems.length - 1 && styles.attentionRowBorder,
                    ]}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.attentionRowIcon, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attentionRowTitle}>{item.title}</Text>
                      <Text style={styles.attentionRowSub}>{item.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Recently Cancelled Viewings */}
          {recentCancellations.length > 0 && (
            <Animated.View entering={FadeInDown.delay(170).duration(400)}>
              {recentCancellations.map((c: any) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.cancellationCard}
                  onPress={() =>
                    router.push({ pathname: '/(owner)/viewings/[id]' as any, params: { id: c.id } })
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="information-circle" size={22} color="#6B7280" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cancellationText}>
                      {(c.tenant as any)?.full_name ?? 'A tenant'} cancelled their viewing for{' '}
                      {(c.property as any)?.title ?? 'a property'}
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
