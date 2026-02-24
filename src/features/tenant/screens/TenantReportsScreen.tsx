/**
 * Tenant Reports Screen
 *
 * Two sections:
 * 1. Inspections — move-in, periodic, move-out inspections for this tenant
 * 2. Maintenance Closures — work orders awaiting tenant verification
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';

interface InspectionItem {
  id: string;
  type: string;
  status: string;
  scheduled_date: string;
  completed_date: string | null;
  overall_condition: string | null;
  tenant_signed_at: string | null;
  property: { id: string; title: string } | null;
}

interface ClosureItem {
  id: string;
  completion_notes: string | null;
  completion_photos: string[] | null;
  tenant_verification_status: string | null;
  forwarded_to_tenant_at: string | null;
  maintenance_request: { id: string; title: string } | null;
}

const INSPECTION_TYPE_LABEL: Record<string, string> = {
  move_in: 'Move-In Inspection',
  periodic: 'Periodic Inspection',
  move_out: 'Move-Out Inspection',
};

const INSPECTION_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: colors.info[500], bg: colors.info[50] },
  in_progress: { label: 'In Progress', color: colors.warning[500], bg: colors.warning[50] },
  pending_signatures: { label: 'Needs Signature', color: colors.rsa.gold, bg: colors.warning[50] },
  completed: { label: 'Completed', color: colors.primary[500], bg: colors.primary[50] },
  cancelled: { label: 'Cancelled', color: colors.error[500], bg: colors.error[50] },
};

export default function TenantReportsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [pendingClosures, setPendingClosures] = useState<ClosureItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch inspections
      const { data: inspectionData } = await supabase
        .from('inspections')
        .select(`
          id, type, status, scheduled_date, completed_date,
          overall_condition, tenant_signed_at,
          property:properties!property_id(id, title)
        `)
        .eq('tenant_id', user.id)
        .order('scheduled_date', { ascending: false })
        .limit(10);

      setInspections((inspectionData as any[]) ?? []);

      // Fetch maintenance request IDs belonging to this tenant
      const { data: tenantRequests } = await supabase
        .from('maintenance_requests')
        .select('id')
        .eq('tenant_id', user.id);

      const reqIds = tenantRequests?.map((r: any) => r.id) ?? [];

      // Fetch closure reports pending tenant verification
      if (reqIds.length > 0) {
        const { data: closureData } = await supabase
          .from('closure_reports')
          .select(`
            id, completion_notes, completion_photos,
            tenant_verification_status, forwarded_to_tenant_at,
            maintenance_request:maintenance_requests!maintenance_request_id(id, title)
          `)
          .eq('tenant_verification_status', 'pending_tenant')
          .in('maintenance_request_id', reqIds);

        setPendingClosures((closureData as any[]) ?? []);
      } else {
        setPendingClosures([]);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const navigateToVerification = (closure: ClosureItem) => {
    router.push({
      pathname: '/(tenant)/maintenance/verify' as any,
      params: {
        requestId: closure.maintenance_request?.id ?? '',
        completionNotes: closure.completion_notes ?? '',
        completionPhotos: JSON.stringify(closure.completion_photos ?? []),
      },
    });
  };

  const isEmpty = inspections.length === 0 && pendingClosures.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.rsa.green} style={{ marginTop: 40 }} />
      ) : isEmpty ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={64} color={colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Reports Yet</Text>
          <Text style={styles.emptyText}>
            Inspection reports and maintenance verification requests will appear here
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Pending Maintenance Verifications */}
          {pendingClosures.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Awaiting Your Verification</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{pendingClosures.length}</Text>
                </View>
              </View>
              <Text style={styles.sectionSubtitle}>
                The following maintenance jobs are completed — please review and confirm
              </Text>
              {pendingClosures.map(closure => (
                <TouchableOpacity
                  key={closure.id}
                  style={styles.closureCard}
                  onPress={() => navigateToVerification(closure)}
                  activeOpacity={0.7}
                >
                  <View style={styles.closureLeft}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.warning[50] }]}>
                      <Ionicons name="construct" size={20} color={colors.warning[500]} />
                    </View>
                    <View style={styles.closureInfo}>
                      <Text style={styles.closureTitle} numberOfLines={2}>
                        {closure.maintenance_request?.title || 'Maintenance Request'}
                      </Text>
                      {closure.forwarded_to_tenant_at && (
                        <Text style={styles.closureDate}>
                          Forwarded {new Date(closure.forwarded_to_tenant_at).toLocaleDateString('en-ZA')}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.actionRequired}>
                    <Text style={styles.actionRequiredText}>Review</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.warning[500]} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Inspections */}
          {inspections.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Inspection Reports</Text>
              {inspections.map(inspection => {
                const statusCfg = INSPECTION_STATUS_CONFIG[inspection.status]
                  ?? { label: inspection.status, color: colors.text.secondary, bg: colors.background.secondary };
                const typeLabel = INSPECTION_TYPE_LABEL[inspection.type] ?? inspection.type;
                const needsSignature = inspection.status === 'pending_signatures' && !inspection.tenant_signed_at;

                return (
                  <View key={inspection.id} style={styles.inspectionCard}>
                    <View style={styles.inspectionTop}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.info[50] }]}>
                        <Ionicons name="clipboard" size={20} color={colors.info[500]} />
                      </View>
                      <View style={styles.inspectionInfo}>
                        <Text style={styles.inspectionType}>{typeLabel}</Text>
                        {inspection.property && (
                          <Text style={styles.inspectionProp} numberOfLines={1}>
                            {inspection.property.title}
                          </Text>
                        )}
                        <Text style={styles.inspectionDate}>
                          {new Date(inspection.scheduled_date).toLocaleDateString('en-ZA', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[styles.statusText, { color: statusCfg.color }]}>
                          {statusCfg.label}
                        </Text>
                      </View>
                    </View>

                    {inspection.overall_condition && (
                      <View style={styles.conditionRow}>
                        <Text style={styles.conditionLabel}>Condition:</Text>
                        <Text style={styles.conditionValue}>
                          {inspection.overall_condition.charAt(0).toUpperCase() + inspection.overall_condition.slice(1)}
                        </Text>
                      </View>
                    )}

                    {needsSignature && (
                      <View style={styles.signatureAlert}>
                        <Ionicons name="create-outline" size={16} color={colors.rsa.gold} />
                        <Text style={styles.signatureAlertText}>
                          Your signature is required on this inspection report
                        </Text>
                      </View>
                    )}

                    {inspection.tenant_signed_at && (
                      <View style={styles.signedRow}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.primary[500]} />
                        <Text style={styles.signedText}>
                          Signed {new Date(inspection.tenant_signed_at).toLocaleDateString('en-ZA')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background.secondary },
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
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  content: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text.primary, marginTop: 16 },
  emptyText: {
    fontSize: 14, color: colors.text.secondary, textAlign: 'center',
    marginTop: 8, lineHeight: 20,
  },
  section: { padding: 16, paddingBottom: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: colors.text.primary, marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13, color: colors.text.secondary, marginBottom: 12, lineHeight: 18,
  },
  countBadge: {
    backgroundColor: colors.warning[500],
    borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
    marginBottom: 12,
  },
  countText: { fontSize: 11, fontWeight: '700', color: colors.text.inverse },
  closureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning[500],
  },
  closureLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  closureInfo: { flex: 1 },
  closureTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  closureDate: { fontSize: 11, color: colors.text.tertiary, marginTop: 2 },
  actionRequired: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.warning[50],
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  actionRequiredText: { fontSize: 12, fontWeight: '700', color: colors.warning[500] },
  inspectionCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  inspectionTop: { flexDirection: 'row', alignItems: 'flex-start' },
  inspectionInfo: { flex: 1, marginRight: 8 },
  inspectionType: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  inspectionProp: { fontSize: 12, color: colors.text.secondary, marginTop: 2 },
  inspectionDate: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start',
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  conditionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border.default,
  },
  conditionLabel: { fontSize: 12, color: colors.text.secondary },
  conditionValue: { fontSize: 12, fontWeight: '600', color: colors.text.primary },
  signatureAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, padding: 10,
    backgroundColor: colors.warning[50], borderRadius: 8,
  },
  signatureAlertText: { fontSize: 12, color: colors.warning[500], flex: 1 },
  signedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
  },
  signedText: { fontSize: 12, color: colors.primary[500] },
});
