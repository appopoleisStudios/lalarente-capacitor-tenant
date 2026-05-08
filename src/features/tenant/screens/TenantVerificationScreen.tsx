/**
 * Tenant Verification Screen
 * Tenant approves or rejects completed maintenance work
 *
 * Approve: Optional notes, quick confirm
 * Reject: Required reason (min 10 chars) + photos (min 1)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/src/lib/supabase';
import { uploadFile } from '@/src/lib/storage';
import {
  tenantApproveCompletion,
  tenantRejectCompletion,
} from '@/src/features/maintenance/api/work/tenantVerification.api';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

export default function TenantVerificationScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      })
      .catch((error) => {
        console.error('Error loading tenant user:', error);
      });
  }, []);
  const params = useLocalSearchParams();

  // Parse params
  const requestId = params.requestId as string;
  const completionNotes = params.completionNotes as string;
  const completionPhotosJson = params.completionPhotos as string;
  const completionPhotos = React.useMemo(() => {
    if (!completionPhotosJson) {
      return [];
    }

    try {
      const parsed = JSON.parse(completionPhotosJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('Invalid completion photos payload:', error);
      return [];
    }
  }, [completionPhotosJson]);

  // State
  const [mode, setMode] = useState<'select' | 'approve' | 'reject'>('select');
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionPhotos, setRejectionPhotos] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      const photoUri = result.assets[0].uri;
      setRejectionPhotos([...rejectionPhotos, photoUri]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setRejectionPhotos(rejectionPhotos.filter((_, i) => i !== index));
  };

  const handleApprove = async () => {
    if (!userId) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    try {
      setIsSubmitting(true);

      await tenantApproveCompletion(requestId, userId, notes.trim() || undefined);

      Alert.alert(
        'Work Approved',
        'Thank you for verifying the completed work. The property manager can now close this request.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error approving work:', error);
      Alert.alert('Error', error.message || 'Failed to approve work');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!userId) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    // Validation
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      Alert.alert('Required', 'Please provide a reason of at least 10 characters');
      return;
    }

    if (rejectionPhotos.length < 1) {
      Alert.alert('Required', 'Please upload at least 1 photo showing the issue');
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload rejection photos to Supabase Storage
      const uploadedUrls: string[] = [];
      for (const uri of rejectionPhotos) {
        const result = await uploadFile('MAINTENANCE_MEDIA', {
          uri,
          name: `rejection_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`,
          type: 'image/jpeg',
        }, `rejections/${requestId}`);
        if (result.error) {
          Alert.alert('Upload Error', 'Failed to upload one or more photos. Please try again.');
          setIsSubmitting(false);
          return;
        }
        uploadedUrls.push(result.url);
      }

      await tenantRejectCompletion(
        requestId,
        userId!,
        rejectionReason.trim(),
        uploadedUrls
      );

      Alert.alert(
        'Work Rejected',
        'Your feedback has been sent. The vendor will be notified to fix the issues.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error rejecting work:', error);
      Alert.alert('Error', error.message || 'Failed to reject work');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'select') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Verify Completed Work</Text>
          <Text style={styles.subtitle}>
            Please review the work and let us know if everything is satisfactory
          </Text>
        </View>

        {/* Vendor Completion Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Completion Notes</Text>
          <Text style={styles.completionNotes}>{completionNotes || 'No notes provided'}</Text>
        </View>

        {/* Completion Photos */}
        {completionPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completion Photos ({completionPhotos.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.photoGrid}>
                {completionPhotos.map((photo: string, index: number) => (
                  <Image key={index} source={{ uri: photo }} style={styles.completionPhoto} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Decision Buttons */}
        <View style={styles.decisionContainer}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => setMode('approve')}
          >
            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
            <Text style={styles.approveButtonText}>Work is Satisfactory</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => setMode('reject')}
          >
            <Ionicons name="close-circle" size={24} color="#DC2626" />
            <Text style={styles.rejectButtonText}>Work Needs Fixes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (mode === 'approve') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMode('select')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.title}>Approve Work</Text>
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#10B981" />
        </View>

        {/* Optional Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feedback (Optional)</Text>
          <Text style={styles.helperText}>
            Add any comments about the work quality or vendor professionalism
          </Text>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="E.g., Work completed quickly and professionally..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Confirm Button */}
        <TouchableOpacity
          style={[styles.submitButton, styles.approveButtonSolid, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleApprove}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Confirm - Work is Complete</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Reject mode
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setMode('select')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.title}>Report Issues</Text>
      </View>

      {/* Warning Icon */}
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle" size={80} color="#F59E0B" />
      </View>

      {/* Warning Message */}
      <View style={styles.warningCard}>
        <Ionicons name="information-circle" size={20} color="#D97706" />
        <Text style={styles.warningText}>
          The vendor will be asked to return and fix the issues you report. Please be specific about what needs attention.
        </Text>
      </View>

      {/* Rejection Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What needs to be fixed? *</Text>
        <Text style={styles.helperText}>
          Please describe the issues in detail (minimum 10 characters)
        </Text>
        <TextInput
          style={styles.textArea}
          value={rejectionReason}
          onChangeText={setRejectionReason}
          placeholder="E.g., Leak is still present under the sink, water damage not repaired..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>
          {rejectionReason.length}/10 characters
        </Text>
      </View>

      {/* Photo Upload */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upload Photos of Issues *</Text>
        <Text style={styles.helperText}>
          Take photos showing what needs to be fixed (minimum 1 photo required)
        </Text>

        {rejectionPhotos.length > 0 && (
          <View style={styles.photoGrid}>
            {rejectionPhotos.map((photo, index) => (
              <View key={index} style={styles.photoContainer}>
                <Image source={{ uri: photo }} style={styles.rejectionPhoto} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => handleRemovePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.uploadButton} onPress={handlePickImage}>
          <Ionicons name="camera" size={24} color="#3B82F6" />
          <Text style={styles.uploadButtonText}>
            {rejectionPhotos.length > 0 ? 'Add More Photos' : 'Take / Upload Photo'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, styles.rejectButtonSolid, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleReject}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Issues for Vendor</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  section: {
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  completionNotes: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  completionPhoto: {
    width: 120,
    height: 120,
    borderRadius: 8,
  },
  decisionContainer: {
    gap: 12,
    marginTop: 8,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
  },
  approveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DC2626',
    borderRadius: 12,
    padding: 16,
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#92400E',
    flex: 1,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'right',
  },
  photoContainer: {
    position: 'relative',
  },
  rejectionPhoto: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  submitButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  approveButtonSolid: {
    backgroundColor: '#10B981',
  },
  rejectButtonSolid: {
    backgroundColor: '#DC2626',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
