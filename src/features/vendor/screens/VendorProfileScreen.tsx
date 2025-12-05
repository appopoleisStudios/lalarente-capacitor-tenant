import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import { colors } from '@/src/shared/theme/colors';
import { vendorProfileApi, VendorProfile } from '@/src/features/vendor/api/profileApi';

export default function VendorProfileScreen() {
  const router = useRouter();
  const { signOut, profile: authProfile, user } = useAuth();
  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      const data = await vendorProfileApi.getProfile(user.id);
      setVendorProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/auth/login');
          } catch (error) {
            console.error('Logout error:', error);
            Alert.alert('Error', 'Failed to logout. Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.rsa.blue} />
        </View>
      </SafeAreaView>
    );
  }

  const fullName = vendorProfile?.full_name || authProfile?.full_name || 'Vendor User';
  const email = vendorProfile?.email || user?.email || '';
  const phone = vendorProfile?.phone || '';
  const rating = vendorProfile?.rating || 0;
  const totalReviews = vendorProfile?.total_reviews || 0;
  const services = vendorProfile?.services || [];
  const serviceAreas = vendorProfile?.service_areas || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Business Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{fullName}</Text>
          {email && <Text style={styles.email}>{email}</Text>}
          {phone && <Text style={styles.phone}>📞 {phone}</Text>}

          {/* Rating */}
          {rating > 0 && (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={20} color={colors.rsa.gold} />
              <Text style={styles.ratingText}>
                {rating.toFixed(1)} ({totalReviews} reviews)
              </Text>
            </View>
          )}

          <View style={styles.badge}>
            <Text style={styles.badgeText}>Vendor Account</Text>
          </View>
        </View>

        {/* Service Categories */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🛠️ Services</Text>
            <Pressable
              style={styles.manageButton}
              onPress={() => router.push('/profile/services')}
            >
              <Text style={styles.manageButtonText}>Manage</Text>
            </Pressable>
          </View>

          {services.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🔧</Text>
              <Text style={styles.emptyText}>No services added yet</Text>
              <Pressable
                style={styles.addButton}
                onPress={() => router.push('/profile/services')}
              >
                <Text style={styles.addButtonText}>+ Add Services</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              {services.slice(0, 3).map((service, index) => (
                <View
                  key={service.id}
                  style={[styles.serviceItem, index > 0 && styles.serviceItemBorder]}
                >
                  <View style={styles.serviceIcon}>
                    <Text style={styles.serviceIconText}>🔧</Text>
                  </View>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceTitle}>{service.title}</Text>
                    <Text style={styles.serviceCategory}>
                      {service.category?.name || 'General'}
                    </Text>
                  </View>
                  <Text style={styles.servicePrice}>
                    R {service.base_price.toLocaleString()}
                    {service.pricing_unit && (
                      <Text style={styles.servicePriceUnit}>/{service.pricing_unit}</Text>
                    )}
                  </Text>
                </View>
              ))}
              {services.length > 3 && (
                <Pressable
                  style={styles.viewAllButton}
                  onPress={() => router.push('/profile/services')}
                >
                  <Text style={styles.viewAllText}>
                    View all {services.length} services
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Service Areas */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📍 Service Areas</Text>
            <Pressable
              style={styles.manageButton}
              onPress={() => router.push('/profile/services')}
            >
              <Text style={styles.manageButtonText}>Manage</Text>
            </Pressable>
          </View>

          {serviceAreas.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🗺️</Text>
              <Text style={styles.emptyText}>No service areas added</Text>
              <Pressable
                style={styles.addButton}
                onPress={() => router.push('/profile/services')}
              >
                <Text style={styles.addButtonText}>+ Add Areas</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              {serviceAreas.map((area, index) => (
                <View
                  key={area.id}
                  style={[styles.areaItem, index > 0 && styles.areaItemBorder]}
                >
                  <Ionicons name="location" size={20} color={colors.rsa.blue} />
                  <Text style={styles.areaText}>
                    {area.city}
                    {area.province && `, ${area.province}`}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📄 Documents</Text>
            <Pressable
              style={styles.manageButton}
              onPress={() => router.push('/profile/documents')}
            >
              <Text style={styles.manageButtonText}>Manage</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.menuItem}
            onPress={() => router.push('/profile/documents')}
          >
            <Text style={styles.menuIcon}>📄</Text>
            <View style={styles.menuTextContainer}>
              <Text style={styles.menuText}>Business Documents</Text>
              <Text style={styles.menuSubtext}>
                {vendorProfile?.documents.length || 0} uploaded
              </Text>
            </View>
            <Text style={styles.menuArrow}>›</Text>
          </Pressable>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <Pressable style={styles.menuItem}>
            <Text style={styles.menuIcon}>👤</Text>
            <Text style={styles.menuText}>Edit Profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </Pressable>
          <Pressable style={styles.menuItem}>
            <Text style={styles.menuIcon}>🔔</Text>
            <Text style={styles.menuText}>Notifications</Text>
            <Text style={styles.menuArrow}>›</Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    backgroundColor: colors.background.default,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
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
  profileCard: {
    backgroundColor: colors.background.default,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.rsa.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.background.default,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginLeft: 4,
  },
  badge: {
    backgroundColor: colors.rsa.blue + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.rsa.blue,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  manageButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.rsa.blue + '20',
  },
  manageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.rsa.blue,
  },
  card: {
    backgroundColor: colors.background.default,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
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
    fontSize: 15,
    color: colors.text.secondary,
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: colors.rsa.blue,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.background.default,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  serviceItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  serviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.rsa.blue + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  serviceIconText: {
    fontSize: 20,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 2,
  },
  serviceCategory: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  servicePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.rsa.green,
  },
  servicePriceUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.text.secondary,
  },
  viewAllButton: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.rsa.blue,
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  areaItemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  areaText: {
    fontSize: 15,
    color: colors.text.primary,
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.default,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  menuSubtext: {
    fontSize: 13,
    color: colors.text.secondary,
    marginTop: 2,
  },
  menuArrow: {
    fontSize: 24,
    color: colors.text.tertiary,
  },
  logoutButton: {
    backgroundColor: colors.rsa.red,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.background.default,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 24,
  },
});
