import { useAuth } from '@/src/contexts/AuthContext';
import {
  approveClosureReport,
  getClosureReport,
  getMaintenanceRequestById,
  getProgressUpdates,
  rejectClosureReport,
} from '@/src/features/maintenance/api';
import { MediaGallery } from '@/src/features/maintenance/components/MediaGallery';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395' };

export default function OwnerClosureApprovalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const abortRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<any>(null);
  const [closureReport, setClosureReport] = useState<any>(null);
  const [progressUpdates, setProgressUpdates] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (id) {
      abortRef.current = new AbortController();
      loadData();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);

      const req = await getMaintenanceRequestById(id);
      if (abortRef.current?.signal.aborted) return;
      setRequest(req);

      const closure = await getClosureReport(id);
      if (abortRef.current?.signal.aborted) return;
      setClosureReport(closure);

      try {
        const updates = await getProgressUpdates(id);
        if (!abortRef.current?.signal.aborted) {
          setProgressUpdates(updates || []);
        }
      } catch {
        setProgressUpdates([]);
      }
    } catch (error: any) {
      console.error('Error loading closure data:', error);
      Alert.alert('Error', error.message || 'Failed to load closure details');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = () => {
    Alert.alert(
      'Approve Job Completion',
      'By approving, you confirm the work has been completed satisfactorily. The job will be marked as completed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve & Complete',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              if (!user?.id) throw new Error('User not authenticated');
              await approveClosureReport(id, user.id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Job marked as completed successfully.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to approve closure');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    setRejectReason('');
    setShowRejectModal(true);
  };

  const submitRejection = async () => {
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert('Reason Required', 'Please explain what needs to be fixed or improved.');
      return;
    }

    try {
      setActionLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowRejectModal(false);

      if (!user?.id) throw new Error('User not authenticated');
      await rejectClosureReport(id, user.id, reason);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Changes Requested', 'The vendor has been notified and can resubmit.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to reject closure');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.blue} />
          <Text style={styles.loadingText}>Loading closure details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vendor = (request as any)?.selected_vendor;
  const progressCount = progressUpdates.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Review Closure</Text>
          <Text style={styles.headerSubtitle}>
            {request?.title?.substring(0, 40)}{request?.title?.length > 40 ? '...' : ''}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        <View style={styles.closureBanner}>
          <Ionicons name="checkmark-done-circle" size={28} color={colors.success[500]} />
          <View style={styles.closureBannerText}>
            <Text style={styles.closureBannerTitle}>Closure Requested</Text>
            <Text style={styles.closureBannerSubtitle}>
              The vendor has completed the work and is requesting approval.
            </Text>
          </View>
        </View>

        {/* Vendor Info */}
        {vendor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vendor</Text>
            <View style={styles.vendorCard}>
              <View style={styles.vendorAvatar}>
                <Ionicons name="business" size={22} color={RSA.blue} />
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>
                  {vendor.full_name || 'Vendor'}
                </Text>
                {vendor.email && (
                  <Text style={styles.vendorContact}>{vendor.email}</Text>
                )}
                {vendor.phone && (
                  <Text style={styles.vendorContact}>{vendor.phone}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Completion Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completion Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesText}>
              {closureReport?.completion_notes || 'No notes provided'}
            </Text>
          </View>
        </View>

        {/* Completion Photos */}
        {closureReport?.completion_photos && closureReport.completion_photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Completion Photos ({closureReport.completion_photos.length})
            </Text>
            <MediaGallery images={closureReport.completion_photos} />
          </View>
        )}

        {/* Progress Timeline Context */}
        {progressCount > 0 && (
          <View style={styles.section}>
            <View style={styles.timelineHeader}>
              <Text style={styles.sectionTitle}>Progress Updates</Text>
              <Text style={styles.timelineCount}>{progressCount} update{progressCount > 1 ? 's' : ''}</Text>
            </View>
            {progressUpdates.slice(0, 5).map((update: any) => (
              <View key={update.id} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineDate}>
                    {new Date(update.update_date || update.created_at).toLocaleDateString('en-ZA', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.timelineNotes} numberOfLines={3}>
                    {update.notes}
                  </Text>
                  {update.photos && update.photos.length > 0 && (
                    <Text style={styles.timelinePhotoCount}>
                      {update.photos.length} photo{update.photos.length > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer Actions — only show for pending closures */}
      <View style={styles.footer}>
        {closureReport?.status === 'pending' ? (
          <>
            <TouchableOpacity
              accessibilityLabel="Request changes from vendor"
              accessibilityRole="button"
              style={[styles.footerButton, styles.rejectButton]}
              onPress={handleReject}
              disabled={actionLoading}
            >
              <Ionicons name="close-circle" size={20} color={colors.error[600]} />
              <Text style={styles.rejectButtonText}>Request Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Approve and complete job"
              accessibilityRole="button"
              style={[styles.footerButton, styles.approveButton]}
              onPress={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.approveButtonText}>Approve & Complete</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.processedBanner}>
            <Ionicons
              name={closureReport?.status === 'approved' ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={closureReport?.status === 'approved' ? colors.success[500] : colors.error[500]}
            />
            <Text style={styles.processedText}>
              {closureReport?.status === 'approved'
                ? 'Closure already approved. This job has been marked as completed.'
                : closureReport?.status === 'rejected'
                ? 'Changes were requested. The vendor has been notified.'
                : 'No closure report available.'}
            </Text>
          </View>
        )}
      </View>

      {/* Rejection Reason Modal */}
      <Modal
        visible={showRejectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRejectModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={24} color={colors.error[500]} />
              <Text style={styles.modalTitle}>Request Changes</Text>
            </View>

            <Text style={styles.modalSubtitle}>
              Explain what needs to be fixed or improved. The vendor will be notified.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Describe what needs to change..."
              placeholderTextColor={colors.gray[400]}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowRejectModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, !rejectReason.trim() && { opacity: 0.5 }]}
                onPress={submitRejection}
                disabled={!rejectReason.trim()}
              >
                <Text style={styles.modalSubmitText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  headerSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  scrollView: { flex: 1 },

  // Closure banner
  closureBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.success[50],
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.success[500],
  },
  closureBannerText: { flex: 1 },
  closureBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.success[700],
    marginBottom: 4,
  },
  closureBannerSubtitle: {
    fontSize: 13,
    color: colors.success[700],
    lineHeight: 18,
  },

  // Sections
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },

  // Vendor card
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  vendorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vendorInfo: { flex: 1 },
  vendorName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  vendorContact: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  // Notes card
  notesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  notesText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },

  // Timeline
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timelineCount: { fontSize: 13, fontWeight: '600', color: colors.gray[500] },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: RSA.blue,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  timelineDate: {
    fontSize: 12,
    fontWeight: '600',
    color: RSA.blue,
    marginBottom: 4,
  },
  timelineNotes: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  timelinePhotoCount: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 4,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderColor: colors.error[500],
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error[600],
  },
  approveButton: {
    backgroundColor: colors.success[500],
    borderColor: colors.success[500],
  },
  approveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  modalInput: {
    minHeight: 100,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    fontSize: 15,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.error[500],
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Processed state banner
  processedBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.gray[50],
    borderRadius: 12,
  },
  processedText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    lineHeight: 20,
  },
});
