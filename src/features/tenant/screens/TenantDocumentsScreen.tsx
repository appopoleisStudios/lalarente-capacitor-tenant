/**
 * Tenant Documents Screen — Profile-Level Documents Hub
 *
 * 3 sections:
 * A) Verification Documents — mandatory platform docs (ID, income, utility bill)
 * B) Inspection Reports — completed/signed inspections with property name
 * C) Rental Documents — lease agreements, receipts, etc. from documents table
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '@/src/shared/theme/colors';
import { supabase } from '@/src/lib/supabase';
import { documentsApi } from '@/src/features/documents/api/documentsApi';
import { DOCUMENT_CATEGORIES } from '@/src/features/documents/types';
import type { Document, DocumentType, FileInfo } from '@/src/features/documents/types';

// ── Types ──

interface VerificationDoc {
  type: DocumentType;
  label: string;
  icon: string;
  doc: Document | null;
}

interface InspectionRow {
  id: string;
  type: string;
  status: string;
  overall_condition: string | null;
  completed_date: string | null;
  scheduled_date: string;
  report_url: string | null;
  tenant_signed_at: string | null;
  owner_signed_at: string | null;
  propertyTitle: string;
}

// Mandatory verification document types
const MANDATORY_TYPES: DocumentType[] = ['id_document', 'proof_of_income', 'utility_bill'];

// Types that belong in Section C (non-verification rental docs)
const VERIFICATION_TYPE_SET = new Set<string>(MANDATORY_TYPES);

export default function TenantDocumentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Section A
  const [verificationDocs, setVerificationDocs] = useState<VerificationDoc[]>([]);
  // Section B
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  // Section C
  const [rentalDocs, setRentalDocs] = useState<Document[]>([]);

  const [uploading, setUploading] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      await Promise.all([
        loadVerificationDocs(user.id),
        loadInspections(user.id),
        loadRentalDocs(user.id),
      ]);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Section A: Verification Docs ──

  const loadVerificationDocs = async (uid: string) => {
    const docs = await documentsApi.getTenantVerificationDocs(uid);

    // Dedupe: latest per type
    const latestByType = new Map<string, Document>();
    for (const doc of docs) {
      if (!latestByType.has(doc.type)) {
        latestByType.set(doc.type, doc);
      }
    }

    setVerificationDocs(
      MANDATORY_TYPES.map((type) => ({
        type,
        label: DOCUMENT_CATEGORIES[type].label,
        icon: DOCUMENT_CATEGORIES[type].icon,
        doc: latestByType.get(type) || null,
      }))
    );
  };

  // ── Section B: Inspection Reports ──

  const loadInspections = async (uid: string) => {
    const { data, error } = await supabase
      .from('inspections')
      .select(`
        id, type, status, overall_condition, completed_date,
        scheduled_date, report_url, tenant_signed_at, owner_signed_at,
        property:properties!property_id(id, title)
      `)
      .eq('tenant_id', uid)
      .in('status', ['completed', 'signed'])
      .order('completed_date', { ascending: false });

    if (error) {
      console.error('Error fetching inspections:', error);
      return;
    }

    setInspections(
      (data || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        overall_condition: row.overall_condition,
        completed_date: row.completed_date,
        scheduled_date: row.scheduled_date,
        report_url: row.report_url,
        tenant_signed_at: row.tenant_signed_at,
        owner_signed_at: row.owner_signed_at,
        propertyTitle: row.property?.title || 'Property',
      }))
    );
  };

  // ── Section C: Rental Documents ──

  const loadRentalDocs = async (uid: string) => {
    const allDocs = await documentsApi.getUserDocuments(uid, 'tenant');
    setRentalDocs(allDocs.filter((d) => !VERIFICATION_TYPE_SET.has(d.type)));
  };

  // ── File picker ──

  const pickFile = async (): Promise<FileInfo | null> => {
    return new Promise((resolve) => {
      Alert.alert('Upload Document', 'Choose source', [
        {
          text: 'Photo Library',
          onPress: async () => {
            const mediaPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!mediaPerm.granted) {
              Alert.alert('Permission Required', 'Please allow photo library access to upload documents.');
              resolve(null);
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });
            if (result.canceled || !result.assets[0]) { resolve(null); return; }
            const asset = result.assets[0];
            resolve({
              uri: asset.uri,
              name: asset.fileName || `photo_${Date.now()}.jpg`,
              size: asset.fileSize || 0,
              mimeType: asset.mimeType || 'image/jpeg',
            });
          },
        },
        {
          text: 'Take Photo',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Permission Required', 'Please allow camera access');
              resolve(null);
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.8,
            });
            if (result.canceled || !result.assets[0]) { resolve(null); return; }
            const asset = result.assets[0];
            resolve({
              uri: asset.uri,
              name: asset.fileName || `photo_${Date.now()}.jpg`,
              size: asset.fileSize || 0,
              mimeType: asset.mimeType || 'image/jpeg',
            });
          },
        },
        {
          text: 'Choose File (PDF or image)',
          onPress: async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'application/pdf'],
                copyToCacheDirectory: true,
              });
              if (result.canceled || !result.assets?.[0]) { resolve(null); return; }
              const asset = result.assets[0];
              resolve({
                uri: asset.uri,
                name: asset.name || `file_${Date.now()}.pdf`,
                size: asset.size || 0,
                mimeType: asset.mimeType || 'application/octet-stream',
              });
            } catch {
              resolve(null);
            }
          },
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ]);
    });
  };

  const handleUploadVerification = async (type: DocumentType) => {
    const file = await pickFile();
    if (!file || !userId) return;

    setUploading(type);
    try {
      await documentsApi.uploadDocument(file, {
        type,
        title: DOCUMENT_CATEGORIES[type].label,
        access_level: 'tenant_only',
        tenant_id: userId,
      }, userId);
      await loadVerificationDocs(userId);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload document');
    } finally {
      setUploading(null);
    }
  };

  const openUrl = async (url: string) => {
    try {
      const downloadUrl = await documentsApi.getDownloadUrl(url);
      await WebBrowser.openBrowserAsync(downloadUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
    } catch {
      Alert.alert('Error', 'Failed to open document.');
    }
  };

  // ── Helpers ──

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-ZA', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const inspectionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      move_in: 'Move-in',
      move_out: 'Move-out',
      routine: 'Routine',
      periodic: 'Periodic',
    };
    return labels[type] || type;
  };

  const inspectionTypeBg = (type: string) => {
    const bgs: Record<string, string> = {
      move_in: colors.primary[500],
      move_out: colors.rsa.red,
      routine: colors.info[500],
      periodic: colors.secondary[500],
    };
    return bgs[type] || colors.gray[400];
  };

  const conditionColor = (condition: string | null) => {
    if (!condition) return colors.gray[400];
    const map: Record<string, string> = {
      excellent: colors.primary[500],
      good: colors.primary[400],
      fair: colors.warning[500],
      poor: colors.error[500],
    };
    return map[condition.toLowerCase()] || colors.gray[400];
  };

  const docTypeLabel = (type: string) => {
    const cat = DOCUMENT_CATEGORIES[type as DocumentType];
    return cat?.label || type.replace(/_/g, ' ');
  };

  const docTypeIcon = (type: string) => {
    const cat = DOCUMENT_CATEGORIES[type as DocumentType];
    return cat?.icon || 'document-outline';
  };

  // ── Render ──

  const renderVerificationSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="shield-checkmark" size={20} color={colors.rsa.green} />
        <Text style={styles.sectionTitle}>Verification Documents</Text>
      </View>
      <Text style={styles.sectionSub}>
        Required for all rental applications. Upload once — valid across all properties.
      </Text>

      {verificationDocs.map((item) => {
        const status = item.doc?.verification_status || null;
        const isVerified = status === 'verified';
        const isRejected = status === 'rejected';

        return (
          <View key={item.type} style={styles.docCard}>
            <View style={styles.docCardLeft}>
              <View style={[styles.docIconWrap, {
                backgroundColor: item.doc
                  ? (isRejected ? colors.error[50] : colors.primary[50])
                  : colors.gray[100],
              }]}>
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={item.doc
                    ? (isRejected ? colors.error[500] : colors.primary[500])
                    : colors.gray[400]
                  }
                />
              </View>
              <View style={styles.docCardInfo}>
                <Text style={styles.docCardLabel}>{item.label}</Text>
                {item.doc ? (
                  <>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusBadge, {
                        backgroundColor: isRejected ? colors.error[50] : colors.primary[50],
                      }]}>
                        <Ionicons
                          name={isRejected ? 'close-circle' : 'checkmark-circle'}
                          size={12}
                          color={isRejected ? colors.error[500] : colors.primary[500]}
                        />
                        <Text style={[styles.statusBadgeText, {
                          color: isRejected ? colors.error[500] : colors.primary[500],
                        }]}>
                          {isVerified ? 'Verified' : isRejected ? 'Rejected' : status}
                        </Text>
                      </View>
                    </View>
                    {isRejected && item.doc.rejection_reason && (
                      <Text style={styles.rejectionText}>{item.doc.rejection_reason}</Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.docMissing}>Not uploaded</Text>
                )}
              </View>
            </View>

            <View style={styles.docCardActions}>
              {item.doc && !isRejected ? (
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => openUrl(item.doc!.file_url)}
                >
                  <Text style={styles.viewBtnText}>View</Text>
                </TouchableOpacity>
              ) : uploading === item.type ? (
                <ActivityIndicator size="small" color={colors.rsa.green} />
              ) : (
                <TouchableOpacity
                  style={[styles.uploadBtn, isRejected && styles.reuploadBtn]}
                  onPress={() => handleUploadVerification(item.type)}
                >
                  <Ionicons
                    name={isRejected ? 'refresh-outline' : 'cloud-upload-outline'}
                    size={14}
                    color={isRejected ? colors.error[500] : colors.rsa.green}
                  />
                  <Text style={[styles.uploadBtnText, isRejected && styles.reuploadBtnText]}>
                    {isRejected ? 'Re-upload' : 'Upload'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderInspectionsSection = () => {
    if (inspections.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="clipboard" size={20} color={colors.info[500]} />
          <Text style={styles.sectionTitle}>Inspection Reports</Text>
        </View>

        {inspections.map((insp) => (
          <View key={insp.id} style={styles.inspectionCard}>
            <View style={styles.inspectionTop}>
              <View style={[styles.inspTypeBadge, { backgroundColor: inspectionTypeBg(insp.type) }]}>
                <Text style={styles.inspTypeBadgeText}>{inspectionTypeLabel(insp.type)}</Text>
              </View>
              {insp.overall_condition && (
                <Text style={[styles.conditionText, { color: conditionColor(insp.overall_condition) }]}>
                  {insp.overall_condition}
                </Text>
              )}
            </View>

            <Text style={styles.inspPropName}>{insp.propertyTitle}</Text>
            <Text style={styles.inspDate}>
              {formatDate(insp.completed_date || insp.scheduled_date)}
            </Text>

            <View style={styles.inspFooter}>
              <View style={styles.signatureRow}>
                <Ionicons
                  name={insp.tenant_signed_at ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={insp.tenant_signed_at ? colors.primary[500] : colors.gray[300]}
                />
                <Text style={styles.signatureLabel}>Tenant signed</Text>
                <Ionicons
                  name={insp.owner_signed_at ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={insp.owner_signed_at ? colors.primary[500] : colors.gray[300]}
                  style={{ marginLeft: 12 }}
                />
                <Text style={styles.signatureLabel}>Owner signed</Text>
              </View>

              {insp.report_url && (
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => openUrl(insp.report_url!)}
                >
                  <Text style={styles.viewBtnText}>View Report</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderRentalDocsSection = () => {
    if (rentalDocs.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="folder-open" size={20} color={colors.secondary[500]} />
          <Text style={styles.sectionTitle}>Rental Documents</Text>
        </View>

        {rentalDocs.map((doc) => (
          <View key={doc.id} style={styles.rentalDocRow}>
            <View style={styles.rentalDocLeft}>
              <Ionicons
                name={docTypeIcon(doc.type) as any}
                size={18}
                color={colors.gray[500]}
              />
              <View style={styles.rentalDocInfo}>
                <Text style={styles.rentalDocTitle} numberOfLines={1}>{doc.title}</Text>
                <View style={styles.rentalDocMeta}>
                  <Text style={styles.rentalDocType}>{docTypeLabel(doc.type)}</Text>
                  {doc.created_at && (
                    <Text style={styles.rentalDocDate}>{formatDate(doc.created_at)}</Text>
                  )}
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => openUrl(doc.file_url)}
            >
              <Text style={styles.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Documents</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* FICA info */}
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.info[500]} />
            <Text style={styles.infoText}>
              FICA requires identity verification before renting. Upload your documents once —
              they apply to all your applications and rentals.
            </Text>
          </View>

          {renderVerificationSection()}
          {renderInspectionsSection()}
          {renderRentalDocsSection()}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.secondary },
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
  content: { flex: 1, padding: 16 },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.info[50],
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
  },
  infoText: { flex: 1, fontSize: 12, color: colors.info[700], lineHeight: 17 },

  // Section
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
  sectionSub: { fontSize: 12, color: colors.text.tertiary, marginBottom: 12, marginLeft: 28 },

  // Verification doc card
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  docCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docCardInfo: { marginLeft: 12, flex: 1 },
  docCardLabel: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  docMissing: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  docCardActions: { marginLeft: 8 },

  // Status badge
  statusRow: { flexDirection: 'row', marginTop: 4 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  rejectionText: { fontSize: 11, color: colors.error[500], marginTop: 4, lineHeight: 15 },

  // Buttons
  viewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.rsa.blue + '15',
    borderWidth: 1,
    borderColor: colors.rsa.blue + '40',
  },
  viewBtnText: { fontSize: 12, fontWeight: '600', color: colors.rsa.blue },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.rsa.green + '60',
    backgroundColor: colors.rsa.green + '08',
  },
  uploadBtnText: { fontSize: 12, fontWeight: '600', color: colors.rsa.green },
  reuploadBtn: {
    borderColor: colors.error[500] + '60',
    backgroundColor: colors.error[50],
  },
  reuploadBtnText: { color: colors.error[500] },

  // Inspection card
  inspectionCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  inspectionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inspTypeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  inspTypeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  conditionText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  inspPropName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  inspDate: { fontSize: 12, color: colors.text.tertiary, marginTop: 2 },
  inspFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  signatureRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signatureLabel: { fontSize: 11, color: colors.text.tertiary },

  // Rental doc row
  rentalDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.default,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  rentalDocLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rentalDocInfo: { marginLeft: 10, flex: 1 },
  rentalDocTitle: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  rentalDocMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
  rentalDocType: { fontSize: 11, color: colors.text.tertiary },
  rentalDocDate: { fontSize: 11, color: colors.text.tertiary },
});
