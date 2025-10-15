import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/contexts/AuthContext';
import { useMediaUpload } from '../hooks';
import { getTenantProperties } from '@/src/lib/mockData';
import { colors } from '@/src/shared/theme/colors';
import { StyleSheet } from 'react-native';

const RSA = { green: '#007A4D' };

const PRIORITIES = [
  { value: 'low', label: 'Low', color: colors.success[500], icon: 'arrow-down-circle' },
  { value: 'medium', label: 'Medium', color: colors.warning[500], icon: 'remove-circle' },
  { value: 'high', label: 'High', color: colors.error[500], icon: 'arrow-up-circle' },
];

const MOCK_CATEGORIES = [
  { id: 'cat-plumbing', name: 'Plumbing' },
  { id: 'cat-electrical', name: 'Electrical' },
  { id: 'cat-hvac', name: 'HVAC' },
  { id: 'cat-general', name: 'General' },
];

const MOCK_OWNER_PROPERTIES = [
  { id: 'prop-001', title: 'Sunset Apartment 3B' },
  { id: 'prop-002', title: 'Green Park House' },
  { id: 'prop-003', title: 'Ocean View Villa' },
];

export default function ReportMaintenanceScreen() {
  const { user, profile } = useAuth();
  const {
    files,
    uploading,
    uploadProgress,
    takePhoto,
    pickMedia,
    removeFile,
    canAddMore,
  } = useMediaUpload(10);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'invited'>('invited');
  const [submitting, setSubmitting] = useState(false);

  // Tenant-specific: Property selection
  const [tenantProperties, setTenantProperties] = useState<any[]>([]);
  const [isPropertyLocked, setIsPropertyLocked] = useState(false);

  const isOwner = profile?.role === 'owner';
  const isTenant = profile?.role === 'tenant';

  useEffect(() => {
    if (isTenant && user?.id) {
      const properties = getTenantProperties(user.id);
      setTenantProperties(properties);

      // Auto-select if single property
      if (properties.length === 1) {
        setPropertyId(properties[0].property_id);
        setIsPropertyLocked(true);
      }
    }
  }, [isTenant, user?.id]);

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the issue');
      return;
    }
    if (!propertyId) {
      Alert.alert('Required', 'Please select a property');
      return;
    }

    try {
      setSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // TODO: Upload files when ready
      // const { photos, videos } = await uploadFiles('maintenance-images');

      // TODO: Create maintenance request via API
      await new Promise(resolve => setTimeout(resolve, 1500));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success',
        isTenant
          ? 'Request sent to property owner'
          : 'Maintenance request submitted successfully',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const availableProperties = isOwner ? MOCK_OWNER_PROPERTIES : tenantProperties;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Maintenance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Leaking faucet in kitchen"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the issue in detail..."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </Animated.View>

        {/* Property Selection */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
          <Text style={styles.label}>Property *</Text>
          {isPropertyLocked ? (
            <View style={styles.lockedProperty}>
              <Text style={styles.lockedPropertyText}>
                {availableProperties.find(p => p.property_id === propertyId)?.property?.title ||
                  availableProperties.find(p => p.id === propertyId)?.title}
              </Text>
            </View>
          ) : (
            <View style={styles.chipContainer}>
              {availableProperties.map((item) => {
                const propId = item.property_id || item.id;
                const propTitle = item.property?.title || item.title;
                return (
                  <TouchableOpacity
                    key={propId}
                    style={[styles.chip, propertyId === propId && styles.chipActive]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPropertyId(propId);
                    }}
                  >
                    <Text style={[styles.chipText, propertyId === propId && styles.chipTextActive]}>
                      {propTitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>

        {/* Priority */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityContainer}>
            {PRIORITIES.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[styles.priorityChip, priority === item.value && { backgroundColor: item.color }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setPriority(item.value as any);
                }}
              >
                <Ionicons name={item.icon as any} size={20} color={priority === item.value ? '#FFFFFF' : item.color} />
                <Text style={[styles.priorityText, priority === item.value && styles.priorityTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Category */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)} style={styles.section}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipContainer}>
            {MOCK_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[styles.chip, categoryId === category.id && styles.chipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setCategoryId(categoryId === category.id ? null : category.id);
                }}
              >
                <Text style={[styles.chipText, categoryId === category.id && styles.chipTextActive]}>
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Visibility (Owner Only) */}
        {isOwner && (
          <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.section}>
            <Text style={styles.label}>Request Visibility</Text>
            <View style={styles.visibilityContainer}>
              <TouchableOpacity
                style={[styles.visibilityChip, visibility === 'public' && styles.chipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setVisibility('public');
                }}
              >
                <Text style={styles.visibilityIcon}>🌍</Text>
                <Text style={[styles.visibilityLabel, visibility === 'public' && styles.chipTextActive]}>
                  Open Market
                </Text>
                <Text style={[styles.visibilityHint, visibility === 'public' && { color: 'rgba(255,255,255,0.8)' }]}>
                  All vendors can quote
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.visibilityChip, visibility === 'invited' && styles.chipActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setVisibility('invited');
                }}
              >
                <Text style={styles.visibilityIcon}>🔒</Text>
                <Text style={[styles.visibilityLabel, visibility === 'invited' && styles.chipTextActive]}>
                  Invite Only
                </Text>
                <Text style={[styles.visibilityHint, visibility === 'invited' && { color: 'rgba(255,255,255,0.8)' }]}>
                  Choose vendors
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Photos & Videos */}
        <Animated.View entering={FadeInDown.delay(700).duration(500)} style={styles.section}>
          <Text style={styles.label}>Photos & Videos ({files.length}/10)</Text>
          <View style={styles.mediaGrid}>
            {files.map((file, index) => (
              <View key={index} style={styles.mediaWrapper}>
                {file.type === 'video' ? (
                  <Video
                    source={{ uri: file.uri }}
                    style={styles.media}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                    isLooping
                  />
                ) : (
                  <Image source={{ uri: file.uri }} style={styles.media} />
                )}
                <TouchableOpacity
                  style={styles.removeMedia}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    removeFile(file.uri);
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#DE3831" />
                </TouchableOpacity>
                <View style={styles.mediaTypeBadge}>
                  <Text style={styles.mediaTypeText}>
                    {file.type === 'video' ? '🎥' : '📷'}
                  </Text>
                </View>
              </View>
            ))}
            {canAddMore && (
              <>
                <TouchableOpacity style={styles.addMediaButton} onPress={takePhoto}>
                  <Ionicons name="camera" size={32} color={RSA.green} />
                  <Text style={styles.addMediaText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addMediaButton} onPress={pickMedia}>
                  <Ionicons name="images" size={32} color={RSA.green} />
                  <Text style={styles.addMediaText}>Gallery</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={styles.mediaHint}>
            📷 Photos & 🎥 Videos (max 50MB per video, 2min duration)
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isTenant ? 'Send to Owner' : 'Submit Request'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  section: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, fontSize: 16, color: '#111827' },
  textArea: { height: 120, paddingTop: 12 },
  charCount: { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginTop: 4 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: RSA.green, borderColor: RSA.green },
  chipText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  chipTextActive: { color: '#ffffff' },
  priorityContainer: { flexDirection: 'row', gap: 12 },
  priorityChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f5f5f5' },
  priorityText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  priorityTextActive: { color: '#ffffff' },
  visibilityContainer: { flexDirection: 'row', gap: 12 },
  visibilityChip: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#f5f5f5', borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center' },
  visibilityIcon: { fontSize: 32, marginBottom: 8 },
  visibilityLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  visibilityHint: { fontSize: 11, color: '#9ca3af', marginTop: 4, textAlign: 'center' },
  lockedProperty: { backgroundColor: '#f5f5f5', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  lockedPropertyText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mediaWrapper: { position: 'relative' },
  media: { width: 100, height: 100, borderRadius: 12 },
  removeMedia: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ffffff', borderRadius: 12 },
  mediaTypeBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  mediaTypeText: { fontSize: 12 },
  addMediaButton: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  addMediaText: { fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: '600' },
  mediaHint: { fontSize: 11, color: '#9ca3af', marginTop: 8 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  submitButton: { backgroundColor: RSA.green, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
