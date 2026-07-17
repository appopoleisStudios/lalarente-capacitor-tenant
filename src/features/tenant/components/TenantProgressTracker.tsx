/**
 * Tenant Progress Tracker
 * Enhanced 6-stage maintenance progress view for tenants
 *
 * Shows photo evidence counts and progress update timeline
 * Hides internal business details (vendor routing, quotes, PO numbers)
 */

import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MaintenanceRequest, ClosureReport } from '@/src/features/maintenance/api/types/maintenance.types';

interface ProgressUpdate {
  id: string;
  update_date: string;
  notes: string;
  photos: string[];
  created_at: string;
}

interface TenantProgressTrackerProps {
  request: MaintenanceRequest;
  closureReport?: ClosureReport | null;
  progressUpdates?: ProgressUpdate[];
}

type TenantStage = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
};

const TENANT_STAGES: TenantStage[] = [
  {
    id: 'submitted',
    label: 'Request Submitted',
    icon: 'checkmark-circle',
    description: 'Your maintenance request was submitted',
  },
  {
    id: 'acknowledged',
    label: 'Acknowledged',
    icon: 'eye',
    description: 'Property manager reviewed your request',
  },
  {
    id: 'scheduled',
    label: 'Work Scheduled',
    icon: 'calendar',
    description: 'A professional has been assigned',
  },
  {
    id: 'in_progress',
    label: 'Work In Progress',
    icon: 'construct',
    description: 'Work is actively being performed',
  },
  {
    id: 'verify',
    label: 'Awaiting Your Verification',
    icon: 'checkmark-done-circle',
    description: 'Please verify the work is complete',
  },
  {
    id: 'completed',
    label: 'Completed',
    icon: 'trophy',
    description: 'Job successfully completed',
  },
];

