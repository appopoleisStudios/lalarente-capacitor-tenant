/**
 * Owner Compliance Screen
 *
 * Two sections:
 * 1. FICA / Tenant Verification — per-tenant identity, credit, background checks from rental_applications
 * 2. Property Compliance — COC, electrical, gas, rates clearance, insurance status per property
 *
 * FICA (Financial Intelligence Centre Act) = anti-money laundering KYC.
 * Property compliance = legal certificates required by SA law for rental properties.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import { documentsApi } from '@/src/features/documents/api/documentsApi';
import { applicationsApi } from '@/src/features/properties/api/applicationsApi';
import type { Document } from '@/src/features/documents/types';

type Tab = 'fica' | 'property';

interface TenantFica {
  applicationId: string;
  tenantName: string;
  propertyTitle: string;
  identityStatus: string | null;
  creditStatus: string | null;
  backgroundStatus: string | null;
  riskLevel: string | null;
  idDocumentUrl: string | null;
  applicationStatus: string;
  ownerId: string;
}

interface PropertyCompliance {
  propertyId: string;
  propertyTitle: string;
  address: string | null;
  // No real compliance table yet — show checklist
  ficaTenantsVerified: number;
  ficaTenantsPending: number;
}

/** Subset of the documents row used by the compliance checklist (partial select). */
type ComplianceDoc = Pick<
  Document,
  'id' | 'property_id' | 'filename' | 'title' | 'created_at' | 'tags'
>;

const STATUS_ICON: Record<string, { icon: string; color: string }> = {
  verified: { icon: 'checkmark-circle', color: colors.primary[500] },
  completed: { icon: 'checkmark-circle', color: colors.primary[500] },
  passed: { icon: 'checkmark-circle', color: colors.primary[500] },
  approved: { icon: 'checkmark-circle', color: colors.primary[500] },
  clear: { icon: 'checkmark-circle', color: colors.primary[500] },
  pending: { icon: 'time', color: colors.warning[500] },
  in_progress: { icon: 'time', color: colors.warning[500] },
  failed: { icon: 'close-circle', color: colors.error[500] },
  rejected: { icon: 'close-circle', color: colors.error[500] },
  flagged: { icon: 'warning', color: colors.error[500] },
  not_started: { icon: 'ellipse-outline', color: colors.gray[400] },
};

function getStatusConfig(status: string | null) {
  if (!status) return STATUS_ICON.not_started;
  return STATUS_ICON[status.toLowerCase()] || { icon: 'ellipse-outline', color: colors.gray[400] };
}

/**
 * Interactive FICA check button — tap to mark complete or fail.
 * Shows status badge when done, tappable prompt when not started.
 */
