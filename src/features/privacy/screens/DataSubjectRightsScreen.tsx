/**
 * Data Subject Rights Screen
 *
 * POPIA s23-24: Access, correction, and deletion of personal information.
 * Users can submit DSARs and track their status.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import {
  dataSubjectRightsApi,
  type DataAccessRequest,
  type DataCorrectionRequest,
  type DataDeletionRequest,
  type UserDataExport,
} from '../api';

type Tab = 'access' | 'correction' | 'deletion';

export default function DataSubjectRightsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('access');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [accessRequests, setAccessRequests] = useState<DataAccessRequest[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<DataCorrectionRequest[]>([]);
  const [deletionRequests, setDeletionRequests] = useState<DataDeletionRequest[]>([]);

  const [exportedData, setExportedData] = useState<UserDataExport | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formDescription, setFormDescription] = useState('');
  const [correctionField, setCorrectionField] = useState('');
  const [correctionValue, setCorrectionValue] = useState('');
  const [deletionReason, setDeletionReason] = useState('');

  useEffect(() => {
    initUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchData();
    }, [userId])
  );

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      fetchDataForUser(user.id);
    }
  };

  const fetchData = () => {
    if (userId) fetchDataForUser(userId);
  };

  const fetchDataForUser = async (uid: string) => {
    try {
      setLoading(true);
      const summary = await dataSubjectRightsApi.getDSARSummary(uid);
      setAccessRequests(summary.accessRequests);
      setCorrectionRequests(summary.correctionRequests);
      setDeletionRequests(summary.deletionRequests);
    } catch (err) {
      console.error('Error fetching DSAR data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAccessRequest = async () => {
    if (!userId) return;
    setSubmitting(true);
    try {
      await dataSubjectRightsApi.submitAccessRequest(userId, 'access', formDescription || undefined);
      const data = await dataSubjectRightsApi.generateUserDataExport(userId);
      setExportedData(data);
      Alert.alert(
        'Data Export Ready',
        'Your data access request has been submitted and your data export is ready below. You can share it as JSON.'
      );
      setShowForm(false);
      setFormDescription('');
      await fetchDataForUser(userId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleShareExport = async () => {
    if (!exportedData) return;
    try {
      await Share.share({
        message: JSON.stringify(exportedData, null, 2),
        title: 'My Lalarente Data Export',
      });
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  const handleSubmitCorrectionRequest = async () => {
    if (!userId || !correctionField || !correctionValue) return;
    setSubmitting(true);
    try {
      await dataSubjectRightsApi.submitCorrectionRequest(
        userId,
        correctionField,
        null,
        correctionValue,
        formDescription || undefined
      );
      Alert.alert('Request Submitted', 'Your data correction request has been submitted for review.');
      setShowForm(false);
      setCorrectionField('');
      setCorrectionValue('');
      setFormDescription('');
      await fetchDataForUser(userId);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDeletionRequest = async () => {
    if (!userId) return;

    Alert.alert(
      'Confirm Deletion Request',
      'This will request deletion of your marketing-related data. Data required by law (leases, payments) will be retained per legal obligations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit Request',
          style: 'destructive',
          onPress: async () => {
            setSubmitting(true);
            try {
              await dataSubjectRightsApi.submitDeletionRequest(
                userId,
                'marketing',
                deletionReason || undefined
              );
              Alert.alert('Request Submitted', 'Your data deletion request has been submitted for review.');
              setShowForm(false);
              setDeletionReason('');
              await fetchDataForUser(userId);
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to submit request');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return colors.success[500];
      case 'pending': return colors.warning[500];
      case 'processing': case 'under_review': return colors.info[500];
      case 'rejected': case 'overdue': return colors.error[500];
      default: return colors.gray[500];
    }
  };

  const renderRequestList = () => {
    let requests: Array<{ id: string; status: string; created_at: string; label: string }> = [];

    if (activeTab === 'access') {
      requests = accessRequests.map((r) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        label: `Data ${r.request_type} request`,
      }));
    } else if (activeTab === 'correction') {
      requests = correctionRequests.map((r) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        label: `Correct: ${r.field_name}`,
      }));
    } else {
      requests = deletionRequests.map((r) => ({
        id: r.id,
        status: r.status,
        created_at: r.created_at,
        label: `Delete: ${r.scope} data`,
      }));
    }

    if (requests.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>No requests yet</Text>
        </View>
      );
    }

    return requests.map((req) => (
      <View key={req.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <Text style={styles.requestLabel}>{req.label}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(req.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(req.status) }]}>
              {req.status.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>
        <Text style={styles.requestDate}>
          Submitted: {new Date(req.created_at).toLocaleDateString('en-ZA')}
        </Text>
      </View>
    ));
  };

  const renderForm = () => {
    if (!showForm) return null;

    return (
      <View style={styles.formCard}>
        {activeTab === 'access' && (
          <>
            <Text style={styles.formLabel}>What data would you like to access? (optional)</Text>
            <TextInput
              style={styles.input}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="e.g., All personal data, payment history..."
              placeholderTextColor={colors.text.tertiary}
              multiline
            />
            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleSubmitAccessRequest}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Access Request</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'correction' && (
          <>
            <Text style={styles.formLabel}>Field to correct</Text>
            <TextInput
              style={styles.input}
              value={correctionField}
              onChangeText={setCorrectionField}
              placeholder="e.g., full_name, email, phone"
              placeholderTextColor={colors.text.tertiary}
            />
            <Text style={styles.formLabel}>Correct value</Text>
            <TextInput
              style={styles.input}
              value={correctionValue}
              onChangeText={setCorrectionValue}
              placeholder="Enter the correct value"
              placeholderTextColor={colors.text.tertiary}
            />
            <Text style={styles.formLabel}>Justification (optional)</Text>
            <TextInput
              style={styles.input}
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder="Why is this correction needed?"
              placeholderTextColor={colors.text.tertiary}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitButton, (!correctionField || !correctionValue) && styles.submitButtonDisabled]}
              onPress={handleSubmitCorrectionRequest}
              disabled={submitting || !correctionField || !correctionValue}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Correction Request</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {activeTab === 'deletion' && (
          <>
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color={colors.warning[600]} />
              <Text style={styles.warningText}>
                Certain data (active leases, payment records, tax-related data) must be retained
                per legal obligations and cannot be deleted.
              </Text>
            </View>
            <Text style={styles.formLabel}>Reason for deletion (optional)</Text>
            <TextInput
              style={styles.input}
              value={deletionReason}
              onChangeText={setDeletionReason}
              placeholder="Why do you want this data deleted?"
              placeholderTextColor={colors.text.tertiary}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitButton, styles.submitButtonDanger]}
              onPress={handleSubmitDeletionRequest}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Deletion Request</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Subject Rights</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['access', 'correction', 'deletion'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => { setActiveTab(tab); setShowForm(false); }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* New Request Button */}
        <TouchableOpacity
          style={styles.newRequestButton}
          onPress={() => setShowForm(!showForm)}
        >
          <Ionicons name={showForm ? 'close' : 'add-circle-outline'} size={20} color={colors.primary[500]} />
          <Text style={styles.newRequestText}>
            {showForm ? 'Cancel' : `New ${activeTab} request`}
          </Text>
        </TouchableOpacity>

        {renderForm()}

        {/* Data Export Summary */}
        {exportedData && activeTab === 'access' && (
          <View style={styles.exportCard}>
            <View style={styles.exportHeader}>
              <Ionicons name="cloud-download-outline" size={22} color={colors.primary[500]} />
              <Text style={styles.exportTitle}>Your Data Export</Text>
            </View>
            <Text style={styles.exportDate}>
              Generated: {new Date(exportedData.exportedAt).toLocaleString('en-ZA')}
            </Text>
            {[
              { label: 'Profile', icon: 'person-outline' as const, count: exportedData.profile ? 1 : 0 },
              { label: 'Consents', icon: 'shield-checkmark-outline' as const, count: exportedData.consents.length },
              { label: 'Leases', icon: 'document-text-outline' as const, count: exportedData.leases.length },
              { label: 'Payments', icon: 'card-outline' as const, count: exportedData.payments.length },
              { label: 'Applications', icon: 'paper-plane-outline' as const, count: exportedData.applications.length },
              { label: 'Maintenance', icon: 'hammer-outline' as const, count: exportedData.maintenanceRequests.length },
              { label: 'Messages', icon: 'chatbubble-outline' as const, count: exportedData.messages.length },
              { label: 'Viewings', icon: 'eye-outline' as const, count: exportedData.viewings.length },
            ].map((item) => (
              <View key={item.label} style={styles.exportRow}>
                <Ionicons name={item.icon} size={16} color={colors.text.secondary} />
                <Text style={styles.exportRowLabel}>{item.label}</Text>
                <Text style={styles.exportRowCount}>{item.count} record{item.count !== 1 ? 's' : ''}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.shareButton} onPress={handleShareExport}>
              <Ionicons name="share-outline" size={18} color={colors.text.inverse} />
              <Text style={styles.shareButtonText}>Share as JSON</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Request History */}
        <Text style={styles.sectionTitle}>Request History</Text>
        {renderRequestList()}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
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
    color: colors.text.primary,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.default,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary[500],
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tabTextActive: {
    color: colors.text.inverse,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  newRequestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary[500],
    borderStyle: 'dashed',
    marginBottom: 16,
    gap: 8,
  },
  newRequestText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary[500],
  },
  formCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 44,
  },
  submitButton: {
    backgroundColor: colors.primary[500],
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  submitButtonDanger: {
    backgroundColor: colors.error[500],
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warning[50],
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: colors.warning[700],
    lineHeight: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  requestCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  requestLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  requestDate: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.tertiary,
    marginTop: 12,
  },
  exportCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  exportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  exportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  exportDate: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 12,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  exportRowLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
  },
  exportRowCount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
    gap: 6,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.inverse,
  },
});