export default function TenantProgressTracker({
  request,
  closureReport,
  progressUpdates = [],
}: TenantProgressTrackerProps) {
  const getCurrentStageIndex = (): number => {
    // Completed
    if (request.status === 'completed') {
      return 5;
    }

    // Awaiting tenant verification
    if (
      closureReport?.tenant_verification_status === 'pending_tenant' ||
      closureReport?.tenant_verification_status === 'tenant_rejected'
    ) {
      return 4;
    }

    // Work in progress
    if (request.status === 'in_progress' || request.work_started_at) {
      return 3;
    }

    // Work scheduled (vendor assigned and PO accepted)
    if (request.selected_vendor_id && request.work_can_start) {
      return 2;
    }

    // Acknowledged (owner reviewed)
    if (request.acknowledged_at) {
      return 1;
    }

    // Submitted
    return 0;
  };

  const currentStageIndex = getCurrentStageIndex();

  const getStageStatus = (index: number): 'completed' | 'current' | 'upcoming' => {
    if (index < currentStageIndex) return 'completed';
    if (index === currentStageIndex) return 'current';
    return 'upcoming';
  };

  const getStageColor = (status: 'completed' | 'current' | 'upcoming'): string => {
    switch (status) {
      case 'completed':
        return '#10B981'; // green
      case 'current':
        return '#3B82F6'; // blue
      case 'upcoming':
        return '#D1D5DB'; // gray
    }
  };

  const rejectionCount = closureReport?.rejection_count ?? 0;
  const showRejectionBadge =
    closureReport?.tenant_verification_status === 'tenant_rejected' &&
    rejectionCount > 0;

  // Evidence summary
  const totalProgressPhotos = progressUpdates.reduce(
    (sum, u) => sum + (u.photos?.length || 0), 0
  );
  const totalProgressUpdates = progressUpdates.length;
  const hasCompletionPhotos = closureReport?.completion_photos &&
    Array.isArray(closureReport.completion_photos) &&
    closureReport.completion_photos.length > 0;
  const hasTenantPhotos = (closureReport as any)?.tenant_after_photos &&
    Array.isArray((closureReport as any).tenant_after_photos) &&
    (closureReport as any).tenant_after_photos.length > 0;
  const hasTenantRejectionPhotos = (closureReport as any)?.tenant_rejection_photos &&
    Array.isArray((closureReport as any).tenant_rejection_photos) &&
    (closureReport as any).tenant_rejection_photos.length > 0;

  // Completion photos for display
  const latestCompletionPhotos = hasCompletionPhotos
    ? (closureReport!.completion_photos as string[]).slice(0, 3)
    : [];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progress</Text>

      {showRejectionBadge && (
        <View style={styles.rejectionBadge}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.rejectionText}>
            Work needs fixes ({rejectionCount} rejection{rejectionCount > 1 ? 's' : ''})
          </Text>
        </View>
      )}

      <View style={styles.timeline}>
        {TENANT_STAGES.map((stage, index) => {
          const status = getStageStatus(index);
          const color = getStageColor(status);
          const isLast = index === TENANT_STAGES.length - 1;

          return (
            <View key={stage.id}>
              <View style={styles.stageContainer}>
                {/* Icon */}
                <View style={styles.iconContainer}>
                  <View style={[styles.iconCircle, { backgroundColor: color }]}>
                    <Ionicons
                      name={status === 'completed' ? 'checkmark' : stage.icon}
                      size={20}
                      color="#FFFFFF"
                    />
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.connector,
                        { backgroundColor: status === 'completed' ? '#10B981' : '#E5E7EB' },
                      ]}
                    />
                  )}
                </View>

                {/* Content */}
                <View style={styles.stageContent}>
                  <Text
                    style={[
                      styles.stageLabel,
                      status === 'current' && styles.stageLabelCurrent,
                    ]}
                  >
                    {stage.label}
                  </Text>
                  {status === 'current' && (
                    <Text style={styles.stageDescription}>{stage.description}</Text>
                  )}

                  {/* Stage-specific evidence indicators */}
                  {index === 3 && status === 'current' && totalProgressUpdates > 0 && (
                    <View style={styles.evidenceBadge}>
                      <Ionicons name="images-outline" size={14} color="#6B7280" />
                      <Text style={styles.evidenceBadgeText}>
                        {totalProgressUpdates} update{totalProgressUpdates > 1 ? 's' : ''}
                        {totalProgressPhotos > 0 ? ` · ${totalProgressPhotos} photo${totalProgressPhotos > 1 ? 's' : ''}` : ''}
                      </Text>
                    </View>
                  )}

                  {index === 4 && status === 'current' && hasCompletionPhotos && (
                    <View style={styles.evidenceBadge}>
                      <Ionicons name="images-outline" size={14} color="#6B7280" />
                      <Text style={styles.evidenceBadgeText}>
                        {latestCompletionPhotos.length} completion photo{latestCompletionPhotos.length > 1 ? 's' : ''} available
                      </Text>
                    </View>
                  )}

                  {index === 5 && hasTenantPhotos && (
                    <View style={styles.evidenceBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={[styles.evidenceBadgeText, { color: '#10B981' }]}>
                        Your after-photos saved as evidence
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Evidence Summary Card */}
      {totalProgressUpdates > 0 && currentStageIndex >= 3 && (
        <View style={styles.evidenceCard}>
          <View style={styles.evidenceCardHeader}>
            <Ionicons name="images-outline" size={20} color="#3B82F6" />
            <Text style={styles.evidenceCardTitle}>Evidence Summary</Text>
          </View>
          <View style={styles.evidenceStats}>
            <View style={styles.evidenceStat}>
              <Text style={styles.evidenceStatValue}>{totalProgressUpdates}</Text>
              <Text style={styles.evidenceStatLabel}>Progress{totalProgressUpdates > 1 ? 'es' : ''}</Text>
            </View>
            <View style={styles.evidenceStat}>
              <Text style={styles.evidenceStatValue}>{totalProgressPhotos + (hasCompletionPhotos ? latestCompletionPhotos.length : 0)}</Text>
              <Text style={styles.evidenceStatLabel}>Photos</Text>
            </View>
            {hasTenantPhotos && (
              <View style={styles.evidenceStat}>
                <Text style={[styles.evidenceStatValue, { color: '#10B981' }]}>
                  {(closureReport as any).tenant_after_photos!.length}
                </Text>
                <Text style={styles.evidenceStatLabel}>Your Photos</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Additional Info */}
      {request.work_started_at && currentStageIndex >= 3 && currentStageIndex < 5 && (
        <View style={styles.infoCard}>
          <Ionicons name="time-outline" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            Work started {new Date(request.work_started_at).toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
      )}

      {closureReport?.forwarded_to_tenant_at && currentStageIndex === 4 && (
        <View style={styles.infoCard}>
          <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoText}>
              Verification requested {new Date(closureReport.forwarded_to_tenant_at).toLocaleDateString('en-ZA', {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
            {(closureReport as any)?.auto_approve_at && (
              <Text style={styles.infoSubtext}>
                Auto-approves {new Date((closureReport as any).auto_approve_at).toLocaleDateString('en-ZA', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Completion Photos Preview */}
      {hasCompletionPhotos && currentStageIndex >= 4 && (
        <View style={styles.photoPreviewCard}>
          <Text style={styles.photoPreviewTitle}>Completion Evidence</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.photoPreviewRow}>
              {latestCompletionPhotos.map((photo: string, idx: number) => (
                <Image
                  key={idx}
                  source={{ uri: photo }}
                  style={styles.photoPreviewThumb}
                />
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  rejectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  rejectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  timeline: {
    gap: 0,
  },
  stageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 60,
  },
  iconContainer: {
    alignItems: 'center',
    width: 40,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  stageContent: {
    flex: 1,
    paddingTop: 8,
  },
  stageLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  stageLabelCurrent: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  stageDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  evidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  evidenceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  evidenceCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  evidenceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  evidenceCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E40AF',
  },
  evidenceStats: {
    flexDirection: 'row',
    gap: 16,
  },
  evidenceStat: {
    alignItems: 'center',
  },
  evidenceStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E40AF',
  },
  evidenceStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#1E40AF',
    flex: 1,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  photoPreviewCard: {
    marginTop: 12,
  },
  photoPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  photoPreviewRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoPreviewThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
});
