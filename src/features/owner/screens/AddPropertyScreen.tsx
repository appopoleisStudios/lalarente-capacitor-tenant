import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
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
  rent_amount: string;
  deposit_amount: string;
  description: string;
  amenities: string[];
  services_provided: string[];
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
    rent_amount: '',
    deposit_amount: '',
    description: '',
    amenities: [],
    services_provided: [],
  });
  const [newAmenity, setNewAmenity] = useState('');
  const [newService, setNewService] = useState('');

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

  const handleSubmit = async () => {
    // Validation
    if (!form.title || !form.address || !form.city || !form.province || !form.rent_amount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Missing fields', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Simulate save
    setTimeout(() => {
      setSaving(false);
      Alert.alert('Success', 'Property created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
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

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="Start typing your address..."
              placeholderTextColor="#9ca3af"
              value={form.address}
              onChangeText={(text) => setForm({ ...form, address: text })}
            />
          </View>

          {/* City & Province */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>City *</Text>
              <TextInput
                style={styles.input}
                placeholder="City"
                placeholderTextColor="#9ca3af"
                value={form.city}
                onChangeText={(text) => setForm({ ...form, city: text })}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Province *</Text>
              <TextInput
                style={styles.input}
                placeholder="Province"
                placeholderTextColor="#9ca3af"
                value={form.province}
                onChangeText={(text) => setForm({ ...form, province: text })}
              />
            </View>
          </View>

          {/* Postal & Type */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Postal Code</Text>
              <TextInput
                style={styles.input}
                placeholder="2000"
                placeholderTextColor="#9ca3af"
                value={form.postal_code}
                onChangeText={(text) => setForm({ ...form, postal_code: text })}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>Type *</Text>
              <TextInput
                style={styles.input}
                placeholder="Apartment"
                placeholderTextColor="#9ca3af"
                value={form.property_type}
                onChangeText={(text) => setForm({ ...form, property_type: text })}
              />
            </View>
          </View>

          {/* Bed/Bath/Parking */}
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

          {/* Submit */}
          <AnimatedButton onPress={handleSubmit}>
            <View style={[styles.submitButton, saving && styles.submitButtonDisabled]}>
              <Text style={styles.submitButtonText}>
                {saving ? 'Saving…' : '🏠 Create Property'}
              </Text>
            </View>
          </AnimatedButton>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
