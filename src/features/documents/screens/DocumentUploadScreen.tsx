import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { documentsApi } from '../api/documentsApi';
import {
  DocumentType,
  AccessLevel,
  DOCUMENT_CATEGORIES,
  FileInfo,
} from '../types';
import { supabase } from '../../../lib/supabase';

const COLORS = {
  owner: { primary: '#002395', secondary: '#FFB81C' },
  tenant: { primary: '#007A4D', secondary: '#FFB81C' },
};

interface Props {
  role: 'owner' | 'tenant';
  propertyId?: string;
  leaseId?: string;
  tenantId?: string;
}

export default function DocumentUploadScreen({
  role = 'owner',
  propertyId,
  leaseId,
  tenantId,
}: Props) {
  const router = useRouter();
  const colors = COLORS[role];

  const [userId, setUserId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('both');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    initUser();
  }, []);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const category = DOCUMENT_CATEGORIES[documentType];
        const maxSizeBytes = category.maxSize * 1024 * 1024;

        if (asset.size && asset.size > maxSizeBytes) {
          Alert.alert(
            'File Too Large',
            `Maximum file size is ${category.maxSize}MB. Please select a smaller file.`
          );
          return;
        }

        setSelectedFile({
          uri: asset.uri,
          name: asset.name || 'document',
          size: asset.size || 0,
          mimeType: asset.mimeType || 'application/pdf',
        });

        // Auto-fill title if empty
        if (!title && asset.name) {
          const nameWithoutExt = asset.name.replace(/\.[^/.]+$/, '');
          setTitle(nameWithoutExt);
        }
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setUploading(true);

    try {
      const tagArray = tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await documentsApi.uploadDocument(
        selectedFile,
        {
          type: documentType,
          title: title.trim(),
          description: description.trim() || undefined,
          access_level: accessLevel,
          property_id: propertyId,
          lease_id: leaseId,
          tenant_id: tenantId,
          owner_id: role === 'owner' ? userId : undefined,
          tags: tagArray.length > 0 ? tagArray : undefined,
        },
        userId
      );

      Alert.alert('Success', 'Document uploaded successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const renderTypePicker = () => {
    if (!showTypePicker) return null;

    return (
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Document Type</Text>
            <TouchableOpacity onPress={() => setShowTypePicker(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList}>
            {Object.values(DOCUMENT_CATEGORIES).map(category => (
              <TouchableOpacity
                key={category.type}
                style={[
                  styles.pickerItem,
                  documentType === category.type && { backgroundColor: `${colors.primary}10` },
                ]}
                onPress={() => {
                  setDocumentType(category.type);
                  setShowTypePicker(false);
                }}
              >
                <Ionicons
                  name={category.icon as any}
                  size={24}
                  color={documentType === category.type ? colors.primary : '#666'}
                />
                <View style={styles.pickerItemContent}>
                  <Text
                    style={[
                      styles.pickerItemLabel,
                      documentType === category.type && { color: colors.primary },
                    ]}
                  >
                    {category.label}
                  </Text>
                  <Text style={styles.pickerItemDescription}>
                    {category.description}
                  </Text>
                </View>
                {documentType === category.type && (
                  <Ionicons name="checkmark" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  const selectedCategory = DOCUMENT_CATEGORIES[documentType];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Document</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* File Picker */}
          <TouchableOpacity style={styles.filePicker} onPress={pickDocument}>
            {selectedFile ? (
              <View style={styles.selectedFile}>
                <View style={[styles.fileIcon, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons name="document" size={32} color={colors.primary} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileSize}>{formatFileSize(selectedFile.size)}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeFile}
                  onPress={() => setSelectedFile(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#999" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyPicker}>
                <Ionicons name="cloud-upload-outline" size={48} color="#CCC" />
                <Text style={styles.pickerLabel}>Tap to select a file</Text>
                <Text style={styles.pickerHint}>
                  PDF or images up to {selectedCategory.maxSize}MB
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Document Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Document Type *</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowTypePicker(true)}
            >
              <Ionicons name={selectedCategory.icon as any} size={20} color="#666" />
              <Text style={styles.selectText}>{selectedCategory.label}</Text>
              <Ionicons name="chevron-down" size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter document title"
              maxLength={100}
            />
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description..."
              multiline
              numberOfLines={3}
              maxLength={500}
            />
          </View>

          {/* Access Level */}
          <View style={styles.section}>
            <Text style={styles.label}>Who can access this document?</Text>
            <View style={styles.accessOptions}>
              {([
                { value: 'both', label: 'Both parties', icon: 'people' },
                { value: 'owner_only', label: 'Owner only', icon: 'person' },
                { value: 'tenant_only', label: 'Tenant only', icon: 'person-outline' },
              ] as const).map(option => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.accessOption,
                    accessLevel === option.value && { borderColor: colors.primary, backgroundColor: `${colors.primary}10` },
                  ]}
                  onPress={() => setAccessLevel(option.value)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={accessLevel === option.value ? colors.primary : '#666'}
                  />
                  <Text
                    style={[
                      styles.accessLabel,
                      accessLevel === option.value && { color: colors.primary },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.label}>Tags (Optional)</Text>
            <TextInput
              style={styles.input}
              value={tags}
              onChangeText={setTags}
              placeholder="e.g., 2024, tax, annual"
            />
            <Text style={styles.hint}>Separate tags with commas</Text>
          </View>

          {/* Retention Info */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color="#666" />
            <Text style={styles.infoText}>
              This document will be retained for {selectedCategory.retentionYears} years as per{' '}
              {selectedCategory.label.toLowerCase()} policy. You'll be notified before deletion.
            </Text>
          </View>
        </ScrollView>

        {/* Upload Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.uploadButton,
              { backgroundColor: colors.primary },
              (!selectedFile || !title.trim() || uploading) && styles.buttonDisabled,
            ]}
            onPress={handleUpload}
            disabled={!selectedFile || !title.trim() || uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#FFF" />
                <Text style={styles.uploadButtonText}>Upload Document</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Type Picker Modal */}
      {renderTypePicker()}
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  filePicker: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  emptyPicker: {
    alignItems: 'center',
    padding: 40,
  },
  pickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginTop: 12,
  },
  pickerHint: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
  },
  selectedFile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  fileIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 13,
    color: '#666',
  },
  removeFile: {
    padding: 4,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  selectText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  accessOptions: {
    flexDirection: 'row',
    gap: 10,
  },
  accessOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 6,
  },
  accessLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Type Picker Modal
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  pickerList: {
    padding: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  pickerItemContent: {
    flex: 1,
  },
  pickerItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  pickerItemDescription: {
    fontSize: 12,
    color: '#999',
  },
});
