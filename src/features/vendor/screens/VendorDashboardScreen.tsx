import { useAuth } from '@/src/contexts/AuthContext';
import {
  getVendorAvailableRequests,
  getVendorMyJobs,
  type VendorMaintenanceRequest,
} from '@/src/features/maintenance/api';
import { messagesApi } from '@/src/features/messaging/api/messagesApi';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface DashboardStats {
  availableRequests: number;
  pendingQuotes: number;
  activeJobs: number;
  completedJobs: number;
}

interface ActivityItem {
  id: string;
  type: 'quote_accepted' | 'new_request' | 'po_issued' | 'job_started';
  title: string;
  subtitle: string;
  timestamp: Date;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  requestId: string;
  poId?: string | null;
}

interface UpcomingWork {
  id: string;
  title: string;
  property: string;
  date: string;
  status: string;
}

export default function VendorDashboardScreen() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    availableRequests: 0,
    pendingQuotes: 0,
    activeJobs: 0,
    completedJobs: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [upcomingWork, setUpcomingWork] = useState<UpcomingWork[]>([]);
  const [messageThreads, setMessageThreads] = useState<any[]>([]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = async () => {
    if (!user?.id) return;

    try {
      // Fetch ALL available requests (no status filter to see everything vendor has access to)
      const allRequests = await getVendorAvailableRequests(user.id);

      console.log('All available requests for vendor:', allRequests.length);
      console.log(
        'Request details:',
        allRequests.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          visibility: r.visibility,
          category: r.category?.name,
          hasQuote: !!r.my_quote,
          canQuote: r.can_quote,
        }))
      );

      // Filter for available requests (open status, no quote yet)
      const availableRequests = allRequests.filter((req) => req.status === 'open' && !req.my_quote);

      // Fetch requests with pending quotes (vendor has submitted quote but not accepted)
      const pendingQuotes = allRequests.filter(
        (req) => req.my_quote && req.my_quote.status === 'submitted'
      );

      // Fetch active jobs
      const activeJobs = await getVendorMyJobs(user.id);

      // Calculate completed jobs this month
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const completedThisMonth = allRequests.filter((req) => {
        if (req.status !== 'completed' || !req.completed_date) return false;
        const completedDate = new Date(req.completed_date);
        return completedDate >= firstDayOfMonth;
      });

      setStats({
        availableRequests: availableRequests.length,
        pendingQuotes: pendingQuotes.length,
        activeJobs: activeJobs.length,
        completedJobs: completedThisMonth.length,
      });

      // Generate recent activity from all requests (deduplicate by ID)
      const allRequestsMap = new Map<string, VendorMaintenanceRequest>();
      [...allRequests, ...activeJobs].forEach((req) => {
        allRequestsMap.set(req.id, req);
      });
      const uniqueRequests = Array.from(allRequestsMap.values());
      const activity = generateRecentActivity(uniqueRequests);
      setRecentActivity(activity);

      // Generate upcoming work from active jobs
      const upcoming = generateUpcomingWork(activeJobs);
      setUpcomingWork(upcoming);

      // Messages — recent threads + unread badge (Plane #70 parity)
      const threads = await messagesApi.getUserThreads(user.id, 'vendor');
      const unreadTotal = await messagesApi.getUnreadCount(user.id, 'vendor');
      setMessageThreads(threads.slice(0, 3));
      setTotalUnreadMessages(unreadTotal);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateRecentActivity = (requests: VendorMaintenanceRequest[]): ActivityItem[] => {
    const activities: ActivityItem[] = [];

    // Sort by most recent first
    const sortedRequests = [...requests].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });

    sortedRequests.slice(0, 5).forEach((req) => {
      // Quote accepted
      if (req.my_quote && req.my_quote.status === 'accepted') {
        activities.push({
          id: `quote-${req.id}`,
          type: 'quote_accepted',
          title: 'Quote accepted',
          subtitle: `${req.title} at ${req.property?.address || 'property'}`,
          timestamp: new Date(req.my_quote.created_at),
          icon: 'checkmark-circle',
          iconColor: colors.success[500],
          requestId: req.id,
        });
      }

      // PO issued (when status is assigned)
      if (req.status === 'assigned' && req.selected_vendor_id === user?.id) {
        activities.push({
          id: `po-${req.id}`,
          type: 'po_issued',
          title: 'PO issued',
          subtitle: `${req.title} - Ready to start`,
          timestamp: new Date(req.vendor_routed_at || req.created_at),
          icon: 'document-text',
          iconColor: colors.info[500],
          requestId: req.id,
          poId: req.po_id,
        });
      }

      // Job started
      if (req.status === 'in_progress') {
        activities.push({
          id: `job-${req.id}`,
          type: 'job_started',
          title: 'Job in progress',
          subtitle: req.title,
          timestamp: new Date(req.vendor_routed_at || req.created_at),
          icon: 'hammer',
          iconColor: colors.primary[500],
          requestId: req.id,
        });
      }

      // New request available
      if (req.status === 'open' && !req.my_quote) {
        activities.push({
          id: `new-${req.id}`,
          type: 'new_request',
          title: 'New request available',
          subtitle: `${req.category?.name || 'Maintenance'} - ${req.property?.city || 'Unknown'}`,
          timestamp: new Date(req.created_at),
          icon: 'notifications',
          iconColor: colors.warning[500],
          requestId: req.id,
        });
      }
    });

    // Sort by timestamp and return top 5
    return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
  };

  const generateUpcomingWork = (jobs: VendorMaintenanceRequest[]): UpcomingWork[] => {
    return jobs
      .filter((job) => job.status === 'assigned' || job.status === 'in_progress')
      .slice(0, 3)
      .map((job) => ({
        id: job.id,
        title: job.title,
        property: job.property?.address || 'Unknown property',
        date: formatUpcomingDate(job.vendor_routed_at || job.created_at),
        status: job.status === 'assigned' ? 'Scheduled' : 'In Progress',
      }));
  };

  const formatUpcomingDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' });
    }
  };

  const formatActivityTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.businessName}>{profile?.full_name || 'Vendor'}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              testID="vendor-messages-button"
              accessibilityLabel="Messages"
              accessibilityRole="button"
              style={styles.notificationBell}
              onPress={() => router.push('/(vendor)/messages')}
            >
              <Ionicons name="chatbubbles-outline" size={24} color={colors.text.primary} />
              {totalUnreadMessages > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              testID="notification-bell"
              style={styles.notificationBell}
              onPress={() => router.push('/(vendor)/notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
            </Pressable>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <StatCard
              icon="list"
              iconColor={colors.info[500]}
              count={stats.availableRequests}
              label="Available"
              backgroundColor={colors.info[50]}
              onPress={() => router.push('/(vendor)/maintenance')}
            />
            <StatCard
              icon="document-text"
              iconColor={colors.warning[500]}
              count={stats.pendingQuotes}
              label="Quotes"
              backgroundColor={colors.warning[50]}
              onPress={() => router.push('/(vendor)/maintenance')}
            />
          </View>
          <View style={styles.statsRow}>
            <StatCard
              icon="hammer"
              iconColor={colors.primary[500]}
              count={stats.activeJobs}
              label="Active"
              backgroundColor={colors.primary[50]}
              onPress={() => router.push('/(vendor)/jobs')}
            />
            <StatCard
              icon="checkmark-circle"
              iconColor={colors.success[500]}
              count={stats.completedJobs}
              label="Completed"
              backgroundColor={colors.success[50]}
              onPress={() => router.push('/(vendor)/jobs?tab=completed')}
            />
          </View>
        </View>

        {/* Quick Actions — messages entry (Plane #70 parity with tenant qa-messages) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
              testID="qa-messages"
              accessibilityLabel="Messages"
              accessibilityRole="button"
              onPress={() => router.push('/(vendor)/messages')}
            >
              <View
                style={[styles.actionIcon, { backgroundColor: colors.role.vendor.primary + '20' }]}
              >
                <Ionicons name="chatbubbles" size={24} color={colors.role.vendor.primary} />
              </View>
              <Text style={styles.actionText}>Messages</Text>
              {totalUnreadMessages > 0 && (
                <View style={styles.actionUnreadBadge}>
                  <Text style={styles.actionUnreadText}>
                    {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
              testID="qa-lala-ai"
              accessibilityLabel="Lala AI"
              accessibilityRole="button"
              onPress={() => router.push('/(vendor)/ai-chat')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.info[50] }]}>
                <Ionicons name="sparkles" size={24} color={colors.info[500]} />
              </View>
              <Text style={styles.actionText}>Lala AI</Text>
            </Pressable>
            {/* Contracts quick action (Plane #83) — the tab was removed from
                the bottom bar (7→6 tabs); Contracts lives here + under Profile. */}
            <Pressable
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
              testID="qa-contracts"
              accessibilityLabel="Contracts"
              accessibilityRole="button"
              onPress={() => router.push('/(vendor)/contracts')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.warning[50] }]}>
                <Ionicons name="document-text" size={24} color={colors.warning[500]} />
              </View>
              <Text style={styles.actionText}>Contracts</Text>
            </Pressable>
          </View>
        </View>

        {/* Messages Section — recent threads (Plane #70 parity) */}
        {messageThreads.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Messages</Text>
              <Pressable onPress={() => router.push('/(vendor)/messages')}>
                <Text style={styles.seeAllText}>See All</Text>
              </Pressable>
            </View>
            <View style={styles.threadList}>
              {messageThreads.map((thread) => {
                const otherParty = thread.owner || thread.tenant;
                return (
                  <Pressable
                    key={thread.id}
                    style={({ pressed }) => [
                      styles.threadCard,
                      pressed && styles.threadCardPressed,
                    ]}
                    onPress={() => router.push(`/(vendor)/messages/${thread.id}`)}
                  >
                    <View
                      style={[
                        styles.threadAvatar,
                        { backgroundColor: colors.role.vendor.primary + '20' },
                      ]}
                    >
                      <Text style={styles.threadAvatarText}>
                        {otherParty?.full_name?.charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                    <View style={styles.threadContent}>
                      <Text style={styles.threadName} numberOfLines={1}>
                        {otherParty?.full_name || 'Unknown'}
                      </Text>
                      <Text style={styles.threadSubject} numberOfLines={1}>
                        {thread.subject}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityContainer}>
              {recentActivity.map((activity, index) => (
                <ActivityCard
                  key={`${activity.id}-${index}`}
                  activity={activity}
                  formatTime={formatActivityTime}
                  onPress={() => {
                    switch (activity.type) {
                      case 'quote_accepted':
                        router.push(`/(vendor)/jobs/${activity.requestId}`);
                        break;
                      case 'po_issued':
                        if (activity.poId) {
                          router.push(
                            `/(vendor)/maintenance/${activity.requestId}/po/${activity.poId}`
                          );
                        } else {
                          router.push(`/(vendor)/jobs/${activity.requestId}`);
                        }
                        break;
                      case 'job_started':
                        router.push(`/(vendor)/jobs/${activity.requestId}`);
                        break;
                      case 'new_request':
                        router.push(`/(vendor)/maintenance/${activity.requestId}`);
                        break;
                    }
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Upcoming Work */}
        {upcomingWork.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Work</Text>
            <View style={styles.upcomingContainer}>
              {upcomingWork.map((work) => (
                <UpcomingWorkCard
                  key={work.id}
                  work={work}
                  onPress={() => router.push(`/(vendor)/maintenance/${work.id}`)}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  count: number;
  label: string;
  backgroundColor: string;
  onPress?: () => void;
}

function StatCard({ icon, iconColor, count, label, backgroundColor, onPress }: StatCardProps) {
  const card = (
    <View style={[styles.statCard, { backgroundColor }]}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor }]}>
        <Ionicons name={icon} size={28} color={colors.rsa.white} />
      </View>
      <Text style={styles.statCount}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        {card}
      </Pressable>
    );
  }
  return card;
}

interface ActivityCardProps {
  activity: ActivityItem;
  formatTime: (date: Date) => string;
  onPress?: () => void;
}

function ActivityCard({ activity, formatTime, onPress }: ActivityCardProps) {
  const card = (
    <View style={styles.activityCard}>
      <View style={[styles.activityIcon, { backgroundColor: activity.iconColor + '20' }]}>
        <Ionicons name={activity.icon} size={20} color={activity.iconColor} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
      </View>
      <Text style={styles.activityTime}>{formatTime(activity.timestamp)}</Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={{ flex: 1 }}>
        {card}
      </Pressable>
    );
  }
  return card;
}

interface UpcomingWorkCardProps {
  work: UpcomingWork;
  onPress: () => void;
}

function UpcomingWorkCard({ work, onPress }: UpcomingWorkCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.upcomingCard, pressed && styles.upcomingCardPressed]}
      onPress={onPress}
    >
      <View style={styles.upcomingContent}>
        <Text style={styles.upcomingTitle}>{work.title}</Text>
        <Text style={styles.upcomingProperty}>{work.property}</Text>
      </View>
      <View style={styles.upcomingRight}>
        <Text style={styles.upcomingDate}>{work.date}</Text>
        <View
          style={[
            styles.upcomingStatusBadge,
            {
              backgroundColor: work.status === 'In Progress' ? colors.primary[50] : colors.info[50],
            },
          ]}
        >
          <Text
            style={[
              styles.upcomingStatusText,
              {
                color: work.status === 'In Progress' ? colors.primary[700] : colors.info[700],
              },
            ]}
          >
            {work.status}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  headerLeft: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationBell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background.default,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: colors.background.default,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  greeting: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  businessName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text.primary,
  },
  statsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statCount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.role.vendor.primary,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.background.default,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  actionCardPressed: {
    backgroundColor: colors.background.tertiary,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  actionUnreadBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.error[500],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  actionUnreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  threadList: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  threadCardPressed: {
    backgroundColor: colors.background.tertiary,
  },
  threadAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  threadAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.role.vendor.primary,
  },
  threadContent: {
    flex: 1,
  },
  threadName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  threadSubject: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: 12,
  },
  activityContainer: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  activityTime: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginLeft: 8,
  },
  upcomingContainer: {
    gap: 12,
  },
  upcomingCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upcomingCardPressed: {
    backgroundColor: colors.background.tertiary,
  },
  upcomingContent: {
    flex: 1,
  },
  upcomingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  upcomingProperty: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  upcomingRight: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  upcomingDate: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  upcomingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  upcomingStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
