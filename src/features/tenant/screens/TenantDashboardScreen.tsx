import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../../lib/supabase';
import { leasesApi } from '../../properties/api/leasesApi';
import { paymentsApi } from '../../properties/api/paymentsApi';

const RSA = { 
  green: '#007A4D',  // RSA Green for tenants
  blue: '#002395',   // RSA Blue
  gold: '#FFB81C',
  red: '#DE3831',
};

const getMaintenanceStatusStyle = (status: string) => {
  switch (status) {
    case 'open':
      return { backgroundColor: '#FFF3E0' };
    case 'assigned':
      return { backgroundColor: '#E3F2FD' };
    case 'in_progress':
      return { backgroundColor: '#FFF9C4' };
    case 'completed':
      return { backgroundColor: '#E8F5E9' };
    default:
      return { backgroundColor: '#F5F5F5' };
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
  const [verificationStatus, setVerificationStatus] = useState({
    identity: false,
    income: false,
    references: false,
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

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
      const { data: leases } = await supabase
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
        .single();

      if (leases) {
        setActiveLease(leases);
      }

      // Get upcoming payment
      const payments = await paymentsApi.getTenantPayments(user.id);
      const upcoming = payments.find(p => p.status === 'pending');
      setNextPayment(upcoming);

      // Get recent payments
      const recent = payments
        .filter(p => p.status === 'completed')
        .slice(0, 3);
      setRecentPayments(recent);

      // Get active maintenance requests
      const { data: maintenance } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('tenant_id', user.id)
        .in('status', ['open', 'assigned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(3);

      if (maintenance) {
        setMaintenanceRequests(maintenance);
      }

      // Check verification status (from profile or applications)
      const { data: applications } = await supabase
        .from('rental_applications')
        .select('identity_verification_status, id_document_url, proof_of_income_urls, reference_urls')
        .eq('tenant_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (applications) {
        setVerificationStatus({
          identity: applications.identity_verification_status === 'verified',
          income: (applications.proof_of_income_urls?.length || 0) > 0,
          references: (applications.reference_urls?.length || 0) > 0,
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
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{userName}</Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>2</Text>
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Verification Status */}
          {(!verificationStatus.identity || !verificationStatus.income || !verificationStatus.references) && (
            <View style={styles.section}>
              <View style={styles.verificationCard}>
                <View style={styles.verificationHeader}>
                  <Ionicons name="shield-checkmark" size={24} color="#FF9800" />
                  <Text style={styles.verificationTitle}>Complete Your Profile</Text>
                </View>
                <Text style={styles.verificationSubtext}>
                  Verify your documents to speed up future applications
                </Text>
                <View style={styles.verificationItems}>
                  <View style={styles.verificationItem}>
                    <Ionicons 
                      name={verificationStatus.identity ? 'checkmark-circle' : 'ellipse-outline'} 
                      size={20} 
                      color={verificationStatus.identity ? '#4CAF50' : '#CCC'} 
                    />
                    <Text style={styles.verificationItemText}>Identity Verification</Text>
                  </View>
                  <View style={styles.verificationItem}>
                    <Ionicons 
                      name={verificationStatus.income ? 'checkmark-circle' : 'ellipse-outline'} 
                      size={20} 
                      color={verificationStatus.income ? '#4CAF50' : '#CCC'} 
                    />
                    <Text style={styles.verificationItemText}>Proof of Income</Text>
                  </View>
                  <View style={styles.verificationItem}>
                    <Ionicons 
                      name={verificationStatus.references ? 'checkmark-circle' : 'ellipse-outline'} 
                      size={20} 
                      color={verificationStatus.references ? '#4CAF50' : '#CCC'} 
                    />
                    <Text style={styles.verificationItemText}>References</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.verificationButton}
                  onPress={() => router.push('/(tenant)/profile' as any)}
                >
                  <Text style={styles.verificationButtonText}>Complete Verification</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Pending Signature Alert */}
          {activeLease && activeLease.status === 'pending_tenant_signature' && (
            <View style={styles.section}>
              <View style={styles.signatureAlertCard}>
                <View style={styles.signatureAlertHeader}>
                  <Ionicons name="document-text" size={32} color="#FF9800" />
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
                  <Ionicons name="create" size={20} color="#FFF" />
                  <Text style={styles.signatureAlertButtonText}>Sign Lease Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Active Lease Card */}
          {activeLease ? (
            <LinearGradient colors={[RSA.green, '#005A3A']} style={styles.leaseCard}>
              <View style={styles.leaseHeader}>
                <View style={styles.iconContainer}>
                  <Ionicons name="home" size={24} color="#FFF" />
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
                <Ionicons name="arrow-forward" size={16} color={RSA.green} />
              </TouchableOpacity>
            </LinearGradient>
          ) : (
            <View style={styles.noLeaseCard}>
              <Ionicons name="home-outline" size={48} color="#CCC" />
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
                <View key={index} style={styles.maintenanceCard}>
                  <View style={[styles.maintenanceIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="construct" size={20} color="#FF9800" />
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
                </View>
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
                <View style={[styles.documentIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="document-text" size={24} color="#2196F3" />
                </View>
                <Text style={styles.documentText}>Lease</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.documentCard}
                onPress={() => router.push('/(tenant)/payments' as any)}
              >
                <View style={[styles.documentIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="receipt" size={24} color="#4CAF50" />
                </View>
                <Text style={styles.documentText}>Receipts</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.documentCard}
                onPress={() => router.push('/(tenant)/profile' as any)}
              >
                <View style={[styles.documentIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="card" size={24} color="#FF9800" />
                </View>
                <Text style={styles.documentText}>ID Docs</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.documentCard}
                onPress={() => router.push('/(tenant)/maintenance' as any)}
              >
                <View style={[styles.documentIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="hammer" size={24} color="#9C27B0" />
                </View>
                <Text style={styles.documentText}>Reports</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Activity Feed */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityFeed}>
              {nextPayment && (
                <View style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: '#FF9800' }]} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>Payment due</Text>
                    <Text style={styles.activityTime}>
                      {new Date(nextPayment.due_date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              )}
              {recentPayments.length > 0 && (
                <View style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: '#4CAF50' }]} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>Payment received</Text>
                    <Text style={styles.activityTime}>
                      {new Date(recentPayments[0].paid_date!).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              )}
              {maintenanceRequests.length > 0 && (
                <View style={styles.activityItem}>
                  <View style={[styles.activityDot, { backgroundColor: '#2196F3' }]} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>Maintenance request submitted</Text>
                    <Text style={styles.activityTime}>
                      {new Date(maintenanceRequests[0].created_at).toLocaleDateString()}
                    </Text>
                  </View>
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
                  <View style={[styles.paymentIcon, { backgroundColor: '#FFF3E0' }]}>
                    <Ionicons name="calendar" size={24} color="#FF9800" />
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
                <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="search" size={24} color={RSA.green} />
                </View>
                <Text style={styles.actionText}>Search</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tenant)/payments' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="card" size={24} color={RSA.blue} />
                </View>
                <Text style={styles.actionText}>Payments</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tenant)/maintenance' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="construct" size={24} color="#FF9800" />
                </View>
                <Text style={styles.actionText}>Maintenance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionCard}
                onPress={() => router.push('/(tenant)/messages' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#F3E5F5' }]}>
                  <Ionicons name="chatbubbles" size={24} color="#9C27B0" />
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
                <View key={index} style={styles.paymentHistoryCard}>
                  <View style={styles.paymentHistoryIcon}>
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
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
                </View>
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
                  <Ionicons name="chatbubble" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
    backgroundColor: '#FFF',
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
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
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
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
    color: '#FFF',
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
    color: '#FFF',
  },
  viewLeaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  viewLeaseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: RSA.green,
  },
  noLeaseCard: {
    margin: 16,
    padding: 32,
    backgroundColor: '#FFF',
    borderRadius: 16,
    alignItems: 'center',
  },
  noLeaseText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  noLeaseSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 20,
  },
  searchButton: {
    backgroundColor: RSA.green,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  verificationCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
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
    color: '#333',
  },
  verificationSubtext: {
    fontSize: 14,
    color: '#666',
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
    color: '#666',
  },
  verificationButton: {
    backgroundColor: '#FF9800',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  verificationButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  maintenanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
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
    color: '#333',
  },
  maintenanceDate: {
    fontSize: 12,
    color: '#666',
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
    color: '#666',
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
    backgroundColor: '#FFF',
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
    color: '#333',
  },
  activityFeed: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
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
    color: '#333',
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  paymentCard: {
    backgroundColor: '#FFF',
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
    color: '#333',
  },
  paymentDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  payButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#FFF',
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
    backgroundColor: '#FFF',
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
    color: '#333',
  },
  paymentHistoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
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
    color: '#333',
    textTransform: 'capitalize',
  },
  paymentHistoryDate: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  paymentHistoryAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  contactDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  messageButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureAlertCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
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
    color: '#333',
    marginBottom: 8,
  },
  signatureAlertSubtext: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  signatureAlertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF9800',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  signatureAlertButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
