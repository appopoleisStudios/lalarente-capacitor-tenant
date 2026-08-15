/**
 * Tenant Closure Confirmation Screen (Tenant→Vendor flow, Plane #61)
 *
 * Shown when the vendor has requested closure with after-work photos.
 * The tenant reviews the vendor's after-photos + notes, uploads 2+
 * confirmation photos of their own, optionally adds notes, then calls
 * tenantConfirmClosureWithPhotos() to confirm the completed work.
 *
 * Route: /(tenant)/maintenance/closure-confirm?id=<requestId>
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { useMediaUpload } from '@/src/features/maintenance/hooks';
import { getClosureReport, tenantConfirmClosureWithPhotos } from '@/src/features/maintenance/api';
import { FeaturePin } from '@/src/shared/components';

const RSA = { blue: '#002395', green: '#007A4D', gold: '#FFB81C', red: '#DE3831' };

const MIN_PHOTOS_REQUIRED = 2;

// Stable testIDs so Maestro E2E flows can drive the screen (Plane #61).
export const CLOSURE_CONFIRM_TEST_IDS = {
  title: 'closure-confirm-title',
  instruction: 'closure-confirm-instruction',
  vendorPhotos: 'closure-confirm-vendor-photos',
  camera: 'closure-confirm-camera',
  gallery: 'closure-confirm-gallery',
  notes: 'closure-confirm-notes',
  submit: 'closure-confirm-submit',
} as const;

export default function TenantClosureConfirmScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [closure, setClosure] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { files, takePhoto, pickMedia, removeFile, uploadFiles, canAddMore } = useMediaUpload(10);

  const hasMinPhotos = files.length >= MIN_PHOTOS_REQUIRED;

  // Load the closure report to surface the vendor's after-photos + notes
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const report = await getClosureReport(id);
        setClosure(report);
      } catch (e: any) {
        console.error('❌ Error loading closure report:', e);
        Alert.alert('Error', 'Could not load closure details.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSubmit = async () => {
    if (!hasMinPhotos) {
      Alert.alert(
        'Photos Required',
        `Please upload at least ${MIN_PHOTOS_REQUIRED} confirmation photos.`
      );
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'You must be logged in to confirm closure.');
      return;
    }

    try {
      setSubmitting(true);

      // Upload the tenant's confirmation photos first
      const photoUrls = await uploadFiles(id);

      // Confirm closure via the two-sided photo closure API
      await tenantConfirmClosureWithPhotos(id, user.id, photoUrls, notes.trim() || undefined);

      Alert.alert(
        '✅ Closure Confirmed',
        'Thank you for confirming the completed work with photos.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('❌ Error confirming closure:', error);
      Alert.alert('Error', error.message || 'Failed to confirm closure');
    } finally {
      setSubmitting(false);
    }
  };

  const vendorAfterPhotos: string[] = closure?.vendor_after_photos || [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} testID={CLOSURE_CONFIRM_TEST_IDS.title}>
            Confirm Closure
          </Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
          <Text style={styles.loadingText}>Loading closure details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} testID={CLOSURE_CONFIRM_TEST_IDS.title}>
          Confirm Closure
        </Text>
        <View style={styles.headerButton}>
          <FeaturePin
            pinId="tenant-closure-confirm"
            title="Confirming completed work"
            message="The vendor says the job is done. Check their after-work photos, then upload at least 2 of your own showing the result before confirming. This is your proof the work is finished."
            aiRoute="/(tenant)/ai-chat"
            aiPrompt="What happens when I confirm closure?"
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Instruction card */}
          <View style={styles.instructionCard} testID={CLOSURE_CONFIRM_TEST_IDS.instruction}>
            <Ionicons name="checkmark-done-circle" size={28} color={RSA.green} />
            <View style={styles.instructionTextWrap}>
              <Text style={styles.instructionTitle}>Work Completed?</Text>
              <Text style={styles.instructionText}>
                The vendor says the job is done. Review their after-work photos, then upload at
                least {MIN_PHOTOS_REQUIRED} of your own to confirm the result.
              </Text>
            </View>
          </View>

          {/* Vendor's after-work photos */}
          <View style={styles.section} testID={CLOSURE_CONFIRM_TEST_IDS.vendorPhotos}>
            <Text style={styles.label}>Vendor's After-Work Photos</Text>
            {vendorAfterPhotos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.vendorPhotoRow}>
                  {vendorAfterPhotos.map((uri: string, index: number) => (
                    <Image key={index} source={{ uri }} style={styles.vendorPhoto} />
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.hint}>No after-work photos provided.</Text>
            )}
          </View>

          {/* Vendor's closure notes */}
          {closure?.vendor_closure_notes ? (
            <View style={styles.section}>
              <Text style={styles.label}>Vendor's Notes</Text>
              <Text style={styles.vendorNotes}>{closure.vendor_closure_notes}</Text>
            </View>
          ) : null}

          {/* Tenant confirmation photos */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Your Confirmation Photos * ({files.length}/{MIN_PHOTOS_REQUIRED} minimum)
            </Text>
            <Text style={[styles.hint, !hasMinPhotos && files.length > 0 && styles.hintWarning]}>
              {hasMinPhotos
                ? '✅ Minimum photos requirement met'
                : files.length > 0
                  ? `⚠️ Need ${MIN_PHOTOS_REQUIRED - files.length} more photo${MIN_PHOTOS_REQUIRED - files.length > 1 ? 's' : ''}`
                  : `Upload at least ${MIN_PHOTOS_REQUIRED} photos of the completed work`}
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
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={takePhoto}
                  testID={CLOSURE_CONFIRM_TEST_IDS.camera}
                >
                  <Ionicons name="camera" size={24} color={RSA.blue} />
                  <Text style={styles.addPhotoText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={pickMedia}
                  testID={CLOSURE_CONFIRM_TEST_IDS.gallery}
                >
                  <Ionicons name="images" size={24} color={RSA.blue} />
                  <Text style={styles.addPhotoText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Optional notes */}
          <View style={styles.section}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="e.g. Work looks great, everything is fixed..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
              testID={CLOSURE_CONFIRM_TEST_IDS.notes}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!hasMinPhotos || submitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!hasMinPhotos || submitting}
          testID={CLOSURE_CONFIRM_TEST_IDS.submit}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Confirm Completed Work</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 16, color: '#6b7280' },
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
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F0FDF4',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  instructionTextWrap: { flex: 1 },
  instructionTitle: { fontSize: 16, fontWeight: '700', color: '#166534', marginBottom: 4 },
  instructionText: { fontSize: 14, color: '#15803D', lineHeight: 20 },
  section: { marginHorizontal: 16, marginTop: 24 },
  label: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 8 },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  hintWarning: { color: '#D97706' },
  vendorPhotoRow: { flexDirection: 'row', gap: 8 },
  vendorPhoto: { width: 120, height: 120, borderRadius: 12, backgroundColor: '#e5e7eb' },
  vendorNotes: { fontSize: 15, color: '#374151', lineHeight: 22 },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 110,
    lineHeight: 22,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
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
  addPhotoRow: { flexDirection: 'row', gap: 12 },
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
    backgroundColor: RSA.green,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
