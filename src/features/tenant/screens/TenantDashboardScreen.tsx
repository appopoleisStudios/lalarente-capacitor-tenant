import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { paymentsApi } from '../../properties/api/paymentsApi';
import { messagesApi } from '../../messaging/api/messagesApi';
import { colors } from '@/src/shared/theme/colors';

const getMaintenanceStatusStyle = (status: string) => {
  switch (status) {
    case 'open': return { backgroundColor: colors.warning[50] };
    case 'assigned': return { backgroundColor: colors.info[50] };
    case 'in_progress': return { backgroundColor: colors.warning[50] };
    case 'completed': return { backgroundColor: colors.primary[50] };
    default: return { backgroundColor: colors.background.secondary };
  }
};

export default function TenantDashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Tenant');
  const [activeLease, setActiveLease] = useState<any>(null);
  const [nextPayment, setNextPayment] = useState<any>(null);
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<any[]>([]);
  const [upcomingViewings, setUpcomingViewings] = useState<any[]>([]);
  const [pendingApplications, setPendingApplications] = useState<any[]>([]);
  const [messageThreads, setMessageThreads] = useState<any[]>([]);
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState({
    identity: false,
    income: false,
    references: false,
  });

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        setUserName(profile.full_name || 'Tenant');
      }

      // Get active or pending lease
      const { data: lease } = await supabase
        .from('leases')
        .select(`
          *,
          property:properties!property_id(id, title, address, city, rent_amount),
          owner:profiles!owner_id(id, full_name, phone, email)
        `)
        .eq('tenant_id', user.id)
        .in('status', ['active', 'pending_tenant_signature', 'pending_owner_signature'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveLease(lease ?? null);

      // Get upcoming payment
      const payments = await paymentsApi.getTenantPayments(user.id);
      const upcoming = payments.find(p => p.status === 'pending');
      setNextPayment(upcoming ?? null);

      const recent = payments.filter(p => p.status === 'completed').slice(0, 3);
      setRecentPayments(recent);

      // Get active maintenance requests
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', user.id)
        .in('status', ['open', 'assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(3);

      setMaintenanceRequests(maintenance ?? []);

      // Get upcoming viewings (approved or pending, future dates)
      const { data: viewings } = await supabase
        .from('viewing_requests')
        .select(`
          id, proposed_date, status, message,
          property:properties!property_id(id, title, address)
        `)
        .eq('tenant_id', user.id)
        .in('status', ['approved', 'pending'])
        .gte('proposed_date', new Date().toISOString())
        .order('proposed_date', { ascending: true })
        .limit(3);

      setUpcomingViewings(viewings ?? []);

      // Get pending applications
      const { data: apps } = await supabase
        .from('rental_applications')
        .select(`
          id, status, created_at,
          property:properties!property_id(id, title)
        `)
        .eq('tenant_id', user.id)
        .in('status', ['submitted', 'under_review', 'pending_verification'])
        .order('created_at', { ascending: false })
        .limit(3);

      setPendingApplications(apps ?? []);

      // Get unread message threads
      const threads = await messagesApi.getUserThreads(user.id, 'tenant');
      const sorted = [...threads].sort((a, b) => {
        const aUnread = a.unread_count_tenant ?? 0;
        const bUnread = b.unread_count_tenant ?? 0;
        if (bUnread !== aUnread) return bUnread - aUnread;
        return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime();
      });
      const unreadTotal = threads.reduce((sum, t) => sum + (t.unread_count_tenant ?? 0), 0);
      setTotalUnreadMessages(unreadTotal);
      setMessageThreads(sorted.slice(0, 3).map(t => ({
        id: t.id,
        owner_name: (t as any).owner?.full_name ?? 'Landlord',
        subject: t.subject,
        unread_count: t.unread_count_tenant ?? 0,
        last_message_at: t.last_message_at,
        category: t.category,
      })));

      // Check verification status from latest application
      const { data: latestApp } = await supabase
        .from('rental_applications')
        .select('identity_verification_status, id_document_url, proof_of_income_urls, reference_urls')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestApp) {
        setVerificationStatus({
          identity: latestApp.identity_verification_status === 'verified',
          income: (latestApp.proof_of_income_urls?.length || 0) > 0,
          references: (latestApp.reference_urls?.length || 0) > 0,
        });
      }

    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.rsa.green} />
        </View>
      </SafeAreaView>
    );
  }

  const notificationCount = maintenanceRequests.length
    + (nextPayment ? 1 : 0)
    + (activeLease?.status === 'pending_tenant_signature' ? 1 : 0)
    + totalUnreadMessages;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity
            style={styles.notificationButton}
            onPress={() => {
              if (totalUnreadMessages > 0) {
                router.push('/(tenant)/messages' as any);
              } else if (activeLease?.status === 'pending_tenant_signature') {
                router.push('/(tenant)/lease' as any);
              } else if (nextPayment) {
                router.push('/(tenant)/payments' as any);
              } else if (maintenanceRequests.length > 0) {
                router.push('/(tenant)/maintenance' as any);
              }
            }}
          >
            <Ionicons name="notifications-outline" size={24} color={colors.text.primary} />
            {notificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{notificationCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Verification Status */}
          {(!verificationStatus.identity || !verificationStatus.income || !verificationStatus.references) && (
            <View style={styles.section}>
              <View style={styles.verificationCard}>
                <View style={styles.verificationHeader}>
                  <Ionicons name="shield-checkmark" size={24} color={colors.warning[500]} />
                  <Text style={styles.verificationTitle}>Complete Your Profile</Text>
                </View>
                <Text style={styles.verificationSubtext}>
                  Verify your documents to speed up future applications
                </Text>
                <View style={styles.verificationItems}>
                  {[
                    { label: 'Identity Verification', done: verificationStatus.identity },
                    { label: 'Proof of Income', done: verificationStatus.income },
                    { label: 'References', done: verificationStatus.references },
                  ].map(item => (
                    <View key={item.label} style={styles.verificationItem}>
                      <Ionicons
                        name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={item.done ? colors.primary[500] : colors.gray[300]}
                      />
                      <Text style={styles.verificationItemText}>{item.label}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.verificationButton}
                  onPress={() => router.push('/(tenant)/documents' as any)}
                >
                  <Text style={styles.verificationButtonText}>Complete Verification</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Pending Signature Alert */}
          {activeLease?.status === 'pending_tenant_signature' && (
            <View style={styles.section}>
              <View style={styles.signatureAlertCard}>
                <View style={styles.signatureAlertHeader}>
                  <Ionicons name="document-text" size={32} color={colors.warning[500]} />
                  <View style={styles.signatureAlertInfo}>
                    <Text style={styles.signatureAlertTitle}>Lease Agreement Ready!</Text>
                    <Text style={styles.signatureAlertSubtext}>
                      Your lease for {activeLease.property?.title} is ready for signature
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.signatureAlertButton}
                  onPress={() => router.push('/(tenant)/lease' as any)}
                >
                  <Ionicons name="create" size={20} color={colors.text.inverse} />
                  <Text style={styles.signatureAlertButtonText}>Sign Lease Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Active Lease Card */}
          {activeLease ? (
            <LinearGradient colors={[colors.rsa.green, '#005A3A']} style={styles.leaseCard}>
              <View style={styles.leaseHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="home" size={24} color={colors.text.inverse} />
                </View>
                <View style={styles.leaseInfo}>
                  <Text style={styles.leaseTitle}>Current Home</Text>
                  <Text style={styles.propertyName}>{activeLease.property?.title}</Text>
                  <Text style={styles.propertyAddress}>{activeLease.property?.address}</Text>
                </View>
              </View>
              <View style={styles.leaseDetails}>
                <View style={styles.leaseDetailItem}>
                  <Text style={styles.leaseDetailLabel}>Monthly Rent</Text>
                  <Text style={styles.leaseDetailValue}>
                    R {(activeLease.monthly_rent || 0).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.leaseDetailItem}>
                  <Text style={styles.leaseDetailLabel}>Lease Ends</Text>
                  <Text style={styles.leaseDetailValue}>
                    {new Date(activeLease.end_date).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.viewLeaseButton}
                onPress={() => router.push('/(tenant)/lease' as any)}
              >
                <Text style={styles.viewLeaseButtonText}>View Lease Details</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.rsa.green} />
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <View style={styles.noLeaseCard}>
              <Ionicons name="home-outline" size={48} color={colors.gray[300]} />
              <Text style={styles.noLeaseText}>No Active Lease</Text>
              <Text style={styles.noLeaseSubtext}>Start searching for your next home</Text>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => router.push('/(tenant)/search' as any)}
              >
                <Text style={styles.searchButtonText}>Search Properties</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Lease Renewal Alert — shown when < 120 days to expiry */}
          {activeLease && activeLease.end_date && (() => {
            const days = Math.ceil((new Date(activeLease.end_date).getTime() - Date.now()) / 86400000);
            if (days > 0 && days <= 120) {
              return (
                <View style={styles.section}>
                  <TouchableOpacity
                    style={[
                      styles.renewalAlertCard,
                      days <= 40 && styles.renewalAlertUrgent,
                    ]}
                    onPress={() => router.push('/(tenant)/lease-renewal' as any)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.renewalAlertLeft}>
                      <Ionicons
                        name="calendar-outline"
                        size={28}
                        color={days <= 40 ? colors.rsa.red : '#D97706'}
                      />
                      <View>
                        <Text style={[styles.renewalAlertTitle, days <= 40 && { color: colors.rsa.red }]}>
                          Lease Expiry in {days} days
                        </Text>
                        <Text style={styles.renewalAlertSub}>
                          {days <= 40
                            ? 'Respond now — CPA deadline approaching'
                            : 'Review renewal options with your landlord'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
                  </TouchableOpacity>
                </View>
              );
            }
            return null;
          })()}

          {/* Deposit Status — shown when active lease has a deposit */}
          {activeLease && (activeLease.deposit_amount || 0) > 0 && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.depositCard}
                onPress={() => router.push('/(tenant)/deposit' as any)}
                activeOpacity={0.8}
              >
                <View style={styles.depositLeft}>
                  <Ionicons name="wallet" size={24} color={colors.rsa.green} />
                  <View>
                    <Text style={styles.depositTitle}>Security Deposit</Text>
                    <Text style={styles.depositSub}>
                      R {((activeLease.deposit_amount || 0) + (activeLease.deposit_total_interest || 0)).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {(activeLease.deposit_total_interest || 0) > 0
                        ? ` (incl. R ${(activeLease.deposit_total_interest || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} interest)`
                        : ' held in trust'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Upcoming Viewings */}
          {upcomingViewings.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Upcoming Viewings</Text>
                <TouchableOpacity onPress={() => router.push('/(tenant)/viewings' as any)}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              {upcomingViewings.map(viewing => (
                <TouchableOpacity
                  key={viewing.id}
                  style={styles.viewingCard}
                  onPress={() => router.push(`/(tenant)/viewings/${viewing.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.viewingIcon, { backgroundColor: colors.info[50] }]}>
                    <Ionicons name="calendar" size={20} color={colors.info[500]} />
                  </View>
                  <View style={styles.viewingInfo}>
                    <Text style={styles.viewingProperty} numberOfLines={1}>
                      {viewing.property?.title || 'Property'}
                    </Text>
                    <Text style={styles.viewingDate}>
                      {new Date(viewing.proposed_date).toLocaleDateString('en-ZA', {
                        weekday: 'short', day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <View style={[
                    styles.viewingStatusBadge,
                    {
                      backgroundColor: viewing.status === 'approved'
                        ? colors.primary[50]
                        : colors.warning[50],
                    },
                  ]}>
                    <Text style={[
                      styles.viewingStatusText,
                      {
                        color: viewing.status === 'approved'
                          ? colors.primary[500]
                          : colors.warning[500],
                      },
                    ]}>
                      {viewing.status === 'approved' ? 'Confirmed' : 'Pending'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Pending Applications */}
          {pendingApplications.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>My Applications</Text>
                <TouchableOpacity onPress={() => router.push('/(tenant)/search' as any)}>
                  <Text style={styles.seeAllText}>Search More</Text>
                </TouchableOpacity>
              </View>
              {pendingApplications.map(app => (
                <TouchableOpacity
                  key={app.id}
                  style={styles.applicationCard}
                  onPress={() => router.push(`/(tenant)/applications/${app.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.applicationIcon, { backgroundColor: colors.primary[50] }]}>
                    <Ionicons name="document-text" size={20} color={colors.primary[500]} />
                  </View>
                  <View style={styles.applicationInfo}>
                    <Text style={styles.applicationProperty} numberOfLines={1}>
                      {app.property?.title || 'Property'}
                    </Text>
                    <Text style={styles.applicationDate}>
                      Applied {new Date(app.created_at).toLocaleDateString('en-ZA')}
                    </Text>
                  </View>
                  <View style={styles.applicationStatusBadge}>
                    <Text style={styles.applicationStatusText}>
                      {app.status.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Messages Section */}
          {messageThreads.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.sectionTitle}>Messages</Text>
                  {totalUnreadMessages > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>
                        {totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => router.push('/(tenant)/messages' as any)}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              {messageThreads.map(thread => (
                <TouchableOpacity
                  key={thread.id}
                  style={[styles.messageCard, thread.unread_count > 0 && styles.messageCardUnread]}
                  onPress={() => router.push(`/(tenant)/messages/${thread.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.messageIcon, { backgroundColor: colors.rsa.green + '20' }]}>
                    <Ionicons name="chatbubble-outline" size={20} color={colors.rsa.green} />
                  </View>
                  <View style={styles.messageInfo}>
                    <Text style={[styles.messageSender, thread.unread_count > 0 && styles.messageBold]} numberOfLines={1}>
                      {thread.owner_name}
                    </Text>
                    <Text style={[styles.messageSubject, thread.unread_count > 0 && styles.messageBold]} numberOfLines={1}>
                      {thread.subject}
                    </Text>
                  </View>
                  {thread.unread_count > 0 && (
                    <View style={styles.messageUnreadDot}>
                      <Text style={styles.messageUnreadText}>
                        {thread.unread_count > 99 ? '99+' : thread.unread_count}
                      </Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Active Maintenance Requests */}
          {maintenanceRequests.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Active Maintenance</Text>
                <TouchableOpacity onPress={() => router.push('/(tenant)/maintenance' as any)}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              {maintenanceRequests.map((request, index) => (
                <TouchableOpacity
                  key={request.id || index}
                  style={styles.maintenanceCard}
                  onPress={() => router.push(`/(tenant)/maintenance/${request.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.maintenanceIcon, { backgroundColor: colors.warning[50] }]}>
                    <Ionicons name="construct" size={20} color={colors.warning[500]} />
                  </View>
                  <View style={styles.maintenanceInfo}>
                    <Text style={styles.maintenanceTitle}>{request.title || 'Maintenance Request'}</Text>
                    <Text style={styles.maintenanceDate}>
                      {new Date(request.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={[styles.maintenanceStatus, getMaintenanceStatusStyle(request.status)]}>
                    <Text style={styles.maintenanceStatusText}>{request.status}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Documents Center */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Documents</Text>
            <View style={styles.documentsGrid}>
              <TouchableOpacity
                style={styles.documentCard}
                onPress={() => router.push('/(tenant)/lease' as any)}
              >
                <View style={[styles.documentIcon, { backgroundColor: colors.info[50] }]}>
                  <Ionicons name="document-text" size={24} color={colors.info[500]} />
                </View>
                <Text style={styles.documentText}>Lease</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.documentCard}
                onPress={() => router.push('/(tenant)/payments' as any)}
              >
                <View style={[styles.documentIcon, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name="receipt" size={24} color={colors.primary[500]} />
                </View>
                <Text style={styles.documentText}>Receipts</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.documentCard}
                onPress={() => router.push('/(tenant)/documents' as any)}
              >
                <View style={[styles.documentIcon, { backgroundColor: colors.warning[50] }]}>
                  <Ionicons name="card" size={24} color={colors.warning[500]} />
                </View>
                <Text style={styles.documentText}>ID Docs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.documentCard}
                onPress={() => router.push('/(tenant)/reports' as any)}
              >
                <View style={[styles.documentIcon, { backgroundColor: colors.rsa.blue + '15' }]}>
                  <Ionicons name="hammer" size={24} color={colors.rsa.blue} />
                </View>
                <Text style={styles.documentText}>Reports</Text>
              </TouchableOpacity>

              {activeLease && (activeLease.deposit_amount || 0) > 0 && (
                <TouchableOpacity
                  style={styles.documentCard}
                  onPress={() => router.push('/(tenant)/deposit' as any)}
                >
                  <View style={[styles.documentIcon, { backgroundColor: colors.rsa.green + '15' }]}>
                    <Ionicons name="wallet" size={24} color={colors.rsa.green} />
                  </View>
                  <Text style={styles.documentText}>Deposit</Text>
                </TouchableOpacity>
              )}

              {activeLease && (() => {
                const days = activeLease.end_date
                  ? Math.ceil((new Date(activeLease.end_date).getTime() - Date.now()) / 86400000)
                  : null;
                if (!days || days > 120) return null;
                return (
                  <TouchableOpacity
                    style={styles.documentCard}
                    onPress={() => router.push('/(tenant)/lease-renewal' as any)}
                  >
                    <View style={[styles.documentIcon, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="refresh-circle" size={24} color="#D97706" />
                    </View>
                    <Text style={styles.documentText}>Renewal</Text>
                  </TouchableOpacity>
                );
              })()}
            </View>
          </View>

          {/* Recent Activity Feed */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityFeed}>
              {nextPayment && (
                <TouchableOpacity
                  style={styles.activityItem}
                  onPress={() => router.push('/(tenant)/payments' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityDot, { backgroundColor: colors.warning[500] }]} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>Payment due</Text>
                    <Text style={styles.activityTime}>
                      {new Date(nextPayment.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
              {recentPayments.length > 0 && (
                <TouchableOpacity
                  style={styles.activityItem}
                  onPress={() => router.push('/(tenant)/payments' as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityDot, { backgroundColor: colors.primary[500] }]} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>Payment received</Text>
                    <Text style={styles.activityTime}>
                      {new Date(recentPayments[0].paid_date!).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
              {maintenanceRequests.length > 0 && (
                <TouchableOpacity
                  style={styles.activityItem}
                  onPress={() => router.push(`/(tenant)/maintenance/${maintenanceRequests[0].id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.activityDot, { backgroundColor: colors.info[500] }]} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>Maintenance request active</Text>
                    <Text style={styles.activityTime}>
                      {new Date(maintenanceRequests[0].created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              )}
              {!nextPayment && recentPayments.length === 0 && maintenanceRequests.length === 0 && (
                <View style={styles.activityEmpty}>
                  <Text style={styles.activityEmptyText}>No recent activity</Text>
                </View>
              )}
            </View>
          </View>

          {/* Next Payment Card */}
          {nextPayment && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Next Payment</Text>
              <View style={styles.paymentCard}>
                <View style={styles.paymentHeader}>
                  <View style={[styles.paymentIcon, { backgroundColor: colors.warning[50] }]}>
                    <Ionicons name="calendar" size={24} color={colors.warning[500]} />
                  </View>
                  <View style={styles.paymentInfo}>
                    <Text style={styles.paymentType}>Rent Payment</Text>
                    <Text style={styles.paymentDate}>
                      Due: {new Date(nextPayment.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.paymentAmount}>
                    R {nextPayment.amount.toLocaleString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => router.push('/(tenant)/payments' as any)}
                >
                  <Text style={styles.payButtonText}>Pay Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tenant)/search' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary[50] }]}>
                  <Ionicons name="search" size={24} color={colors.rsa.green} />
                </View>
                <Text style={styles.actionText}>Search</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tenant)/payments' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.info[50] }]}>
                  <Ionicons name="card" size={24} color={colors.rsa.blue} />
                </View>
                <Text style={styles.actionText}>Payments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tenant)/maintenance' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.warning[50] }]}>
                  <Ionicons name="construct" size={24} color={colors.warning[500]} />
                </View>
                <Text style={styles.actionText}>Maintenance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tenant)/messages' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.rsa.green + '15' }]}>
                  <Ionicons name="chatbubbles" size={24} color={colors.rsa.green} />
                </View>
                <Text style={styles.actionText}>Messages</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Payments */}
          {recentPayments.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Payments</Text>
                <TouchableOpacity onPress={() => router.push('/(tenant)/payments' as any)}>
                  <Text style={styles.seeAllText}>See All</Text>
                </TouchableOpacity>
              </View>
              {recentPayments.map((payment, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.paymentHistoryCard}
                  onPress={() => router.push('/(tenant)/payments' as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.paymentHistoryIcon}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary[500]} />
                  </View>
                  <View style={styles.paymentHistoryInfo}>
                    <Text style={styles.paymentHistoryType}>{payment.type}</Text>
                    <Text style={styles.paymentHistoryDate}>
                      {new Date(payment.paid_date!).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.paymentHistoryAmount}>
                    R {payment.amount.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Contact Landlord */}
          {activeLease?.owner && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Contact Landlord</Text>
              <View style={styles.contactCard}>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{activeLease.owner.full_name}</Text>
                  {activeLease.owner.phone && (
                    <Text style={styles.contactDetail}>📱 {activeLease.owner.phone}</Text>
                  )}
                  {activeLease.owner.email && (
                    <Text style={styles.contactDetail}>📧 {activeLease.owner.email}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.messageButton}
                  onPress={() => router.push('/(tenant)/messages' as any)}
                >
                  <Ionicons name="chatbubble" size={20} color={colors.rsa.blue} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background.default,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.background.default,
  },
  greeting: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.error[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.text.inverse,
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  leaseCard: {
    margin: 16,
    borderRadius: 16,
    padding: 20,
  },
  leaseHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  leaseInfo: {
    flex: 1,
  },
  leaseTitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  propertyName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.inverse,
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  leaseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  leaseDetailItem: {},
  leaseDetailLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  leaseDetailValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  viewLeaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.default,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  viewLeaseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.rsa.green,
  },
  noLeaseCard: {
    margin: 16,
    padding: 32,
    backgroundColor: colors.background.default,
    borderRadius: 16,
    alignItems: 'center',
  },
  noLeaseText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
  },
  noLeaseSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 8,
    marginBottom: 20,
  },
  searchButton: {
    backgroundColor: colors.rsa.green,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  searchButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  verificationCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  verificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  verificationSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  verificationItems: {
    gap: 12,
    marginBottom: 16,
  },
  verificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  verificationItemText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  verificationButton: {
    backgroundColor: colors.warning[500],
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  verificationButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  viewingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  viewingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  viewingInfo: {
    flex: 1,
  },
  viewingProperty: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  viewingDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  viewingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewingStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  applicationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  applicationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  applicationInfo: {
    flex: 1,
  },
  applicationProperty: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  applicationDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  applicationStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.warning[50],
  },
  applicationStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.warning[500],
    textTransform: 'capitalize',
  },
  maintenanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  maintenanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  maintenanceInfo: {
    flex: 1,
  },
  maintenanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  maintenanceDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  maintenanceStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  maintenanceStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
    textTransform: 'capitalize',
  },
  documentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  documentCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  documentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  documentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  activityFeed: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  activityEmpty: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  activityEmptyText: {
    fontSize: 14,
    color: colors.text.tertiary,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.rsa.blue,
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  paymentDate: {
    fontSize: 14,
    color: colors.text.secondary,
    marginTop: 4,
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  payButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  payButtonText: {
    color: colors.text.inverse,
    fontSize: 14,
    fontWeight: '600',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  paymentHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  paymentHistoryIcon: {
    marginRight: 12,
  },
  paymentHistoryInfo: {
    flex: 1,
  },
  paymentHistoryType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    textTransform: 'capitalize',
  },
  paymentHistoryDate: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  paymentHistoryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 8,
  },
  contactDetail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.info[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewalAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    gap: 12,
  },
  renewalAlertUrgent: {
    backgroundColor: '#FEF2F2',
    borderLeftColor: colors.rsa.red,
  },
  renewalAlertLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  renewalAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  renewalAlertSub: {
    fontSize: 12,
    color: '#78350F',
    lineHeight: 16,
  },
  depositCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.rsa.green,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  depositLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  depositTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  depositSub: {
    fontSize: 12,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  signatureAlertCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning[500],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signatureAlertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 16,
  },
  signatureAlertInfo: {
    flex: 1,
  },
  signatureAlertTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  signatureAlertSubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  signatureAlertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning[500],
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  signatureAlertButtonText: {
    color: colors.text.inverse,
    fontSize: 16,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.rsa.green,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.inverse,
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  messageCardUnread: {
    backgroundColor: colors.rsa.green + '10',
    borderLeftWidth: 3,
    borderLeftColor: colors.rsa.green,
  },
  messageIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  messageInfo: {
    flex: 1,
  },
  messageSender: {
    fontSize: 14,
    color: colors.text.primary,
  },
  messageSubject: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  messageBold: {
    fontWeight: '700',
  },
  messageUnreadDot: {
    backgroundColor: colors.rsa.green,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    marginRight: 6,
  },
  messageUnreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.inverse,
  },
});