function FicaCheckButton({
  testID,
  label,
  status,
  applicationId,
  field,
  onComplete,
}: {
  testID: string;
  label: string;
  status: string | null;
  applicationId: string;
  field: string;
  onComplete: () => void;
}) {
  const [localUpdating, setLocalUpdating] = useState(false);
  const cfg = getStatusConfig(status);
  const isDone = status === 'verified' || status === 'completed';
  const isFailed = status === 'failed';

  if (isDone || isFailed) {
    return (
      <View style={styles.ficaCheckItem} testID={testID}>
        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
        <Text style={styles.ficaCheckLabel}>{label}</Text>
        <Text style={[styles.ficaCheckStatus, { color: cfg.color }]}>
          {status === 'verified' ? 'Verified' : status === 'completed' ? 'Complete' : 'Failed'}
        </Text>
      </View>
    );
  }

  const handlePress = () => {
    Alert.alert(label, `Review the tenant's ${label.toLowerCase()} documents, then confirm.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Complete',
        onPress: async () => {
          setLocalUpdating(true);
          try {
            const newStatus = field === 'identity_verification_status' ? 'verified' : 'completed';
            await applicationsApi.updateApplication(applicationId, { [field]: newStatus } as any);
            onComplete();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update');
          } finally {
            setLocalUpdating(false);
          }
        },
      },
      {
        text: 'Mark Failed',
        style: 'destructive',
        onPress: async () => {
          setLocalUpdating(true);
          try {
            await applicationsApi.updateApplication(applicationId, { [field]: 'failed' } as any);
            onComplete();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update');
          } finally {
            setLocalUpdating(false);
          }
        },
      },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.ficaCheckItem, styles.ficaCheckItemTappable]}
      testID={testID}
      disabled={localUpdating}
      onPress={handlePress}
    >
      {localUpdating ? (
        <ActivityIndicator size="small" color={colors.warning[500]} />
      ) : (
        <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
      )}
      <Text style={styles.ficaCheckLabel}>{label}</Text>
      <Text style={[styles.ficaCheckStatus, { color: cfg.color }]}>
        {localUpdating ? 'Updating…' : 'Tap to verify'}
      </Text>
    </TouchableOpacity>
  );
}

const RISK_COLORS: Record<string, string> = {
  low: colors.primary[500],
  medium: colors.warning[500],
  high: colors.error[500],
  very_high: colors.rsa.red,
};

const COMPLIANCE_ITEMS = [
  {
    key: 'eoc',
    label: 'Electrical Certificate of Compliance (COC)',
    law: 'Occupational Health & Safety Act',
  },
  { key: 'gas', label: 'Gas Certificate of Compliance', law: 'Pressure Equipment Regulations' },
  { key: 'rates', label: 'Rates Clearance Certificate', law: 'Municipal Systems Act' },
  { key: 'insurance', label: 'Property Insurance', law: 'Best practice / Bond requirement' },
  { key: 'fica', label: 'FICA Registration (FIC)', law: 'Financial Intelligence Centre Act' },
  {
    key: 'popia',
    label: 'POPIA Registration (Information Regulator)',
    law: 'Protection of Personal Information Act',
  },
];

export default function OwnerComplianceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('fica');
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ficaData, setFicaData] = useState<TenantFica[]>([]);
  const [propertyData, setPropertyData] = useState<PropertyCompliance[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<Record<string, ComplianceDoc>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initOwner();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ownerId) fetchAll(ownerId);
    }, [ownerId])
  );

  const initOwner = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      setOwnerId(user.id);
      fetchAll(user.id);
    }
  };

  const fetchAll = async (uid: string) => {
    setLoading(true);
    await Promise.all([fetchFica(uid), fetchProperties(uid), fetchComplianceDocs(uid)]);
    setLoading(false);
  };

  /**
   * Load the owner's uploaded compliance certificates (type 'other' tagged
   * ['compliance', <item-key>]) grouped per property + checklist item.
   * Plane #69 — completes the Property Compliance tab (was a dead stub).
   */
  const fetchComplianceDocs = async (uid: string) => {
    try {
      const { data } = await supabase
        .from('documents')
        .select('id, property_id, filename, title, created_at, tags')
        .eq('owner_id', uid)
        .contains('tags', ['compliance'])
        .order('created_at', { ascending: false });

      const map: Record<string, ComplianceDoc> = {};
      (data || []).forEach((doc: ComplianceDoc) => {
        const itemKey = (doc.tags || []).find((t) => t !== 'compliance');
        const key = doc.property_id && itemKey ? `${doc.property_id}:${itemKey}` : '';
        // Query is ordered desc — first row per key is the latest upload.
        if (key && !map[key]) map[key] = doc;
      });
      setComplianceDocs(map);
    } catch (err) {
      console.error('Error fetching compliance docs:', err);
    }
  };

  /**
   * Pick a file and upload it as a compliance certificate for the property.
   * Mirrors the #84 vendor-documents pattern: picker -> documentsApi
   * (base64 -> documents bucket -> documents row with property/owner links).
   */
  const handleUpload = async (
    property: PropertyCompliance,
    item: { key: string; label: string; law: string }
  ) => {
    if (!ownerId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      const MAX_SIZE = 10 * 1024 * 1024; // matches the 'other' category limit
      if (file.size && file.size > MAX_SIZE) {
        Alert.alert('File Too Large', 'Maximum file size is 10MB. Please select a smaller file.');
        return;
      }

      setUploadingKey(`${property.propertyId}:${item.key}`);

      // Replace ordering is deliberate: upload the NEW cert first, then delete
      // the previous one only after success. Deleting first would lose the old
      // legal certificate if the new upload failed; a failed delete afterwards
      // only leaves a hidden stale duplicate (latest-wins map hides it).
      const previous = complianceDocs[`${property.propertyId}:${item.key}`];

      await documentsApi.uploadDocument(
        {
          uri: file.uri,
          name: file.name || 'certificate',
          size: file.size || 0,
          mimeType: file.mimeType || 'application/pdf',
        },
        {
          type: 'other',
          title: `${item.label} — ${property.propertyTitle}`,
          access_level: 'owner_only',
          property_id: property.propertyId,
          owner_id: ownerId,
          tags: ['compliance', item.key],
        },
        ownerId
      );

      if (previous?.id) {
        await documentsApi.deleteDocument(previous.id).catch((err) => {
          console.warn('Failed to delete previous certificate:', err);
        });
      }

      await fetchComplianceDocs(ownerId);
      Alert.alert('Success', `${item.label} uploaded for ${property.propertyTitle}.`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to upload certificate');
    } finally {
      setUploadingKey(null);
    }
  };

  const fetchFica = async (uid: string) => {
    try {
      const { data: apps } = await supabase
        .from('rental_applications')
        .select(
          'id, tenant_id, property_id, owner_id, status, identity_verification_status, credit_check_status, background_check_status, risk_level, id_document_url'
        )
        .eq('owner_id', uid)
        .in('status', ['approved', 'pending', 'shortlisted'])
        .order('created_at', { ascending: false });

      if (!apps?.length) return;

      const tenantIds = [...new Set(apps.map((a) => a.tenant_id))];
      const propertyIds = [...new Set(apps.map((a) => a.property_id))];

      const [{ data: profiles }, { data: properties }] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', tenantIds),
        supabase.from('properties').select('id, title').in('id', propertyIds),
      ]);

      const tenantMap: Record<string, string> = {};
      profiles?.forEach((p) => {
        tenantMap[p.id] = p.full_name;
      });
      const propMap: Record<string, string> = {};
      properties?.forEach((p) => {
        propMap[p.id] = p.title;
      });

      setFicaData(
        apps.map((a) => ({
          applicationId: a.id,
          tenantName: tenantMap[a.tenant_id] || 'Tenant',
          propertyTitle: propMap[a.property_id] || 'Property',
          identityStatus: a.identity_verification_status,
          creditStatus: a.credit_check_status,
          backgroundStatus: a.background_check_status,
          riskLevel: a.risk_level,
          idDocumentUrl: a.id_document_url,
          applicationStatus: a.status,
          ownerId: a.owner_id || uid,
        }))
      );
    } catch (err) {
      console.error('Error fetching FICA data:', err);
    }
  };

  const fetchProperties = async (uid: string) => {
    try {
      const { data: properties } = await supabase
        .from('properties')
        .select('id, title, address')
        .eq('owner_id', uid)
        .order('created_at', { ascending: false });

      if (!properties?.length) return;

      // Get FICA verification counts per property
      const propertyIds = properties.map((p) => p.id);
      const { data: apps } = await supabase
        .from('rental_applications')
        .select('property_id, identity_verification_status')
        .in('property_id', propertyIds)
        .in('status', ['approved']);

      const verifiedCounts: Record<string, number> = {};
      const pendingCounts: Record<string, number> = {};
      apps?.forEach((a) => {
        if (a.identity_verification_status === 'verified') {
          verifiedCounts[a.property_id] = (verifiedCounts[a.property_id] || 0) + 1;
        } else {
          pendingCounts[a.property_id] = (pendingCounts[a.property_id] || 0) + 1;
        }
      });

      setPropertyData(
        properties.map((p) => ({
          propertyId: p.id,
          propertyTitle: p.title,
          address: p.address,
          ficaTenantsVerified: verifiedCounts[p.id] || 0,
          ficaTenantsPending: pendingCounts[p.id] || 0,
        }))
      );
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const ficaVerified = ficaData.filter((f) => f.identityStatus === 'verified').length;
  const ficaPending = ficaData.filter(
    (f) => !f.identityStatus || f.identityStatus === 'pending'
  ).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          testID="owner-compliance-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compliance</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'fica' && styles.tabActive]}
          onPress={() => setActiveTab('fica')}
        >
          <Text style={[styles.tabText, activeTab === 'fica' && styles.tabTextActive]}>
            FICA / Tenant KYC
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'property' && styles.tabActive]}
          onPress={() => setActiveTab('property')}
        >
          <Text style={[styles.tabText, activeTab === 'property' && styles.tabTextActive]}>
            Property Compliance
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeTab === 'fica' ? (
            <>
              {/* FICA info banner */}
              <View style={styles.infoBanner}>
                <Ionicons name="shield-checkmark-outline" size={18} color={colors.info[500]} />
                <Text style={styles.infoText}>
                  FICA requires you to verify the identity of all tenants (Know Your Customer). As a
                  property practitioner, non-compliance carries criminal penalties. Review the
                  tenant's uploaded ID and documents, then tap each check to mark it as complete.
                </Text>
              </View>

              {/* FICA summary */}
              <View style={styles.ficaSummaryRow}>
                <View style={[styles.ficaSummaryCard, { backgroundColor: colors.primary[500] }]}>
                  <Text style={styles.ficaSummaryValue}>{ficaVerified}</Text>
                  <Text style={styles.ficaSummaryLabel}>Verified</Text>
                </View>
                <View style={[styles.ficaSummaryCard, { backgroundColor: colors.warning[500] }]}>
                  <Text style={styles.ficaSummaryValue}>{ficaPending}</Text>
                  <Text style={styles.ficaSummaryLabel}>Pending</Text>
                </View>
                <View style={[styles.ficaSummaryCard, { backgroundColor: colors.rsa.blue }]}>
                  <Text style={styles.ficaSummaryValue}>{ficaData.length}</Text>
                  <Text style={styles.ficaSummaryLabel}>Total</Text>
                </View>
              </View>

              {ficaData.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={48} color={colors.gray[300]} />
                  <Text style={styles.emptyText}>No approved tenant applications yet</Text>
                </View>
              ) : (
                ficaData.map((tenant) => {
                  const idCfg = getStatusConfig(tenant.identityStatus);
                  const creditCfg = getStatusConfig(tenant.creditStatus);
                  const bgCfg = getStatusConfig(tenant.backgroundStatus);
                  const riskColor =
                    RISK_COLORS[tenant.riskLevel?.toLowerCase() || ''] || colors.gray[400];
                  return (
                    <View key={tenant.applicationId} style={styles.ficaCard}>
                      <View style={styles.ficaCardHeader}>
                        <View>
                          <Text style={styles.ficaName}>{tenant.tenantName}</Text>
                          <Text style={styles.ficaProperty}>{tenant.propertyTitle}</Text>
                        </View>
                        {tenant.riskLevel && (
                          <View style={[styles.riskBadge, { backgroundColor: riskColor + '20' }]}>
                            <Text style={[styles.riskText, { color: riskColor }]}>
                              {tenant.riskLevel.replace('_', ' ').toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.ficaChecks}>
                        <FicaCheckButton
                          testID="fica-check-identity"
                          label="Identity"
                          status={tenant.identityStatus}
                          applicationId={tenant.applicationId}
                          field="identity_verification_status"
                          onComplete={() => fetchFica(ownerId!)}
                        />
                        <FicaCheckButton
                          testID="fica-check-credit"
                          label="Credit"
                          status={tenant.creditStatus}
                          applicationId={tenant.applicationId}
                          field="credit_check_status"
                          onComplete={() => fetchFica(ownerId!)}
                        />
                        <FicaCheckButton
                          testID="fica-check-background"
                          label="Background"
                          status={tenant.backgroundStatus}
                          applicationId={tenant.applicationId}
                          field="background_check_status"
                          onComplete={() => fetchFica(ownerId!)}
                        />
                      </View>
                      {tenant.idDocumentUrl && (
                        <View style={styles.ficaDocRow}>
                          <Ionicons name="document-outline" size={14} color={colors.primary[500]} />
                          <Text style={styles.ficaDocText}>ID document on file</Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          ) : (
            <>
              {/* Property compliance info */}
              <View style={styles.infoBanner}>
                <Ionicons name="document-text-outline" size={18} color={colors.info[500]} />
                <Text style={styles.infoText}>
                  SA law requires specific certificates before renting out a property. Upload and
                  track your compliance documents here.
                </Text>
              </View>

              {propertyData.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="business-outline" size={48} color={colors.gray[300]} />
                  <Text style={styles.emptyText}>No properties found</Text>
                </View>
              ) : (
                propertyData.map((prop) => (
                  <View key={prop.propertyId} style={styles.propCard}>
                    <Text style={styles.propTitle}>{prop.propertyTitle}</Text>
                    {prop.address && <Text style={styles.propAddress}>{prop.address}</Text>}

                    {/* FICA tenant status for this property */}
                    {(prop.ficaTenantsVerified > 0 || prop.ficaTenantsPending > 0) && (
                      <View style={styles.ficaStatusRow}>
                        <Ionicons name="people" size={14} color={colors.text.secondary} />
                        <Text style={styles.ficaStatusText}>
                          {prop.ficaTenantsVerified} tenant(s) verified
                          {prop.ficaTenantsPending > 0
                            ? `, ${prop.ficaTenantsPending} pending`
                            : ''}
                        </Text>
                      </View>
                    )}

                    {/* Compliance checklist — live upload tracking (Plane #69) */}
                    <View style={styles.checklistDivider} />
                    {COMPLIANCE_ITEMS.map((item) => {
                      const doc = complianceDocs[`${prop.propertyId}:${item.key}`];
                      const isUploading = uploadingKey === `${prop.propertyId}:${item.key}`;
                      return (
                        <View key={item.key} style={styles.checklistItem}>
                          <View style={styles.checklistLeft}>
                            <Ionicons
                              name={doc ? 'checkmark-circle' : 'ellipse-outline'}
                              size={18}
                              color={doc ? colors.primary[500] : colors.gray[300]}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Text style={styles.checklistLabel}>{item.label}</Text>
                              <Text style={styles.checklistLaw}>
                                {doc
                                  ? doc.created_at
                                    ? `Uploaded ${new Date(doc.created_at).toLocaleDateString()}`
                                    : 'Uploaded'
                                  : item.law}
                              </Text>
                            </View>
                          </View>
                          {isUploading ? (
                            <View style={styles.uploadBtn}>
                              <ActivityIndicator size="small" color={colors.rsa.blue} />
                            </View>
                          ) : (
                            <TouchableOpacity
                              style={[styles.uploadBtn, doc && styles.uploadBtnDone]}
                              onPress={() => handleUpload(prop, item)}
                              testID={`owner-compliance-upload-${item.key}`}
                              accessibilityRole="button"
                              accessibilityLabel={
                                doc ? `Replace ${item.label}` : `Upload ${item.label}`
                              }
                            >
                              <Ionicons
                                name={doc ? 'refresh' : 'cloud-upload-outline'}
                                size={14}
                                color={doc ? colors.primary[500] : colors.rsa.blue}
                              />
                              <Text style={[styles.uploadBtnText, doc && styles.uploadBtnTextDone]}>
                                {doc ? 'Replace' : 'Upload'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.rsa.blue,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.rsa.blue,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.info[50],
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: colors.info[700],
    lineHeight: 16,
  },
  ficaSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  ficaSummaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  ficaSummaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  ficaSummaryLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
  ficaCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  ficaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ficaName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  ficaProperty: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ficaChecks: {
    flexDirection: 'row',
    gap: 8,
  },
  ficaCheckItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 8,
  },
  ficaCheckItemTappable: {
    borderWidth: 1,
    borderColor: colors.warning[500] + '40',
    backgroundColor: colors.warning[50],
  },
  ficaCheckLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
  ficaCheckStatus: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  ficaDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  ficaDocText: {
    fontSize: 12,
    color: colors.primary[500],
    fontWeight: '600',
  },
  propCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  propTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 2,
  },
  propAddress: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 8,
  },
  ficaStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ficaStatusText: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  checklistDivider: {
    height: 1,
    backgroundColor: colors.border.default,
    marginVertical: 10,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
  },
  checklistLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  checklistLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  checklistLaw: {
    fontSize: 10,
    color: colors.text.tertiary,
  },
  uploadBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.rsa.blue + '15',
    borderWidth: 1,
    borderColor: colors.rsa.blue + '40',
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.rsa.blue,
  },
  uploadBtnDone: {
    backgroundColor: colors.primary[500] + '12',
    borderColor: colors.primary[500] + '40',
  },
  uploadBtnTextDone: {
    color: colors.primary[500],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: colors.text.tertiary,
    marginTop: 12,
  },
});
