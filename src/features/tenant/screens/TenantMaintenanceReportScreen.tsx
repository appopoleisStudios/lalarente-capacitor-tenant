import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/src/contexts/AuthContext';
import { useMediaUpload } from '@/src/features/maintenance/hooks';
import { maintenanceApi } from '@/src/features/maintenance/api';
import { supabase } from '@/src/lib/supabase';
import { colors } from '@/src/shared/theme/colors';
import { StyleSheet } from 'react-native';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

const RSA = { green: '#007A4D' }; // Tenant primary: RSA Green

const PRIORITIES = [
  { value: 'low', label: 'Low', color: colors.success[500], icon: 'arrow-down-circle' },
  { value: 'medium', label: 'Medium', color: colors.warning[500], icon: 'remove-circle' },
  { value: 'high', label: 'High', color: colors.error[500], icon: 'arrow-up-circle' },
];

export default function TenantMaintenanceReportScreen() {
  const { user } = useAuth();
  const {
    files,
    uploading,
    uploadProgress,
    takePhoto,
    pickMedia,
    removeFile,
    uploadFiles,
    canAddMore,
  } = useMediaUpload(10);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Data from API
  const [categories, setCategories] = useState<any[]>([]);
  const [activeLeases, setActiveLeases] = useState<any[]>([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  // Fetch categories and active lease on mount
  useEffect(() => {
    async function fetchData() {
      try {
        setLoadingData(true);

        // Fetch categories
        const categoriesData = await maintenanceApi.getServiceCategories();
        setCategories(categoriesData);

        // Fetch tenant's active leases to get properties (including pending signature leases)
        if (user?.id) {
          console.log('🔍 Fetching leases for tenant:', user.id);

          const { data: leasesData, error } = await supabase
            .from('leases')
            .select(`
              *,
              property:properties!property_id(id, title, address, rent_amount),
              owner:profiles!owner_id(id, full_name, phone, email)
            `)
            .eq('tenant_id', user.id)
            .in('status', ['active', 'pending_tenant_signature', 'pending_owner_signature'])
            .order('created_at', { ascending: false });

          console.log('📋 Leases query result:', { leasesData, error });

          if (error) {
            console.error('❌ Error fetching leases:', error);
            // Don't show alert here - let the UI handle the null state
          } else if (leasesData && leasesData.length > 0) {
            console.log(`✅ Found ${leasesData.length} lease(s)`);
            setActiveLeases(leasesData);
            // Auto-select the first (most recent) lease
            setSelectedLeaseId(leasesData[0].id);
          } else {
            console.warn('⚠️ No leases found for tenant');
          }
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        Alert.alert('Error', 'Failed to load form data');
      } finally {
        setLoadingData(false);
      }
    }

    fetchData();
  }, [user?.id]);

  const handleSubmit = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter a title for the issue');
      return;
    }
    if (title.trim().length < 5) {
      Alert.alert('Too Short', 'Title must be at least 5 characters');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the issue in detail');
      return;
    }
    if (description.trim().length < 20) {
      Alert.alert('Too Short', 'Description must be at least 20 characters');
      return;
    }
    if (!selectedLeaseId) {
      Alert.alert('Required', 'Please select a property');
      return;
    }

    const selectedLease = activeLeases.find(l => l.id === selectedLeaseId);
    if (!selectedLease?.property_id) {
      Alert.alert('Error', 'Could not determine property. Please contact support.');
      return;
    }
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Step 1: Create maintenance request
      const request = await maintenanceApi.createMaintenanceRequest({
        property_id: selectedLease.property_id,
        owner_id: selectedLease.owner_id,
        tenant_id: user.id,
        category_id: categoryId || undefined,
        priority,
        title: title.trim(),
        description: description.trim(),
        visibility: 'invited', // Tenants always use invited visibility
      });

      // Step 2: Upload media files if any
      if (files.length > 0) {
        const imageUrls = await uploadFiles(request.id);

        // Step 3: Update request with image URLs
        if (imageUrls.length > 0) {
          await maintenanceApi.updateMaintenanceRequest(request.id, {
            images: imageUrls,
          });
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Success! 🎉',
        'Your maintenance request has been submitted. Your landlord will review it shortly.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to submit request');
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading state while fetching data
  if (loadingData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Issue</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
          <Text style={styles.loadingText}>Loading form...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (activeLeases.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report Issue</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>No Active Lease</Text>
          <Text style={styles.errorMessage}>
            You need an active lease to report maintenance issues. Please contact your landlord.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const selectedLease = activeLeases.find(l => l.id === selectedLeaseId) || activeLeases[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report Issue</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Property Selection (if multiple leases) or Display (if single lease) */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.section}>
          <Text style={styles.label}>Property {activeLeases.length > 1 ? '*' : ''}</Text>
          {activeLeases.length === 1 ? (
            // Single property - just display it
            <View style={styles.propertyCard}>
              <Ionicons name="home" size={24} color={RSA.green} />
              <View style={styles.propertyInfo}>
                <Text style={styles.propertyTitle}>{selectedLease.property?.title}</Text>
                {selectedLease.property?.address && (
                  <Text style={styles.propertyAddress}>{selectedLease.property.address}</Text>
                )}
              </View>
            </View>
          ) : (
            // Multiple properties - show selector
            <>
              <Text style={styles.helperText}>Select which property needs maintenance</Text>
              {activeLeases.map((lease) => (
                <TouchableOpacity
                  key={lease.id}
                  style={[styles.propertySelectCard, selectedLeaseId === lease.id && styles.propertySelectCardActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedLeaseId(lease.id);
                  }}
                >
                  <Ionicons
                    name={selectedLeaseId === lease.id ? 'radio-button-on' : 'radio-button-off'}
                    size={24}
                    color={selectedLeaseId === lease.id ? RSA.green : '#9ca3af'}
                    style={styles.radioIcon}
                  />
                  <View style={styles.propertySelectInfo}>
                    <Text style={[styles.propertySelectTitle, selectedLeaseId === lease.id && styles.propertySelectTitleActive]}>
                      {lease.property?.title || lease.property?.address || 'Property'}
                    </Text>
                    {lease.property?.address && lease.property?.title && (
                      <Text style={styles.propertySelectAddress}>
                        📍 {lease.property.address}
                      </Text>
                    )}

                    {/* Expanded Details - Only show when selected */}
                    {selectedLeaseId === lease.id && (
                      <View style={styles.propertyDetails}>
                        <View style={styles.detailRow}>
                          <Ionicons name="person-outline" size={14} color="#6b7280" />
                          <Text style={styles.detailLabel}>Owner:</Text>
                          <Text style={styles.detailValue}>{lease.owner?.full_name || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                          <Text style={styles.detailLabel}>Lease Period:</Text>
                          <Text style={styles.detailValue}>
                            {new Date(lease.start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - {new Date(lease.end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="cash-outline" size={14} color="#6b7280" />
                          <Text style={styles.detailLabel}>Monthly Rent:</Text>
                          <Text style={styles.detailValue}>R {lease.monthly_rent?.toLocaleString() || lease.property?.rent_amount?.toLocaleString() || 'N/A'}</Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
                          <Text style={styles.detailLabel}>Status:</Text>
                          <Text style={[styles.detailValue, styles.statusBadgeText]}>
                            {lease.status === 'active' ? '✓ Active' : lease.status.replace(/_/g, ' ')}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.section}>
          <Text style={styles.label}>Issue Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Leaking faucet in kitchen"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
          {title.length > 0 && title.length < 5 && (
            <Text style={styles.validationHint}>Minimum 5 characters</Text>
          )}
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.section}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe the issue in detail... Include when you first noticed it, what's happening, and how urgent it is."
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={500}
          />
          <View style={styles.descriptionFooter}>
            {description.length > 0 && description.length < 20 && (
              <Text style={styles.validationHint}>Minimum 20 characters</Text>
            )}
            <Text style={[styles.charCount, description.length > 0 && description.length < 20 && styles.charCountWarning]}>
              {description.length}/500
            </Text>
          </View>
        </Animated.View>

        {/* Priority */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.section}>
          <Text style={styles.label}>Priority</Text>
          <Text style={styles.helperText}>How urgent is this issue?</Text>
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
          <Text style={styles.label}>Category (Optional)</Text>
          <Text style={styles.helperText}>Select the category that best describes the issue</Text>
          <View style={styles.chipContainer}>
            {categories.map((category) => (
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

        {/* Photos & Videos */}
        <Animated.View entering={FadeInDown.delay(600).duration(500)} style={styles.section}>
          <Text style={styles.label}>Photos & Videos ({files.length}/10)</Text>
          <Text style={styles.helperText}>
            Adding photos or videos helps your landlord understand the issue better
          </Text>
          <View style={styles.mediaGrid}>
            {files.map((file, index) => (
              <View key={index} style={styles.mediaWrapper}>
                <Image source={{ uri: file.uri }} style={styles.media} />
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
            <Text style={styles.submitButtonText}>Submit Request</Text>
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
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorIcon: { fontSize: 64, marginBottom: 16 },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginBottom: 8, textAlign: 'center' },
  errorMessage: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: RSA.green, borderRadius: 8 },
  retryButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 120 },
  section: { marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 8 },
  propertyCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  propertyInfo: { flex: 1 },
  propertyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  propertyAddress: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  propertySelectCard: { backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  propertySelectCardActive: { borderColor: RSA.green, backgroundColor: '#f0fdf4' },
  radioIcon: { marginTop: 2 },
  propertySelectInfo: { flex: 1 },
  propertySelectTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  propertySelectTitleActive: { color: RSA.green },
  propertySelectAddress: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  propertyDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', minWidth: 90 },
  detailValue: { fontSize: 12, color: '#111827', flex: 1 },
  statusBadgeText: { fontWeight: '700', color: RSA.green },
  input: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 16, fontSize: 16, color: '#111827' },
  textArea: { height: 140, paddingTop: 12 },
  descriptionFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  validationHint: { fontSize: 12, color: '#DE3831', marginTop: 4 },
  charCount: { fontSize: 12, color: '#9ca3af' },
  charCountWarning: { color: '#DE3831' },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: RSA.green, borderColor: RSA.green },
  chipText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  chipTextActive: { color: '#ffffff' },
  priorityContainer: { flexDirection: 'row', gap: 12 },
  priorityChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f5f5f5' },
  priorityText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  priorityTextActive: { color: '#ffffff' },
  helperText: { fontSize: 12, color: '#9ca3af', marginTop: -4, marginBottom: 12 },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  mediaWrapper: { position: 'relative' },
  media: { width: 100, height: 100, borderRadius: 12 },
  removeMedia: { position: 'absolute', top: -8, right: -8, backgroundColor: '#ffffff', borderRadius: 12 },
  mediaTypeBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  mediaTypeText: { fontSize: 12 },
  addMediaButton: { width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
  addMediaText: { fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: '600' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  submitButton: { backgroundColor: RSA.green, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
});
