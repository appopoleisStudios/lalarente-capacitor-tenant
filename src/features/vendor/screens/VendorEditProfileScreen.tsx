import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/src/lib/supabase';
import { uploadFile } from '@/src/lib/storage';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/shared/theme/colors';
import { vendorProfileApi } from '@/src/features/vendor/api/profileApi';
import { KeyboardAvoidingView } from '@/src/shared/components/layouts/KeyboardAvoidingView';

export default function VendorEditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    try {
      const data = await vendorProfileApi.getProfile(user.id);
      if (data) {
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setAvatarUrl(data.avatar_url);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed to change your photo');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;

    try {
      setUploadingAvatar(true);
      const asset = result.assets[0];
      const ext = (asset.mimeType || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const res = await uploadFile(
        'PROFILES',
        { uri: asset.uri, name: `avatar.${ext}`, type: asset.mimeType || 'image/jpeg' },
        `avatars/${user?.id}`
      );
      if (res.error || !res.url) throw new Error(res.error || 'Upload failed');
      setAvatarUrl(res.url);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to upload photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    const trimmedName = fullName.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Please enter your business or display name.');
      return;
    }
    try {
      setSaving(true);
      await vendorProfileApi.updateProfile(user.id, {
        full_name: trimmedName,
        phone: phone.trim() || null,
        avatar_url: avatarUrl,
      });
      Alert.alert('Success', 'Profile updated', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            testID="edit-profile-back"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} testID="edit-profile-title">
            Edit Profile
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.role.vendor.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            testID="edit-profile-back"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} testID="edit-profile-title">
            Edit Profile
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} testID="edit-profile-save">
            {saving ? (
              <ActivityIndicator size="small" color={colors.role.vendor.primary} />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatarSection}
            onPress={pickAvatar}
            accessibilityLabel="Change profile photo"
            testID="edit-profile-avatar"
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {(fullName || 'V').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color={colors.background.default} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.background.default} />
              )}
            </View>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </TouchableOpacity>

          {/* Fields */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your business or display name"
              placeholderTextColor={colors.text.tertiary}
              testID="edit-profile-name"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 082 123 4567"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="phone-pad"
              testID="edit-profile-phone"
            />
          </View>

          <Text style={styles.infoText}>
            Your email and rating cannot be changed here. Update business services, areas and
            documents from the Profile screen.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.background.default,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerSpacer: {
    width: 40,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.role.vendor.primary,
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.role.vendor.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.background.default,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: '34%',
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.role.vendor.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background.default,
  },
  avatarHint: {
    marginTop: 8,
    fontSize: 13,
    color: colors.text.secondary,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  infoText: {
    fontSize: 13,
    color: colors.text.tertiary,
    lineHeight: 18,
    marginTop: 8,
  },
});
