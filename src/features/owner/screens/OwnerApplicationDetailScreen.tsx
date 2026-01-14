import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { applicationsApi, ApplicationWithRelations } from '../../properties/api/applicationsApi';

export default function OwnerApplicationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLease, setHasLease] = useState(false);

  useEffect(() => {
    if (id) {
      loadApplication();
    }
  }, [id]);

  const loadApplication = async () => {
    try {
      setError(null);
      const data = await applicationsApi.getApplication(id);
      setApplication(data);
      
      // Check if a lease already exists for this application
      const { data: existingLease } = await supabase
        .from('leases')
        .select('id')
        .eq('application_id', id)
        .single();
      
      setHasLease(!!existingLease);
      
      // Auto-transition from 'submitted' to 'under_review' when owner views it
      if (data.status === 'submitted') {
        console.log('📋 Auto-transitioning application to under_review');
        await applicationsApi.updateApplication(id, { status: 'under_review' } as any);
        // Reload to get updated status
        const updatedData = await applicationsApi.getApplication(id);
        setApplication(updatedData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    Alert.alert(
      'Approve Application',
      'Are you sure you want to approve this application? This will allow you to create a lease.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            try {
              setProcessing(true);
              await applicationsApi.approveApplication(id);
              Alert.alert('Success', 'Application approved successfully', [
                {
                  text: 'Create Lease',
                  onPress: () => router.push(`/(owner)/leases/create?applicationId=${id}` as any),
                },
                { text: 'OK', onPress: loadApplication },
              ]);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve application');
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = async () => {
    Alert.prompt(
      'Reject Application',
      'Please provide a reason for rejection (optional):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async (reason?: string) => {
            try {
              setProcessing(true);
              console.log('❌ Rejecting with reason:', reason);
              await applicationsApi.rejectApplication(id, reason || undefined);
              Alert.alert('Success', 'Application rejected', [{ text: 'OK', onPress: () => router.back() }]);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to reject application');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const openDocument = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open document');
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading application...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !application) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>{error || 'Application not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadApplication}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const affordabilityPercentage = application.affordability_ratio
    ? (application.affordability_ratio * 100).toFixed(1)
    : null;
  const isAffordable = application.affordability_ratio ? application.affordability_ratio <= 0.3 : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Application Details</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Property Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property</Text>
          <View style={styles.card}>
            <Text style={styles.propertyTitle}>{application.property?.title}</Text>
            <Text style={styles.propertyAddress}>{application.property?.address}</Text>
            <Text style={styles.propertyRent}>
              R {application.property?.rent_amount?.toLocaleString()}/month
            </Text>
          </View>
        </View>

        {/* Applicant Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Applicant Information</Text>
          <View style={styles.card}>
            <InfoRow icon="person" label="Full Name" value={application.full_name} />
            <InfoRow icon="mail" label="Email" value={application.email} />
            <InfoRow icon="call" label="Phone" value={application.phone} />
            <InfoRow icon="card" label="ID Number" value={application.id_number} />
            <InfoRow
              icon="calendar"
              label="Date of Birth"
              value={application.date_of_birth ? new Date(application.date_of_birth).toLocaleDateString() : 'N/A'}
            />
          </View>
        </View>

        {/* Employment Info */}
        {application.employer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employment Information</Text>
            <View style={styles.card}>
              <InfoRow icon="business" label="Employer" value={application.employer} />
              {application.position && <InfoRow icon="briefcase" label="Position" value={application.position} />}
              {application.monthly_income && (
                <InfoRow
                  icon="cash"
                  label="Monthly Income"
                  value={`R ${application.monthly_income.toLocaleString()}`}
                />
              )}
              {application.employment_start_date && (
                <InfoRow
                  icon="calendar"
                  label="Employment Start"
                  value={new Date(application.employment_start_date).toLocaleDateString()}
                />
              )}
              {application.employer_contact && (
                <InfoRow icon="call" label="Employer Contact" value={application.employer_contact} />
              )}
            </View>
          </View>
        )}

        {/* Affordability */}
        {affordabilityPercentage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Affordability Assessment</Text>
            <View style={[styles.card, styles.affordabilityCard]}>
              <View style={styles.affordabilityHeader}>
                <Ionicons
                  name={isAffordable ? 'checkmark-circle' : 'warning'}
                  size={32}
                  color={isAffordable ? '#4CAF50' : '#FFA500'}
                />
                <View style={styles.affordabilityInfo}>
                  <Text style={styles.affordabilityPercentage}>{affordabilityPercentage}%</Text>
                  <Text style={styles.affordabilityLabel}>Rent-to-Income Ratio</Text>
                </View>
              </View>
              <Text style={styles.affordabilityNote}>
                {isAffordable
                  ? '✓ Within recommended 30% threshold'
                  : '⚠ Exceeds recommended 30% threshold'}
              </Text>
            </View>
          </View>
        )}

        {/* Screening Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Screening Status</Text>
          <View style={styles.card}>
            <ScreeningRow
              label="Background Check"
              status={application.background_check_status || 'pending'}
            />
            <ScreeningRow
              label="Credit Check"
              status={application.credit_check_status || 'pending'}
            />
            <ScreeningRow
              label="Identity Verification"
              status={application.identity_verification_status || 'pending'}
            />
          </View>
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Documents</Text>
          <View style={styles.card}>
            {application.id_document_url && (
              <DocumentRow
                label="ID Document"
                onPress={() => openDocument(application.id_document_url!)}
              />
            )}
            {application.proof_of_income_urls && application.proof_of_income_urls.length > 0 && (
              <>
                {application.proof_of_income_urls.map((url, index) => (
                  <DocumentRow
                    key={index}
                    label={`Proof of Income ${index + 1}`}
                    onPress={() => openDocument(url)}
                  />
                ))}
              </>
            )}
            {application.reference_urls && application.reference_urls.length > 0 && (
              <>
                {application.reference_urls.map((url, index) => (
                  <DocumentRow
                    key={index}
                    label={`Reference ${index + 1}`}
                    onPress={() => openDocument(url)}
                  />
                ))}
              </>
            )}
            {!application.id_document_url &&
              (!application.proof_of_income_urls || application.proof_of_income_urls.length === 0) &&
              (!application.reference_urls || application.reference_urls.length === 0) && (
                <Text style={styles.noDocuments}>No documents uploaded</Text>
              )}
          </View>
        </View>

        {/* Application Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.card}>
            <InfoRow
              icon="calendar"
              label="Submitted"
              value={new Date(application.submitted_at || application.created_at!).toLocaleString()}
            />
            {application.reviewed_at && (
              <InfoRow
                icon="checkmark-circle"
                label="Reviewed"
                value={new Date(application.reviewed_at).toLocaleString()}
              />
            )}
            {application.approved_at && (
              <InfoRow
                icon="checkmark-done"
                label="Approved"
                value={new Date(application.approved_at).toLocaleString()}
              />
            )}
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      {application.status === 'submitted' || application.status === 'under_review' ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={processing}
          >
            <Ionicons name="close-circle" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={handleApprove}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : application.status === 'approved' && !hasLease ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.createLeaseButton]}
            onPress={() => router.push(`/(owner)/leases/create?applicationId=${id}` as any)}
          >
            <Ionicons name="document-text" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>Create Lease</Text>
          </TouchableOpacity>
        </View>
      ) : application.status === 'approved' && hasLease ? (
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.viewLeaseButton]}
            onPress={async () => {
              // Get the lease ID and navigate to it
              const { data: lease } = await supabase
                .from('leases')
                .select('id')
                .eq('application_id', id)
                .single();
              if (lease) {
                router.push(`/(owner)/leases/${lease.id}` as any);
              }
            }}
          >
            <Ionicons name="eye" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>View Lease</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      </View>
    </SafeAreaView>
  );
}

const InfoRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={20} color="#666" />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const ScreeningRow = ({ label, status }: { label: string; status: string }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
      case 'verified':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      default:
        return '#FFA500';
    }
  };

  return (
    <View style={styles.screeningRow}>
      <Text style={styles.screeningLabel}>{label}</Text>
      <View style={[styles.screeningBadge, { backgroundColor: getStatusColor() }]}>
        <Text style={styles.screeningStatus}>{status}</Text>
      </View>
    </View>
  );
};

const DocumentRow = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.documentRow} onPress={onPress}>
    <Ionicons name="document-text" size={20} color="#007AFF" />
    <Text style={styles.documentLabel}>{label}</Text>
    <Ionicons name="open-outline" size={20} color="#007AFF" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
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
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
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
    marginBottom: 4,
  },
  propertyAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  propertyRent: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
  },
  affordabilityCard: {
    backgroundColor: '#F8F9FA',
  },
  affordabilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 16,
  },
  affordabilityInfo: {
    flex: 1,
  },
  affordabilityPercentage: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
  },
  affordabilityLabel: {
    fontSize: 14,
    color: '#666',
  },
  affordabilityNote: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  screeningRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  screeningLabel: {
    fontSize: 16,
    color: '#333',
  },
  screeningBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  screeningStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  documentLabel: {
    flex: 1,
    fontSize: 16,
    color: '#007AFF',
  },
  noDocuments: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#F44336',
  },
  createLeaseButton: {
    backgroundColor: '#007AFF',
  },
  viewLeaseButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
