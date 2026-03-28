import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Alert, Switch, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { AnimatedButton } from '../components/AnimatedButton';
import { propertiesApi } from '../../properties/api/propertiesApi';
import { supabase } from '../../../lib/supabase';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';
import { styles } from './AddPropertyScreen.styles';

interface PropertyForm {
  title: string;
  address: string;
  city: string;
  province: string;
  postal_code: string;
  property_type: string;
  bedrooms: string;
  bathrooms: string;
  parking_spaces: string;
  size_sqm: string;
  rent_amount: string;
  deposit_amount: string;
  description: string;
  amenities: string[];
  services_provided: string[];
  available_from: string;
  minimum_lease_months: string;
  pets_allowed: boolean;
  smoking_allowed: boolean;
  photos: string[];
  latitude: number | null;
  longitude: number | null;
}

const AMENITY_OPTIONS = [
  { value: 'pool', label: 'Pool' },
  { value: 'lapa', label: 'Lapa' },
  { value: 'fireplace', label: 'Fireplace' },
  { value: 'bbq', label: 'BBQ' },
  { value: 'visitors_parking', label: 'Visitors Parking' },
];

const SERVICE_OPTIONS = [
  { value: 'garden_services', label: 'Garden Services' },
  { value: 'internet', label: 'Internet' },
  { value: 'satellite_systems', label: 'Satellite Systems' },
  { value: 'prepaid_water_electricity', label: 'Prepaid Water/Electricity' },
  { value: 'security', label: 'Security' },
];

