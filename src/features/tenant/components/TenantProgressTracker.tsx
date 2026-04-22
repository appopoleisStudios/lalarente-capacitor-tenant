/**
 * Tenant Progress Tracker
 * Simplified 6-stage maintenance progress view for tenants
 *
 * Hides internal business details (vendor routing, quotes, PO numbers)
 * Focuses on: "Is it being fixed? When? Can I verify it's done?"
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MaintenanceRequest, ClosureReport } from '@/src/features/maintenance/api/types/maintenance.types';

interface TenantProgressTrackerProps {
  request: MaintenanceRequest;
  closureReport?: ClosureReport | null;
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

export default function TenantProgressTracker({ request, closureReport }: TenantProgressTrackerProps) {
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
                </View>
              </View>
            </View>
          );
        })}
      </View>

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
          <Text style={styles.infoText}>
            Verification requested {new Date(closureReport.forwarded_to_tenant_at).toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
