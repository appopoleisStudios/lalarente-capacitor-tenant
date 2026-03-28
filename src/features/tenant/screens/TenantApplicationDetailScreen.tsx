import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { applicationsApi, ApplicationWithRelations } from '../../properties/api/applicationsApi';

const RSA = { green: '#007A4D', blue: '#002395' };

export default function TenantApplicationDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [application, setApplication] = useState<ApplicationWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadApplication();
    }
  }, [id]);

  const loadApplication = async () => {
    try {
      setError(null);
      const data = await applicationsApi.getApplication(id);
      console.log('📋 Application data:', data);
      console.log('❌ Rejection reason:', (data as any).rejection_reason);
      setApplication(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    Alert.alert(
      'Withdraw Application',
      'Are you sure you want to withdraw this application? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              await applicationsApi.updateApplication(id, { status: 'withdrawn' } as any);
              Alert.alert('Success', 'Application withdrawn', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err) {
              Alert.alert('Error', 'Failed to withdraw application');
            }
          },
        },
      ]
    );
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

  const getStatusColor = () => {
    switch (application.status) {
      case 'submitted':
        return '#2196F3';
      case 'under_review':
        return '#FF9800';
      case 'approved':
        return '#4CAF50';
      case 'rejected':
        return '#F44336';
      default:
        return '#757575';
    }
  };

  const affordabilityPercentage = application.affordability_ratio
    ? (application.affordability_ratio * 100).toFixed(1)
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Application</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView}>
          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{application.status.toUpperCase()}</Text>
          </View>

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

          {/* Timeline */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.card}>
              <TimelineItem
                icon="paper-plane"
                label="Submitted"
                date={new Date(application.submitted_at || application.created_at!).toLocaleString()}
                completed
              />
              {application.reviewed_at && (
                <TimelineItem
                  icon="eye"
                  label="Under Review"
                  date={new Date(application.reviewed_at).toLocaleString()}
                  completed
                />
              )}
              {application.approved_at && (
                <TimelineItem
                  icon="checkmark-circle"
                  label="Approved"
                  date={new Date(application.approved_at).toLocaleString()}
                  completed
                />
              )}
              {application.rejected_at && (
                <TimelineItem
                  icon="close-circle"
                  label="Rejected"
                  date={new Date(application.rejected_at).toLocaleString()}
                  completed
                />
              )}
            </View>
          </View>

          {/* Affordability */}
          {affordabilityPercentage && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Affordability</Text>
              <View style={styles.card}>
                <Text style={styles.affordabilityText}>
                  Rent-to-Income Ratio: {affordabilityPercentage}%
                </Text>
              </View>
            </View>
          )}

          {/* Status Message */}
          <View style={styles.section}>
            <View style={styles.messageCard}>
              <Ionicons 
                name={application.status === 'rejected' ? 'alert-circle' : 'information-circle'} 
                size={24} 
                color={application.status === 'rejected' ? '#F44336' : RSA.blue} 
              />
              <Text style={styles.messageText}>
                {application.status === 'submitted' &&
                  'Your application is waiting for the owner to review.'}
                {application.status === 'under_review' &&
                  'The owner is currently reviewing your application.'}
                {application.status === 'approved' &&
                  'Congratulations! Your application has been approved. The owner will contact you soon to proceed with the lease.'}
                {application.status === 'rejected' &&
                  'Unfortunately, your application was not accepted. You can apply for other properties or reapply for this property after 3 months.'}
              </Text>
            </View>
          </View>

          {/* Rejection Reason */}
          {application.status === 'rejected' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reason for Rejection</Text>
              <View style={[styles.card, styles.rejectionCard]}>
                <Ionicons name="alert-circle" size={24} color="#F44336" style={{ marginBottom: 8 }} />
                <Text style={styles.rejectionText}>
                  {(application as any).rejection_reason || 'No specific reason provided by the owner.'}
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Button */}
        {(application.status === 'submitted' || application.status === 'under_review') && (
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.withdrawButton} onPress={handleWithdraw}>
              <Text style={styles.withdrawButtonText}>Withdraw Application</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const TimelineItem = ({
  icon,
  label,
  date,
  completed,
}: {
  icon: any;
  label: string;
  date: string;
  completed: boolean;
}) => (
  <View style={styles.timelineItem}>
    <View style={[styles.timelineIcon, completed && styles.timelineIconCompleted]}>
      <Ionicons name={icon} size={20} color={completed ? '#FFF' : '#999'} />
    </View>
    <View style={styles.timelineContent}>
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={styles.timelineDate}>{date}</Text>
    </View>
  </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  statusBanner: {
    padding: 16,
    alignItems: 'center',
  },
  statusText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
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
    color: RSA.green,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineIconCompleted: {
    backgroundColor: RSA.green,
  },
  timelineContent: {
    flex: 1,
  },
  timelineLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: 14,
    color: '#666',
  },
  affordabilityText: {
    fontSize: 16,
    color: '#333',
  },
  messageCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  actionBar: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  withdrawButton: {
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#F44336',
    alignItems: 'center',
  },
  withdrawButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectionCard: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  rejectionText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
});