export default function AddPropertyScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PropertyForm>({
    title: '',
    address: '',
    city: '',
    province: '',
    postal_code: '',
    property_type: 'apartment',
    bedrooms: '',
    bathrooms: '',
    parking_spaces: '',
    size_sqm: '',
    rent_amount: '',
    deposit_amount: '',
    description: '',
    amenities: [],
    services_provided: [],
    available_from: new Date().toISOString().split('T')[0],
    minimum_lease_months: '12',
    pets_allowed: false,
    smoking_allowed: false,
    photos: [],
    latitude: null,
    longitude: null,
  });
  const [newAmenity, setNewAmenity] = useState('');
  const [newService, setNewService] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  const toggleAmenity = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(prev => ({
      ...prev,
      amenities: prev.amenities.includes(value)
        ? prev.amenities.filter(a => a !== value)
        : [...prev.amenities, value],
    }));
  };

  const toggleService = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(prev => ({
      ...prev,
      services_provided: prev.services_provided.includes(value)
        ? prev.services_provided.filter(s => s !== value)
        : [...prev.services_provided, value],
    }));
  };

  const addCustomAmenity = () => {
    if (newAmenity.trim() && !form.amenities.includes(newAmenity.trim())) {
      setForm(prev => ({ ...prev, amenities: [...prev.amenities, newAmenity.trim()] }));
      setNewAmenity('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const addCustomService = () => {
    if (newService.trim() && !form.services_provided.includes(newService.trim())) {
      setForm(prev => ({ ...prev, services_provided: [...prev.services_provided, newService.trim()] }));
      setNewService('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const removeAmenity = (amenity: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(prev => ({ ...prev, amenities: prev.amenities.filter(a => a !== amenity) }));
  };

  const removeService = (service: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(prev => ({ ...prev, services_provided: prev.services_provided.filter(s => s !== service) }));
  };

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access to upload images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10,
    });

    if (!result.canceled && result.assets) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setForm(prev => ({ ...prev, photos: [...prev.photos, ...newPhotos].slice(0, 10) }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const removePhoto = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.title || !form.address || !form.city || !form.province || !form.rent_amount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing fields', 'Please fill in all required fields');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'You must be logged in to create a property');
      return;
    }

    setSaving(true);
    
    try {
      // Create property
      const property = await propertiesApi.createProperty({
        owner_id: userId,
        title: form.title,
        address: form.address,
        city: form.city,
        province: form.province,
        postal_code: form.postal_code || null,
        property_type: form.property_type as any,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : 0,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : 0,
        parking_spaces: form.parking_spaces ? parseInt(form.parking_spaces) : null,
        size_sqm: form.size_sqm ? parseFloat(form.size_sqm) : null,
        rent_amount: parseFloat(form.rent_amount),
        deposit_amount: form.deposit_amount ? parseFloat(form.deposit_amount) : null,
        description: form.description || null,
        amenities: form.amenities.length > 0 ? form.amenities : null,
        available_from: form.available_from || null,
        minimum_lease_months: form.minimum_lease_months ? parseInt(form.minimum_lease_months) : null,
        pets_allowed: form.pets_allowed,
        smoking_allowed: form.smoking_allowed,
        latitude: form.latitude,
        longitude: form.longitude,
      });

      // TODO: Upload photos to Supabase Storage
      // For now, we'll skip photo upload as it requires storage setup

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Property created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error creating property:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create property');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedButton onPress={() => router.back()} hapticType="medium">
            <View style={styles.backButton}>
              <Text style={styles.backIcon}>←</Text>
            </View>
          </AnimatedButton>
          <Text style={styles.headerTitle}>Add Property</Text>
          <AnimatedButton onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </AnimatedButton>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View style={styles.section}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Rosebank Lofts 2B"
              placeholderTextColor="#9ca3af"
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
            />
          </View>

          {/* Photo Upload */}
          <View style={styles.section}>
            <Text style={styles.label}>Property Photos</Text>
            <Text style={styles.helperText}>Add up to 10 photos</Text>
            
            <AnimatedButton onPress={pickImages}>
              <View style={styles.uploadButton}>
                <Text style={styles.uploadButtonText}>Select Photos</Text>
              </View>
            </AnimatedButton>

            {form.photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                {form.photos.map((photo, index) => (
                  <View key={index} style={styles.photoContainer}>
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                    <AnimatedButton onPress={() => removePhoto(index)}>
                      <View style={styles.photoRemove}>
                        <Text style={styles.photoRemoveText}>×</Text>
                      </View>
                    </AnimatedButton>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Amenities */}
          <View style={styles.section}>
            <Text style={styles.label}>Property Amenities</Text>
            <View style={styles.checkboxGrid}>
              {AMENITY_OPTIONS.map((option) => (
                <AnimatedButton key={option.value} onPress={() => toggleAmenity(option.value)}>
                  <View style={styles.checkbox}>
                    <View style={[styles.checkboxBox, form.amenities.includes(option.value) && styles.checkboxChecked]}>
                      {form.amenities.includes(option.value) && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>{option.label}</Text>
                  </View>
                </AnimatedButton>
              ))}
            </View>

            {/* Custom Amenity Input */}
            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add custom amenity..."
                placeholderTextColor="#9ca3af"
                value={newAmenity}
                onChangeText={setNewAmenity}
                onSubmitEditing={addCustomAmenity}
              />
              <AnimatedButton onPress={addCustomAmenity}>
                <View style={styles.addButton}>
                  <Text style={styles.addButtonText}>Add</Text>
                </View>
              </AnimatedButton>
            </View>

            {/* Selected Amenities */}
            {form.amenities.length > 0 && (
              <View style={styles.tagsContainer}>
                {form.amenities.map((amenity) => (
                  <AnimatedButton key={amenity} onPress={() => removeAmenity(amenity)}>
                    <View style={styles.tag}>
                      <Text style={styles.tagText}>
                        {amenity.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                      <Text style={styles.tagClose}>×</Text>
                    </View>
                  </AnimatedButton>
                ))}
              </View>
            )}
          </View>

          {/* Services */}
          <View style={styles.section}>
            <Text style={styles.label}>Services Provided</Text>
            <View style={styles.checkboxColumn}>
              {SERVICE_OPTIONS.map((option) => (
                <AnimatedButton key={option.value} onPress={() => toggleService(option.value)}>
                  <View style={styles.checkbox}>
                    <View style={[styles.checkboxBox, form.services_provided.includes(option.value) && styles.checkboxChecked]}>
                      {form.services_provided.includes(option.value) && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxLabel}>{option.label}</Text>
                  </View>
                </AnimatedButton>
              ))}
            </View>

            <View style={styles.customInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Add custom service..."
                placeholderTextColor="#9ca3af"
                value={newService}
                onChangeText={setNewService}
                onSubmitEditing={addCustomService}
              />
              <AnimatedButton onPress={addCustomService}>
                <View style={[styles.addButton, { backgroundColor: '#059669' }]}>
                  <Text style={styles.addButtonText}>Add</Text>
                </View>
              </AnimatedButton>
            </View>

            {form.services_provided.length > 0 && (
              <View style={styles.tagsContainer}>
                {form.services_provided.map((service) => (
                  <AnimatedButton key={service} onPress={() => removeService(service)}>
                    <View style={[styles.tag, { backgroundColor: '#d1fae5', borderColor: '#059669' }]}>
                      <Text style={[styles.tagText, { color: '#065f46' }]}>
                        {service.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Text>
                      <Text style={[styles.tagClose, { color: '#059669' }]}>×</Text>
                    </View>
                  </AnimatedButton>
                ))}
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.label}>Additional Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Optional details, notes, special features..."
              placeholderTextColor="#9ca3af"
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Address Fields */}
          <View style={styles.section}>
            <Text style={styles.label}>Street Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 12 Main Street, Rosebank"
              placeholderTextColor="#9ca3af"
              value={form.address}
              onChangeText={(text) => setForm({ ...form, address: text })}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.section, { flex: 2 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Johannesburg"
                placeholderTextColor="#9ca3af"
                value={form.city}
                onChangeText={(text) => setForm({ ...form, city: text })}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Postal Code</Text>
              <TextInput
                style={styles.input}
                placeholder="2196"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={form.postal_code}
                onChangeText={(text) => setForm({ ...form, postal_code: text })}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Province *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Gauteng"
              placeholderTextColor="#9ca3af"
              value={form.province}
              onChangeText={(text) => setForm({ ...form, province: text })}
            />
          </View>

          {/* Property Type */}
          <View style={styles.section}>
            <Text style={styles.label}>Property Type *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Apartment, House, Townhouse"
              placeholderTextColor="#9ca3af"
              value={form.property_type}
              onChangeText={(text) => setForm({ ...form, property_type: text })}
            />
          </View>

          {/* Bed/Bath/Parking/Size */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Bedrooms</Text>
              <TextInput
                style={styles.input}
                placeholder="2"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={form.bedrooms}
                onChangeText={(text) => setForm({ ...form, bedrooms: text })}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Bathrooms</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={form.bathrooms}
                onChangeText={(text) => setForm({ ...form, bathrooms: text })}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Parking</Text>
              <TextInput
                style={styles.input}
                placeholder="1"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={form.parking_spaces}
                onChangeText={(text) => setForm({ ...form, parking_spaces: text })}
              />
            </View>
          </View>

          {/* Size */}
          <View style={styles.section}>
            <Text style={styles.label}>Property Size (sqm)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 85"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={form.size_sqm}
              onChangeText={(text) => setForm({ ...form, size_sqm: text })}
            />
          </View>

          {/* Rent & Deposit */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Rent (R) *</Text>
              <TextInput
                style={styles.input}
                placeholder="12,500"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={form.rent_amount}
                onChangeText={(text) => setForm({ ...form, rent_amount: text })}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Deposit (R)</Text>
              <TextInput
                style={styles.input}
                placeholder="12,500"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                value={form.deposit_amount}
                onChangeText={(text) => setForm({ ...form, deposit_amount: text })}
              />
            </View>
          </View>

          {/* Lease Terms */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lease Terms</Text>
            
            {/* Available From & Minimum Lease */}
            <View style={styles.row}>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={styles.label}>Available From</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9ca3af"
                  value={form.available_from}
                  onChangeText={(text) => setForm({ ...form, available_from: text })}
                />
              </View>
              <View style={[styles.section, { flex: 1 }]}>
                <Text style={styles.label}>Min. Lease (months)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="12"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  value={form.minimum_lease_months}
                  onChangeText={(text) => setForm({ ...form, minimum_lease_months: text })}
                />
              </View>
            </View>

            {/* Pets & Smoking */}
            <View style={styles.switchRow}>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>Pets Allowed</Text>
                <Switch
                  value={form.pets_allowed}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setForm({ ...form, pets_allowed: value });
                  }}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor="#ffffff"
                />
              </View>
              <View style={styles.switchItem}>
                <Text style={styles.switchLabel}>Smoking Allowed</Text>
                <Switch
                  value={form.smoking_allowed}
                  onValueChange={(value) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setForm({ ...form, smoking_allowed: value });
                  }}
                  trackColor={{ false: '#d1d5db', true: '#10b981' }}
                  thumbColor="#ffffff"
                />
              </View>
            </View>
          </View>

          {/* Submit */}
          <AnimatedButton onPress={handleSubmit}>
            <View style={[styles.submitButton, saving && styles.submitButtonDisabled]}>
              <Text style={styles.submitButtonText}>
                {saving ? 'Saving…' : 'Create Property'}
              </Text>
            </View>
          </AnimatedButton>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
