import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  Linking,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

const RSA = { green: '#007A4D', gold: '#FFB81C' }; // Tenant colors

interface Lease {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  deposit_amount: number | null;
  payment_due_day: number | null;
  status: string | null;
  lease_type: string | null;
  lease_document_url: string | null;
  owner_signed_at: string | null;
  tenant_signed_at: string | null;
  owner_signature_url: string | null;
  tenant_signature_url: string | null;
  late_fee_amount: number | null;
  late_fee_grace_days: number | null;
  rent_escalation_type: string | null;
  rent_escalation_value: number | null;
  rent_escalation_frequency_months: number | null;
  executed_at: string | null;
  terminated_at: string | null;
  property?: {
    title: string;
    address: string;
    city: string;
  };
  owner?: {
    full_name: string;
    email: string | null;
    phone: string | null;
  };
}

export default function TenantLeaseScreen() {
  const router = useRouter();
  const [lease, setLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActiveLease();
  }, []);

  const loadActiveLease = async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get active lease for tenant
      const { data, error: leaseError } = await supabase
        .from('leases')
        .select(`
          *,
          property:properties!property_id(title, address, city),
          owner:profiles!owner_id(full_name, email, phone)
        `)
        .eq('tenant_id', user.id)
        .eq('status', 'active')
        .single();

      if (leaseError) {
        if (leaseError.code === 'PGRST116') {
          // No active lease found
          setError('no_lease');
        } else {
          throw leaseError;
        }
      } else {
        setLease(data as Lease);
      }
    } catch (err) {
      console.error('Error loading lease:', err);
      setError(err instanceof Error ? err.message : 'Failed to load lease');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = () => {
    if (lease?.lease_document_url) {
      Linking.openURL(lease.lease_document_url).catch(() => {
        Alert.alert('Error', 'Could not open lease document');
      });
    } else {
      Alert.alert('Notice', 'Lease document is not available yet');
    }
  };

  const handleContactOwner = () => {
    if (lease?.owner) {
      Alert.alert(
        'Contact Owner',
        `${lease.owner.full_name}\n${lease.owner.phone || ''}\n${lease.owner.email || ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call', onPress: () => lease.owner?.phone && Linking.openURL(`tel:${lease.owner.phone}`) },
          { text: 'Email', onPress: () => lease.owner?.email && Linking.openURL(`mailto:${lease.owner.email}`) },
        ]
      );
    }
  };

  const getDaysRemaining = () => {
    if (!lease) return 0;
    const endDate = new Date(lease.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getLeaseProgress = () => {
    if (!lease) return 0;
    const startDate = new Date(lease.start_date);
    const endDate = new Date(lease.end_date);
    const today = new Date();
    const total = endDate.getTime() - startDate.getTime();
    const elapsed = today.getTime() - startDate.getTime();
    return Math.min(Math.max((elapsed / total) * 100, 0), 100);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (error === 'no_lease') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={64} color="#CCC" />
          <Text style={styles.noLeaseTitle}>No Active Lease</Text>
          <Text style={styles.noLeaseText}>
            You don't have an active lease yet. Apply for a property to get started.
          </Text>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => router.push('/(tenant)/search')}
          >
            <Text style={styles.searchButtonText}>Search Properties</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !lease) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>{error || 'Failed to load lease'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadActiveLease}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const daysRemaining = getDaysRemaining();
  const progress = getLeaseProgress();
  const isExpiringSoon = daysRemaining <= 60 && daysRemaining > 0;
  const isExpired = daysRemaining <= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Lease</Text>
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Expiry Warning */}
          {isExpiringSoon && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={20} color="#FF9800" />
              <Text style={styles.warningText}>
                Your lease expires in {daysRemaining} days
              </Text>
            </View>
          )}

          {isExpired && (
            <View style={[styles.warningBanner, { backgroundColor: '#FFEBEE' }]}>
              <Ionicons name="alert-circle" size={20} color="#F44336" />
              <Text style={[styles.warningText, { color: '#F44336' }]}>
                Your lease has expired
              </Text>
            </View>
          )}

          {/* Property Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Property</Text>
            <View style={styles.card}>
              <Text style={styles.propertyTitle}>{lease.property?.title}</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.locationText}>
                  {lease.property?.address}, {lease.property?.city}
                </Text>
              </View>
              {lease.owner?.full_name && (
                <View style={styles.ownerRow}>
                  <Ionicons name="person" size={16} color="#666" />
                  <Text style={styles.ownerText}>
                    Owner: {lease.owner.full_name}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Lease Timeline */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lease Period</Text>
            <View style={styles.card}>
              <View style={styles.dateRow}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>
                    {new Date(lease.start_date).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#CCC" />
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={styles.dateValue}>
                    {new Date(lease.end_date).toLocaleDateString()}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired'}
                </Text>
              </View>
            </View>
          </View>

          {/* Financial Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial Details</Text>
            <View style={styles.card}>
              <DetailRow
                icon="cash"
                label="Monthly Rent"
                value={`R ${lease.monthly_rent.toLocaleString()}`}
              />
              {lease.deposit_amount && (
                <DetailRow
                  icon="wallet"
                  label="Deposit Paid"
                  value={`R ${lease.deposit_amount.toLocaleString()}`}
                />
              )}
              {lease.payment_due_day && (
                <DetailRow
                  icon="calendar"
                  label="Payment Due Day"
                  value={`${lease.payment_due_day}${getDaySuffix(lease.payment_due_day)} of each month`}
                />
              )}
              {lease.late_fee_amount && (
                <DetailRow
                  icon="alert-circle"
                  label="Late Payment Fee"
                  value={`R ${lease.late_fee_amount.toLocaleString()}${
                    lease.late_fee_grace_days ? ` (after ${lease.late_fee_grace_days} days)` : ''
                  }`}
                />
              )}
            </View>
          </View>

          {/* Lease Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lease Terms</Text>
            <View style={styles.card}>
              {lease.lease_type && (
                <DetailRow
                  icon="document-text"
                  label="Lease Type"
                  value={lease.lease_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                />
              )}
              {lease.executed_at && (
                <DetailRow
                  icon="checkmark-circle"
                  label="Lease Executed"
                  value={new Date(lease.executed_at).toLocaleDateString()}
                />
              )}
              {lease.rent_escalation_type && lease.rent_escalation_value && (
                <DetailRow
                  icon="trending-up"
                  label="Rent Escalation"
                  value={`${
                    lease.rent_escalation_type === 'percentage'
                      ? `${lease.rent_escalation_value}%`
                      : `R ${lease.rent_escalation_value}`
                  }${
                    lease.rent_escalation_frequency_months
                      ? ` every ${lease.rent_escalation_frequency_months} months`
                      : ''
                  }`}
                />
              )}
            </View>
          </View>

          {/* Lease Document */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lease Document</Text>
            <TouchableOpacity style={styles.documentCard} onPress={handleViewDocument}>
              <View style={styles.documentIcon}>
                <Ionicons name="document-text" size={32} color={RSA.green} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>Lease Agreement</Text>
                <Text style={styles.documentSubtitle}>
                  {lease.lease_document_url ? 'Tap to view' : 'Not available yet'}
                </Text>
              </View>
              {lease.lease_document_url && (
                <Ionicons name="chevron-forward" size={20} color="#CCC" />
              )}
            </TouchableOpacity>
          </View>

          {/* Signatures */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Signatures</Text>
            <View style={styles.card}>
              <SignatureRow
                label="Owner"
                name={lease.owner?.full_name || 'Owner'}
                signedAt={lease.owner_signed_at}
                signatureUrl={lease.owner_signature_url}
              />
              <SignatureRow
                label="Tenant"
                name="You"
                signedAt={lease.tenant_signed_at}
                signatureUrl={lease.tenant_signature_url}
              />
            </View>
          </View>

          {/* Contact Owner */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.contactButton} onPress={handleContactOwner}>
              <Ionicons name="chatbubble-outline" size={20} color={RSA.green} />
              <Text style={styles.contactButtonText}>Contact Owner</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const DetailRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailLeft}>
      <Ionicons name={icon} size={20} color="#666" />
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const SignatureRow = ({
  label,
  name,
  signedAt,
  signatureUrl,
}: {
  label: string;
  name: string;
  signedAt: string | null;
  signatureUrl?: string | null;
}) => (
  <View style={styles.signatureRow}>
    <View style={styles.signatureLeft}>
      <Ionicons
        name={signedAt ? 'checkmark-circle' : 'time-outline'}
        size={20}
        color={signedAt ? RSA.green : '#FFA500'}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.signatureLabel}>{label}</Text>
        <Text style={styles.signatureName}>{name}</Text>
        {signatureUrl && (
          <Image
            source={{ uri: signatureUrl }}
            style={styles.signatureImage}
            resizeMode="contain"
          />
        )}
      </View>
    </View>
    <Text style={[styles.signatureStatus, signedAt && styles.signatureStatusSigned]}>
      {signedAt ? `Signed ${new Date(signedAt).toLocaleDateString()}` : 'Pending'}
    </Text>
  </View>
);

const getDaySuffix = (day: number) => {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
};

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
    padding: 20,
  },
  header: {
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 16,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9800',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  ownerText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: RSA.green,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 16,
  },
  documentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  documentSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  signatureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  signatureLabel: {
    fontSize: 12,
    color: '#999',
  },
  signatureName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  signatureStatus: {
    fontSize: 14,
    color: '#FFA500',
  },
  signatureStatusSigned: {
    color: RSA.green,
  },
  signatureImage: {
    width: 120,
    height: 60,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    backgroundColor: '#FAFAFA',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: RSA.green,
    gap: 8,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: RSA.green,
  },
  noLeaseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noLeaseText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  searchButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: RSA.green,
    borderRadius: 8,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: RSA.green,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
