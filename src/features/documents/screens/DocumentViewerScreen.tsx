import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { documentsApi } from '../api/documentsApi';
import {
  DocumentWithRelations,
  DocumentType,
  DOCUMENT_CATEGORIES,
} from '../types';
import { supabase } from '../../../lib/supabase';

const COLORS = {
  owner: { primary: '#002395', secondary: '#FFB81C' },
  tenant: { primary: '#007A4D', secondary: '#FFB81C' },
};

interface Props {
  role: 'owner' | 'tenant';
}

export default function DocumentViewerScreen({ role = 'owner' }: Props) {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const colors = COLORS[role];

  const [document, setDocument] = useState<DocumentWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initUser();
  }, []);

  useEffect(() => {
    if (id && userId) {
      loadDocument();
    }
  }, [id, userId]);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const loadDocument = async () => {
    if (!id) return;

    try {
      const documentId = Array.isArray(id) ? id[0] : id;
      const data = await documentsApi.getDocument(documentId);
      setDocument(data);
    } catch (error) {
      console.error('Error loading document:', error);
      Alert.alert('Error', 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!document?.file_url) return;

    setDownloading(true);
    try {
      const downloadUrl = await documentsApi.getDownloadUrl(document.file_url);
      await Linking.openURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading document:', error);
      Alert.alert('Error', 'Failed to download document');
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (!document?.file_url) return;

    try {
      const downloadUrl = await documentsApi.getDownloadUrl(document.file_url);
      await Share.share({
        message: `${document.title}\n${downloadUrl}`,
        title: document.title,
      });
    } catch (error) {
      console.error('Error sharing document:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!document) return;
            try {
              await documentsApi.deleteDocument(document.id);
              Alert.alert('Success', 'Document deleted', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              console.error('Error deleting document:', error);
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const handleExtendRetention = () => {
    Alert.alert(
      'Extend Retention',
      'How many years would you like to extend the retention period?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '1 Year',
          onPress: () => extendRetention(1),
        },
        {
          text: '3 Years',
          onPress: () => extendRetention(3),
        },
        {
          text: '5 Years',
          onPress: () => extendRetention(5),
        },
      ]
    );
  };

  const extendRetention = async (years: number) => {
    if (!document) return;
    try {
      const updated = await documentsApi.extendRetention(document.id, years);
      setDocument({ ...document, ...updated });
      Alert.alert('Success', `Retention extended by ${years} year${years > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error extending retention:', error);
      Alert.alert('Error', 'Failed to extend retention');
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysUntilExpiry = () => {
    if (!document?.delete_after) return null;
    const deleteDate = new Date(document.delete_after);
    const today = new Date();
    const diffTime = deleteDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const canDelete = () => {
    if (!document || !userId) return false;
    return document.uploaded_by === userId;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!document) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="document-outline" size={64} color="#CCC" />
          <Text style={styles.errorText}>Document not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={[styles.linkText, { color: colors.primary }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const category = DOCUMENT_CATEGORIES[document.type as DocumentType];
  const daysUntilExpiry = getDaysUntilExpiry();
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Document Details
          </Text>
          <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
            <Ionicons name="share-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Document Card */}
          <View style={styles.documentCard}>
            <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons name={category?.icon as any || 'document'} size={40} color={colors.primary} />
            </View>
            <Text style={styles.documentTitle}>{document.title}</Text>
            <Text style={styles.documentType}>{category?.label || document.type}</Text>
            {document.description && (
              <Text style={styles.documentDescription}>{document.description}</Text>
            )}
          </View>

          {/* Expiry Warning */}
          {isExpiringSoon && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color="#F5A623" />
              <View style={styles.warningContent}>
                <Text style={styles.warningTitle}>Expiring Soon</Text>
                <Text style={styles.warningText}>
                  This document will be deleted in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.extendButton, { borderColor: colors.primary }]}
                onPress={handleExtendRetention}
              >
                <Text style={[styles.extendButtonText, { color: colors.primary }]}>Extend</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Details Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Details</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>File Name</Text>
              <Text style={styles.detailValue} numberOfLines={1}>{document.filename}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>File Size</Text>
              <Text style={styles.detailValue}>{formatFileSize(document.file_size)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>File Type</Text>
              <Text style={styles.detailValue}>{document.mime_type}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Uploaded</Text>
              <Text style={styles.detailValue}>{formatDate(document.created_at)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Uploaded By</Text>
              <Text style={styles.detailValue}>{document.uploader?.full_name || 'Unknown'}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Last Accessed</Text>
              <Text style={styles.detailValue}>{formatDateTime(document.last_accessed_at)}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Access Level</Text>
              <Text style={styles.detailValue}>
                {document.access_level === 'both' ? 'Both Parties' :
                 document.access_level === 'owner_only' ? 'Owner Only' :
                 document.access_level === 'tenant_only' ? 'Tenant Only' : 'Admin Only'}
              </Text>
            </View>
          </View>

          {/* Retention Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Retention Policy</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Retention Period</Text>
              <Text style={styles.detailValue}>
                {document.retention_period_years} year{document.retention_period_years !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Scheduled Deletion</Text>
              <Text style={[
                styles.detailValue,
                isExpiringSoon && styles.expiringText
              ]}>
                {formatDate(document.delete_after)}
              </Text>
            </View>
          </View>

          {/* Related Items */}
          {(document.property || document.lease) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Related To</Text>

              {document.property && (
                <View style={styles.relatedItem}>
                  <Ionicons name="home-outline" size={20} color="#666" />
                  <Text style={styles.relatedText}>{document.property.title}</Text>
                </View>
              )}

              {document.lease && (
                <View style={styles.relatedItem}>
                  <Ionicons name="document-text-outline" size={20} color="#666" />
                  <Text style={styles.relatedText}>
                    Lease: {formatDate(document.lease.start_date)} - {formatDate(document.lease.end_date)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Tags */}
          {document.tags && document.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsContainer}>
                {document.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>Download</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.secondaryButton]}
              onPress={handleExtendRetention}
            >
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>
                Extend Retention
              </Text>
            </TouchableOpacity>

            {canDelete() && (
              <TouchableOpacity
                style={[styles.actionButton, styles.dangerButton]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={20} color="#E53935" />
                <Text style={[styles.actionButtonText, { color: '#E53935' }]}>
                  Delete Document
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

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
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 12,
  },
  linkText: {
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
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  shareButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  documentCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  documentTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  documentType: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  documentDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    gap: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F5A623',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 13,
    color: '#666',
  },
  extendButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  extendButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFF',
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  expiringText: {
    color: '#F5A623',
  },
  relatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  relatedText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: '#666',
  },
  actionsSection: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dangerButton: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
});
