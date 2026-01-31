import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// import * as DocumentPicker from 'expo-document-picker'; // TODO: Install expo-document-picker
import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/shared/theme/colors';
import { vendorProfileApi, VendorDocument } from '@/src/features/vendor/api/profileApi';

const DOCUMENT_TYPES = [
  { value: 'ID', label: 'ID Document', icon: '🪪' },
  { value: 'PoliceClearance', label: 'Police Clearance', icon: '👮' },
  { value: 'Insurance', label: 'Insurance Certificate', icon: '🛡️' },
  { value: 'License', label: 'Trade License', icon: '📜' },
  { value: 'Certificate', label: 'Qualification Certificate', icon: '🎓' },
  { value: 'Other', label: 'Other Document', icon: '📄' },
];

export default function DocumentsManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, [user?.id]);

  const loadDocuments = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const profileData = await vendorProfileApi.getProfile(user.id);
      if (profileData) {
        setDocuments(profileData.documents);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      Alert.alert('Error', 'Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickDocument = async () => {
    if (!selectedDocType) {
      Alert.alert('Error', 'Please select a document type first');
      return;
    }

    // TODO: Implement document picker once expo-document-picker is installed
    Alert.alert('Coming Soon', 'Document upload will be available soon');
    
    // try {
    //   const result = await DocumentPicker.getDocumentAsync({
    //     type: ['application/pdf', 'image/*'],
    //     copyToCacheDirectory: true,
    //   });

    //   if (result.canceled) {
    //     return;
    //   }

    //   const file = result.assets[0];
    //   await handleUploadDocument(file.uri);
    // } catch (error) {
    //   console.error('Error picking document:', error);
    //   Alert.alert('Error', 'Failed to pick document. Please try again.');
    // }
  };

  const handleUploadDocument = async (fileUri: string) => {
    if (!user?.id) return;

    try {
      setUploading(true);
      const newDoc = await vendorProfileApi.uploadDocument(
        user.id,
        selectedDocType,
        fileUri
      );

      setDocuments([newDoc, ...documents]);
      setShowAddModal(false);
      setSelectedDocType('');
      Alert.alert('Success', 'Document uploaded successfully. It will be reviewed shortly.');
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = (doc: VendorDocument) => {
    const docType = DOCUMENT_TYPES.find((t) => t.value === doc.doc_type);
    Alert.alert('Delete Document', `Delete ${docType?.label || doc.doc_type}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await vendorProfileApi.deleteDocument(doc.id);
            setDocuments(documents.filter((d) => d.id !== doc.id));
            Alert.alert('Success', 'Document deleted');
          } catch (error) {
            console.error('Error deleting document:', error);
            Alert.alert('Error', 'Failed to delete document');
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.rsa.green;
      case 'rejected':
        return colors.rsa.red;
      default:
        return colors.rsa.gold; // Using gold instead of yellow
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'checkmark-circle';
      case 'rejected':
        return 'close-circle';
      default:
        return 'time';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Pending Review';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Documents</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  const pendingDocs = documents.filter((d) => d.status === 'pending');
  const approvedDocs = documents.filter((d) => d.status === 'approved');
  const rejectedDocs = documents.filter((d) => d.status === 'rejected');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Documents</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color={colors.rsa.blue} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>Why upload documents?</Text>
            <Text style={styles.infoText}>
              Verified documents help build trust with property owners and increase your
              chances of getting hired.
            </Text>
          </View>
        </View>

        {/* Add Document Button */}
        <Pressable
          style={styles.addDocumentButton}
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add-circle" size={24} color={colors.background.default} />
          <Text style={styles.addDocumentText}>Upload New Document</Text>
        </Pressable>

        {/* Documents List */}
        {documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📄</Text>
            <Text style={styles.emptyText}>No documents uploaded yet</Text>
            <Text style={styles.emptySubtext}>
              Upload your business documents to get verified
            </Text>
          </View>
        ) : (
          <>
            {/* Pending Documents */}
            {pendingDocs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⏳ Pending Review</Text>
                <View style={styles.card}>
                  {pendingDocs.map((doc, index) => {
                    const docType = DOCUMENT_TYPES.find((t) => t.value === doc.doc_type);
                    return (
                      <View
                        key={doc.id}
                        style={[styles.docItem, index > 0 && styles.docItemBorder]}
                      >
                        <Text style={styles.docIcon}>{docType?.icon || '📄'}</Text>
                        <View style={styles.docInfo}>
                          <Text style={styles.docTitle}>
                            {docType?.label || doc.doc_type}
                          </Text>
                          <Text style={styles.docDate}>
                            Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Unknown'}
                          </Text>
                        </View>
                        <View style={styles.docActions}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: getStatusColor(doc.status) + '20' },
                            ]}
                          >
                            <Ionicons
                              name={getStatusIcon(doc.status) as any}
                              size={14}
                              color={getStatusColor(doc.status)}
                            />
                            <Text
                              style={[
                                styles.statusText,
                                { color: getStatusColor(doc.status) },
                              ]}
                            >
                              {getStatusText(doc.status)}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.deleteButton}
                            onPress={() => handleDeleteDocument(doc)}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.rsa.red} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Approved Documents */}
            {approvedDocs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✅ Approved</Text>
                <View style={styles.card}>
                  {approvedDocs.map((doc, index) => {
                    const docType = DOCUMENT_TYPES.find((t) => t.value === doc.doc_type);
                    return (
                      <View
                        key={doc.id}
                        style={[styles.docItem, index > 0 && styles.docItemBorder]}
                      >
                        <Text style={styles.docIcon}>{docType?.icon || '📄'}</Text>
                        <View style={styles.docInfo}>
                          <Text style={styles.docTitle}>
                            {docType?.label || doc.doc_type}
                          </Text>
                          <Text style={styles.docDate}>
                            Approved {doc.reviewed_at ? new Date(doc.reviewed_at).toLocaleDateString() : doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Unknown'}
                          </Text>
                        </View>
                        <View style={styles.docActions}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: getStatusColor(doc.status) + '20' },
                            ]}
                          >
                            <Ionicons
                              name={getStatusIcon(doc.status) as any}
                              size={14}
                              color={getStatusColor(doc.status)}
                            />
                            <Text
                              style={[
                                styles.statusText,
                                { color: getStatusColor(doc.status) },
                              ]}
                            >
                              {getStatusText(doc.status)}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.deleteButton}
                            onPress={() => handleDeleteDocument(doc)}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.rsa.red} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Rejected Documents */}
            {rejectedDocs.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>❌ Rejected</Text>
                <View style={styles.card}>
                  {rejectedDocs.map((doc, index) => {
                    const docType = DOCUMENT_TYPES.find((t) => t.value === doc.doc_type);
                    return (
                      <View
                        key={doc.id}
                        style={[styles.docItem, index > 0 && styles.docItemBorder]}
                      >
                        <Text style={styles.docIcon}>{docType?.icon || '📄'}</Text>
                        <View style={styles.docInfo}>
                          <Text style={styles.docTitle}>
                            {docType?.label || doc.doc_type}
                          </Text>
                          {doc.notes && (
                            <Text style={styles.docNotes}>Reason: {doc.notes}</Text>
                          )}
                          <Text style={styles.docDate}>
                            Rejected {doc.reviewed_at ? new Date(doc.reviewed_at).toLocaleDateString() : doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : 'Unknown'}
                          </Text>
                        </View>
                        <View style={styles.docActions}>
                          <View
                            style={[
                              styles.statusBadge,
                              { backgroundColor: getStatusColor(doc.status) + '20' },
                            ]}
                          >
                            <Ionicons
                              name={getStatusIcon(doc.status) as any}
                              size={14}
                              color={getStatusColor(doc.status)}
                            />
                            <Text
                              style={[
                                styles.statusText,
                                { color: getStatusColor(doc.status) },
                              ]}
                            >
                              {getStatusText(doc.status)}
                            </Text>
                          </View>
                          <Pressable
                            style={styles.deleteButton}
                            onPress={() => handleDeleteDocument(doc)}
                          >
                            <Ionicons name="trash-outline" size={18} color={colors.rsa.red} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Add Document Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Document</Text>
              <Pressable onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text.primary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.label}>
                Document Type <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.docTypeContainer}>
                {DOCUMENT_TYPES.map((type) => (
                  <Pressable
                    key={type.value}
                    style={[
                      styles.docTypeCard,
                      selectedDocType === type.value && styles.docTypeCardSelected,
                    ]}
                    onPress={() => setSelectedDocType(type.value)}
                  >
                    <Text style={styles.docTypeIcon}>{type.icon}</Text>
                    <Text
                      style={[
                        styles.docTypeLabel,
                        selectedDocType === type.value && styles.docTypeLabelSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.helperText}>
                💡 Accepted formats: PDF, JPG, PNG (Max 10MB)
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  !selectedDocType && styles.modalButtonDisabled,
                ]}
                onPress={handlePickDocument}
                disabled={!selectedDocType || uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.background.default} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload" size={20} color={colors.background.default} />
                    <Text style={styles.modalButtonTextPrimary}>Choose File</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    backgroundColor: colors.background.default,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: colors.rsa.blue + '10',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.rsa.blue + '30',
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  addDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.rsa.blue,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  addDocumentText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background.default,
  },
  emptyCard: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  docItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  docIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  docDate: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  docNotes: {
    fontSize: 13,
    color: colors.rsa.red,
    marginTop: 2,
    marginBottom: 2,
  },
  docActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background.default,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalScroll: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 12,
  },
  required: {
    color: colors.rsa.red,
  },
  docTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  docTypeCard: {
    width: '47%',
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  docTypeCardSelected: {
    backgroundColor: colors.rsa.blue + '20',
    borderColor: colors.rsa.blue,
    borderWidth: 2,
  },
  docTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  docTypeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text.primary,
    textAlign: 'center',
  },
  docTypeLabelSelected: {
    fontWeight: '600',
    color: colors.rsa.blue,
  },
  helperText: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 8,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  modalButtonSecondary: {
    backgroundColor: colors.background.secondary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  modalButtonPrimary: {
    backgroundColor: colors.rsa.blue,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  modalButtonTextPrimary: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.background.default,
  },
});
