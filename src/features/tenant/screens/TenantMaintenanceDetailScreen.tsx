import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getMaintenanceRequestById, getProgressUpdates } from '@/src/features/maintenance/api';
import { getClosureReport } from '@/src/features/maintenance/api/work/workClosure.api';
import { MediaGallery } from '@/src/features/maintenance/components/MediaGallery';
import { colors } from '@/src/shared/theme/colors';
import TenantProgressTracker from '@/src/features/tenant/components/TenantProgressTracker';

const RSA = { green: '#007A4D', gold: '#FFB81C' }; // Tenant primary: RSA Green

const STATUS_CONFIG = {
  open: { label: 'Open', color: colors.error[500], icon: 'alert-circle' },
  assigned: { label: 'Assigned', color: colors.warning[500], icon: 'person' },
  in_progress: { label: 'In Progress', color: colors.info[500], icon: 'time' },
  completed: { label: 'Completed', color: colors.success[500], icon: 'checkmark-circle' },
  closed: { label: 'Closed', color: colors.gray[500], icon: 'archive' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low Priority', color: colors.success[500], icon: 'arrow-down-circle' },
  medium: { label: 'Medium Priority', color: colors.warning[500], icon: 'remove-circle' },
  high: { label: 'High Priority', color: colors.error[500], icon: 'arrow-up-circle' },
};

// 8-Step Workflow Statuses
const MMS_STATUS_CONFIG: Record<string, { label: string; step: number }> = {
  notification: { label: 'Request Submitted', step: 1 },
  acknowledged: { label: 'Acknowledged by Landlord', step: 2 },
  vendor_routed: { label: 'Vendors Notified', step: 3 },
  quoting: { label: 'Vendors Quoting', step: 3 },
  quote_received: { label: 'Quotes Received', step: 4 },
  po_issued: { label: 'Vendor Assigned', step: 5 },
  in_progress: { label: 'Work in Progress', step: 6 },
  completed: { label: 'Work Completed', step: 7 },
};

export default function TenantMaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<any>(null);
  const [progressUpdates, setProgressUpdates] = useState<any[]>([]);
  const [closureReport, setClosureReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Refetch data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (id) {
        fetchRequest();
      }
    }, [id])
  );

  const fetchRequest = async () => {
    try {
      setLoading(true);

      // Fetch main request with all joined data
      const data = await getMaintenanceRequestById(id);
      setRequest(data);

      // Fetch progress updates
      const updates = await getProgressUpdates(id);
      setProgressUpdates(updates || []);

      // Fetch closure report if closure requested
      if (data.closure_requested_at) {
        const closure = await getClosureReport(id);
        setClosureReport(closure);
      }
    } catch (error: any) {
      console.error('Error fetching request:', error);
      Alert.alert('Error', 'Failed to load maintenance request');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maintenance Request</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
          <Text style={styles.loadingText}>Loading request...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Maintenance Request</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Request Not Found</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG];
  const mmsStatus = request.mms_status ? MMS_STATUS_CONFIG[request.mms_status] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Status & Priority */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.statusSection}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={20} color="#FFFFFF" />
            <Text style={styles.statusText}>{statusConfig.label}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: priorityConfig.color }]}>
            <Ionicons name={priorityConfig.icon as any} size={18} color="#FFFFFF" />
            <Text style={styles.priorityText}>{priorityConfig.label}</Text>
          </View>
        </Animated.View>

        {/* Title & Description */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.card}>
          <Text style={styles.cardTitle}>Issue Details</Text>
          <Text style={styles.requestTitle}>{request.title}</Text>
          <Text style={styles.requestDescription}>{request.description}</Text>

          {/* Meta Info */}
          <View style={styles.metaSection}>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              <Text style={styles.metaText}>Reported {formatDate(request.created_at)}</Text>
            </View>
            {request.category && (
              <View style={styles.metaRow}>
                <Ionicons name="pricetag-outline" size={16} color="#6b7280" />
                <Text style={styles.metaText}>{request.category.name}</Text>
              </View>
            )}
            {request.property && (
              <View style={styles.metaRow}>
                <Ionicons name="home-outline" size={16} color="#6b7280" />
                <Text style={styles.metaText}>{request.property.title}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Photos */}
        {request.images && request.images.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.card}>
            <Text style={styles.cardTitle}>Photos</Text>
            <MediaGallery images={request.images} />
          </Animated.View>
        )}

        {/* Simplified Progress Tracker */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)}>
          <TenantProgressTracker request={request} closureReport={closureReport} />
        </Animated.View>

        {/* Verify Work Button - Show when tenant verification pending */}
        {closureReport?.tenant_verification_status === 'pending_tenant' && (
          <Animated.View entering={FadeInDown.delay(450).duration(500)}>
            <TouchableOpacity
              style={styles.verifyWorkButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push({
                  pathname: '/(tenant)/maintenance/verify',
                  params: {
                    requestId: id,
                    completionNotes: closureReport.completion_notes || '',
                    completionPhotos: JSON.stringify(closureReport.completion_photos || []),
                  },
                });
              }}
            >
              <Ionicons name="checkmark-done-circle" size={24} color="#FFFFFF" />
              <View style={styles.verifyWorkTextContainer}>
                <Text style={styles.verifyWorkTitle}>Verify Completed Work</Text>
                <Text style={styles.verifyWorkSubtitle}>
                  Please confirm the work is satisfactory
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Vendor Information */}
        {request.assigned_vendor && (
          <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.card}>
            <Text style={styles.cardTitle}>Assigned Vendor</Text>
            <View style={styles.vendorCard}>
              <View style={styles.vendorIcon}>
                <Ionicons name="construct" size={24} color={RSA.green} />
              </View>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>
                  {request.assigned_vendor.company_name || request.assigned_vendor.full_name}
                </Text>
                {request.assigned_vendor.phone && (
                  <View style={styles.vendorContact}>
                    <Ionicons name="call-outline" size={14} color="#6b7280" />
                    <Text style={styles.vendorPhone}>{request.assigned_vendor.phone}</Text>
                  </View>
                )}
                {request.assigned_vendor.email && (
                  <View style={styles.vendorContact}>
                    <Ionicons name="mail-outline" size={14} color="#6b7280" />
                    <Text style={styles.vendorEmail}>{request.assigned_vendor.email}</Text>
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        )}

        {/* Progress Updates */}
        {progressUpdates.length > 0 && (
          <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.card}>
            <Text style={styles.cardTitle}>Progress Updates</Text>
            {progressUpdates.map((update, index) => (
              <View key={update.id} style={[styles.updateCard, index > 0 && styles.updateCardMargin]}>
                <View style={styles.updateHeader}>
                  <Text style={styles.updateDate}>{formatDate(update.created_at)}</Text>
                </View>
                <Text style={styles.updateNote}>{update.notes}</Text>
                {update.photos && update.photos.length > 0 && (
                  <View style={styles.updatePhotos}>
                    <MediaGallery images={update.photos} />
                  </View>
                )}
              </View>
            ))}
          </Animated.View>
        )}

        {/* Help Section */}
        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={styles.helpCard}>
          <Ionicons name="information-circle" size={24} color={RSA.green} />
          <View style={styles.helpContent}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpText}>
              If you have questions about this request, you can contact your landlord through the Messages tab.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorIcon: { fontSize: 64, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 24 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: RSA.green, borderRadius: 8 },
  retryButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  statusSection: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  statusText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  priorityText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  card: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  requestTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8 },
  requestDescription: { fontSize: 15, color: '#4b5563', lineHeight: 22, marginBottom: 16 },
  metaSection: { gap: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontSize: 14, color: '#6b7280' },
  timeline: { gap: 0 },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  timelineDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  timelineDotActive: { backgroundColor: RSA.green },
  timelineDotCurrent: { backgroundColor: RSA.green },
  timelineContent: { flex: 1, paddingTop: 6 },
  timelineLabel: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  timelineLabelActive: { color: '#111827' },
  currentStepHint: { fontSize: 12, color: RSA.green, fontWeight: '700', marginTop: 2 },
  vendorCard: { flexDirection: 'row', gap: 12, padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 },
  vendorIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e7f5ee', justifyContent: 'center', alignItems: 'center' },
  vendorInfo: { flex: 1, gap: 4 },
  vendorName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  vendorContact: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vendorPhone: { fontSize: 13, color: '#6b7280' },
  vendorEmail: { fontSize: 13, color: '#6b7280' },
  updateCard: { padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 },
  updateCardMargin: { marginTop: 12 },
  updateHeader: { marginBottom: 8 },
  updateDate: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  updateNote: { fontSize: 14, color: '#111827', lineHeight: 20, marginBottom: 8 },
  updatePhotos: { marginTop: 8 },
  helpCard: { flexDirection: 'row', gap: 12, backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' },
  helpContent: { flex: 1 },
  helpTitle: { fontSize: 14, fontWeight: '700', color: RSA.green, marginBottom: 4 },
  helpText: { fontSize: 13, color: '#1e40af', lineHeight: 18 },
  verifyWorkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyWorkTextContainer: {
    flex: 1,
  },
  verifyWorkTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  verifyWorkSubtitle: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 2,
  },
});
