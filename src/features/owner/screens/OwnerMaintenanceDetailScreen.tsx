import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { maintenanceApi } from '@/src/features/maintenance/api';
import { MediaGallery } from '@/src/features/maintenance/components/MediaGallery';
import { colors } from '@/src/shared/theme/colors';

const RSA = { green: '#007A4D' };

const STATUS_CONFIG = {
  open: { label: 'Open', color: colors.error[500], icon: 'alert-circle' },
  assigned: { label: 'Assigned', color: colors.warning[500], icon: 'person' },
  in_progress: { label: 'In Progress', color: colors.info[500], icon: 'time' },
  completed: { label: 'Completed', color: colors.success[500], icon: 'checkmark-circle' },
  closed: { label: 'Closed', color: colors.gray[500], icon: 'archive' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: colors.success[500], icon: 'arrow-down-circle' },
  medium: { label: 'Medium', color: colors.warning[500], icon: 'remove-circle' },
  high: { label: 'High', color: colors.error[500], icon: 'arrow-up-circle' },
};

export default function OwnerMaintenanceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRequest();
    }
  }, [id]);

  const fetchRequest = async () => {
    try {
      setLoading(true);
      const data = await maintenanceApi.getMaintenanceRequestById(id);
      setRequest(data);
    } catch (error: any) {
      console.error('Error fetching request:', error);
      Alert.alert('Error', 'Failed to load request details');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async () => {
    try {
      setActionLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await maintenanceApi.acknowledgeRequest(id);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Request acknowledged');
      fetchRequest(); // Refresh
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to acknowledge request');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePushToVendors = () => {
    // Navigate to vendor selection screen (Phase 2)
    Alert.alert('Coming Soon', 'Vendor selection will be available in Phase 2');
  };

  const handleClose = async () => {
    Alert.alert(
      'Close Request',
      'Are you sure you want to close this request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

              await maintenanceApi.closeRequest(id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Refresh the request to show updated status
              fetchRequest();
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to close request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Request',
      'Are you sure you want to delete this request? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

              await maintenanceApi.deleteMaintenanceRequest(id);

              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

              // Navigate to maintenance list
              router.push('/(owner)/maintenance');

              // Show success after navigation
              setTimeout(() => {
                Alert.alert('Deleted', 'Request has been deleted');
              }, 300);
            } catch (error: any) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', error.message || 'Failed to delete request');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!request) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.error[500]} />
          <Text style={styles.errorText}>Request not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.push('/(owner)/maintenance')}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[request.status as keyof typeof STATUS_CONFIG];
  const priorityConfig = PRIORITY_CONFIG[request.priority as keyof typeof PRIORITY_CONFIG];
  const canAcknowledge = request.mms_status === 'notification' && !request.acknowledged_at;
  const canPushToVendors = request.acknowledged_at && !request.vendor_routed_at;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.push('/(owner)/maintenance')} 
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Details</Text>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Actions', 'Choose an action', [
              {
                text: 'Close Request',
                onPress: handleClose,
                style: 'default',
              },
              {
                text: 'Delete Request',
                onPress: handleDelete,
                style: 'destructive',
              },
              { text: 'Cancel', style: 'cancel' },
            ]);
          }}
          style={styles.headerButton}
        >
          <Ionicons name="ellipsis-vertical" size={24} color="#111827" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Status & Priority */}
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: statusConfig.color }]}>
            <Ionicons name={statusConfig.icon as any} size={16} color="#FFFFFF" />
            <Text style={styles.badgeText}>{statusConfig.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: priorityConfig.color }]}>
            <Ionicons name={priorityConfig.icon as any} size={16} color="#FFFFFF" />
            <Text style={styles.badgeText}>{priorityConfig.label}</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>{request.title}</Text>

        {/* Days Since Created */}
        <View style={styles.daysCard}>
          <Ionicons name="calendar-outline" size={20} color={colors.gray[600]} />
          <Text style={styles.daysText}>
            {(() => {
              const days = Math.floor((Date.now() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24));
              if (days === 0) return 'Created today';
              if (days === 1) return 'Created 1 day ago';
              return `Created ${days} days ago`;
            })()}
          </Text>
          {request.completed_date && (
            <Text style={styles.daysSubtext}>
              {(() => {
                const completionDays = Math.floor(
                  (new Date(request.completed_date).getTime() - new Date(request.created_at).getTime()) / (1000 * 60 * 60 * 24)
                );
                return ` • Completed in ${completionDays} ${completionDays === 1 ? 'day' : 'days'}`;
              })()}
            </Text>
          )}
        </View>

        {/* Property Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="home" size={20} color={colors.gray[600]} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Property</Text>
              <Text style={styles.infoValue}>{request.property?.title}</Text>
              <Text style={styles.infoSubtext}>
                {request.property?.address}, {request.property?.city}
              </Text>
            </View>
          </View>
        </View>

        {/* Tenant Info (if exists) */}
        {request.tenant && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="person" size={20} color={colors.gray[600]} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Reported By</Text>
                <Text style={styles.infoValue}>{request.tenant.full_name}</Text>
                <Text style={styles.infoSubtext}>{request.tenant.phone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Category */}
        {request.category && (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="pricetag" size={20} color={colors.gray[600]} />
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Category</Text>
                <Text style={styles.infoValue}>{request.category.name}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{request.description}</Text>
        </View>

        {/* Photos/Videos */}
        {request.images && request.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Photos & Videos ({request.images.length})
            </Text>
            <MediaGallery images={request.images} />
          </View>
        )}

        {/* Timeline */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <View style={styles.timeline}>
            <TimelineItem
              icon="add-circle"
              label="Created"
              date={new Date(request.created_at).toLocaleDateString()}
              completed
            />
            {request.acknowledged_at && (
              <TimelineItem
                icon="checkmark-circle"
                label="Acknowledged"
                date={new Date(request.acknowledged_at).toLocaleDateString()}
                completed
              />
            )}
            {request.vendor_routed_at && (
              <TimelineItem
                icon="people"
                label="Sent to Vendors"
                date={new Date(request.vendor_routed_at).toLocaleDateString()}
                completed
              />
            )}
            {request.completed_date && (
              <TimelineItem
                icon="checkmark-done"
                label="Completed"
                date={new Date(request.completed_date).toLocaleDateString()}
                completed
              />
            )}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Buttons */}
      {(canAcknowledge || canPushToVendors) && (
        <View style={styles.footer}>
          {canAcknowledge && (
            <View style={styles.actionContainer}>
              <Text style={styles.actionHint}>
                📋 Acknowledge to confirm you've reviewed this request
              </Text>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryButton]}
                onPress={handleAcknowledge}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Acknowledge Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
          {canPushToVendors && (
            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handlePushToVendors}
              disabled={actionLoading}
            >
              <Ionicons name="people" size={20} color={RSA.green} />
              <Text style={[styles.actionButtonText, { color: RSA.green }]}>
                Push to Vendors
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// Timeline Item Component
function TimelineItem({
  icon,
  label,
  date,
  completed,
}: {
  icon: string;
  label: string;
  date: string;
  completed: boolean;
}) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, completed && styles.timelineIconCompleted]}>
        <Ionicons
          name={icon as any}
          size={16}
          color={completed ? '#FFFFFF' : colors.gray[400]}
        />
      </View>
      <View style={styles.timelineContent}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineDate}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#111827' },
  backButton: { marginTop: 24, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: RSA.green, borderRadius: 8 },
  backButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  badges: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', paddingHorizontal: 16, marginTop: 16 },
  daysCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: '#bbf7d0' },
  daysText: { fontSize: 14, fontWeight: '600', color: '#166534' },
  daysSubtext: { fontSize: 12, color: '#15803d' },
  infoCard: { marginHorizontal: 16, marginTop: 16, padding: 16, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  infoRow: { flexDirection: 'row', gap: 12 },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  infoSubtext: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  description: { fontSize: 15, color: '#374151', lineHeight: 22 },
  timeline: { gap: 16 },
  timelineItem: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.gray[200], justifyContent: 'center', alignItems: 'center' },
  timelineIconCompleted: { backgroundColor: RSA.green },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  timelineDate: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  footer: { padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 12 },
  actionContainer: { gap: 8 },
  actionHint: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingHorizontal: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12 },
  primaryButton: { backgroundColor: RSA.green },
  secondaryButton: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: RSA.green },
  actionButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
});
