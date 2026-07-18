import { useAuth } from '@/src/contexts/AuthContext';
import { useMediaUpload } from '@/src/features/maintenance/hooks';
import { submitProgressUpdate } from '@/src/features/maintenance/api';
import { colors } from '@/src/shared/theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RSA = { blue: '#002395', green: '#007A4D', gold: '#FFB81C', red: '#DE3831' };

export default function SubmitProgressUpdateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { files, takePhoto, pickMedia, removeFile, uploadFiles, canAddMore } = useMediaUpload(10);

  const minPhotosRequired = 1;
  const hasMinPhotos = files.length >= minPhotosRequired;

  const handleSubmit = async () => {
    if (!notes.trim()) {
      Alert.alert('Notes Required', 'Please describe the progress you\'ve made today.');
      return;
    }
    if (!hasMinPhotos) {
      Alert.alert('Photo Required', `Please upload at least ${minPhotosRequired} photo showing today's work.`);
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to submit an update.');
      return;
    }

    try {
      setSubmitting(true);

      // Upload photos first
      let photoUrls: string[] = [];
      if (files.length > 0) {
        photoUrls = await uploadFiles(id);
      }

      // Submit progress update
      await submitProgressUpdate(id, user.id, notes.trim(), photoUrls);

      Alert.alert(
        '✅ Update Submitted',
        'Your progress update has been recorded.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('❌ Error submitting update:', error);
      Alert.alert('Error', error.message || 'Failed to submit progress update');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Daily Progress Update</Text>
        <View style={styles.headerButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Instructions */}
          <View style={styles.instructionCard}>
            <Ionicons name="information-circle" size={24} color={RSA.blue} />
            <Text style={styles.instructionText}>
              Describe the work completed today and attach photos as evidence.
            </Text>
          </View>

          {/* Notes Input */}
          <View style={styles.section}>
            <Text style={styles.label}>Progress Notes *</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Completed tiling in the main bathroom, started plumbing work..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={6}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />
          </View>

          {/* Photo Upload */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Work Photos * ({files.length}/{minPhotosRequired} minimum)
            </Text>
            <Text style={[styles.hint, !hasMinPhotos && files.length > 0 && styles.hintWarning]}>
              {hasMinPhotos
                ? '✅ Photo evidence captured'
                : files.length > 0
                  ? `⚠️ Need ${minPhotosRequired - files.length} more photo${minPhotosRequired - files.length > 1 ? 's' : ''}`
                  : 'Upload at least 1 photo showing today\'s progress'}
            </Text>

            {files.length > 0 && (
              <View style={styles.photoGrid}>
                {files.map((file, index) => (
                  <View key={index} style={styles.photoItem}>
                    <Image source={{ uri: file.uri }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.removePhotoButton}
                      onPress={() => removeFile(file.uri)}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {canAddMore && (
              <View style={styles.addPhotoRow}>
                <TouchableOpacity style={styles.addPhotoButton} onPress={takePhoto}>
                  <Ionicons name="camera" size={24} color={RSA.blue} />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addPhotoButton} onPress={pickMedia}>
                  <Ionicons name="images" size={24} color={RSA.blue} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!notes.trim() || !hasMinPhotos || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!notes.trim() || !hasMinPhotos || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Progress Update</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  instructionText: { flex: 1, fontSize: 14, color: '#1E40AF', lineHeight: 20 },
  section: { marginHorizontal: 16, marginTop: 24 },
  label: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  hintWarning: { color: '#D97706' },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 140,
    lineHeight: 22,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photoItem: {
    position: 'relative',
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoThumb: { width: '100%', height: '100%', backgroundColor: '#e5e7eb' },
  removePhotoButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  addPhotoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    paddingVertical: 20,
    borderRadius: 12,
  },
  addPhotoText: { fontSize: 14, fontWeight: '600', color: RSA.blue },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: RSA.blue,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
