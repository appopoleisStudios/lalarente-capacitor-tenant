import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, SafeAreaView, Image, Alert, ActivityIndicator, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { AnimatedButton } from '../components/AnimatedButton';
import { propertiesApi } from '../../properties/api/propertiesApi';
import { leasesApi } from '../../properties/api/leasesApi';
import type { PropertyWithRelations } from '../../properties/api/propertiesApi';
import type { LeaseWithRelations } from '../../properties/api/leasesApi';
import { styles } from './OwnerPropertyDetailScreen.styles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OwnerPropertyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [activeLease, setActiveLease] = useState<LeaseWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (id) {
      loadPropertyDetails();
    }
  }, [id]);

  const loadPropertyDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch property details
      const propertyData = await propertiesApi.getProperty(id);
      setProperty(propertyData);

      // Fetch active lease if property is rented
      if (propertyData.status === 'rented') {
        try {
          const lease = await leasesApi.getActiveLease(id);
          setActiveLease(lease);
        } catch (err) {
          console.log('No active lease found');
        }
      }
    } catch (err) {
      console.error('Error loading property:', err);
      setError(err instanceof Error ? err.message : 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(owner)/properties/${id}/edit`);
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete Property',
      'Are you sure you want to delete this property? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertiesApi.deleteProperty(id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete property');
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async () => {
    if (!property) return;

    const newStatus = property.status === 'available' ? 'maintenance' : 'available';
    
    try {
      await propertiesApi.updateProperty(id, { status: newStatus });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadPropertyDetails();
    } catch (err) {
      Alert.alert('Error', 'Failed to update property status');
    }
  };

  const openFullScreenImage = (imageUrl: string, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentImageIndex(index);
    setFullScreenImage(imageUrl);
  };

  const closeFullScreenImage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFullScreenImage(null);
  };

  const navigateImage = (direction: 'next' | 'prev') => {
    if (!property?.images) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (direction === 'next') {
      const nextIndex = (currentImageIndex + 1) % property.images.length;
      setCurrentImageIndex(nextIndex);
      setFullScreenImage(property.images[nextIndex]);
    } else {
      const prevIndex = currentImageIndex === 0 ? property.images.length - 1 : currentImageIndex - 1;
      setCurrentImageIndex(prevIndex);
      setFullScreenImage(property.images[prevIndex]);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#002395" />
          <Text style={styles.loadingText}>Loading property...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !property) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error || 'Property not found'}</Text>
          <AnimatedButton onPress={() => router.back()}>
            <View style={styles.backButton}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </View>
          </AnimatedButton>
        </View>
      </SafeAreaView>
    );
  }

  const statusColors = {
    available: { bg: '#d1fae5', text: '#065f46' },
    rented: { bg: '#dbeafe', text: '#1e40af' },
    maintenance: { bg: '#fef3c7', text: '#92400e' },
    draft: { bg: '#f1f5f9', text: '#475569' },
  };

  const statusColor = statusColors[property.status as keyof typeof statusColors] || statusColors.draft;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <AnimatedButton onPress={() => router.back()}>
            <View style={styles.headerBackButton}>
              <Text style={styles.backIcon}>←</Text>
            </View>
          </AnimatedButton>
          <Text style={styles.headerTitle}>Property Details</Text>
          <View style={styles.headerActions}>
            <AnimatedButton onPress={handleEdit}>
              <View style={styles.headerIconButton}>
                <Text style={styles.headerIcon}>✏️</Text>
              </View>
            </AnimatedButton>
            <AnimatedButton onPress={handleDelete}>
              <View style={styles.headerIconButton}>
                <Text style={styles.headerIcon}>🗑️</Text>
              </View>
            </AnimatedButton>
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Photo Gallery */}
          {property.images && property.images.length > 0 ? (
            <View>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                style={styles.photoGallery}
              >
                {property.images.map((image, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.9}
                    onPress={() => openFullScreenImage(image, index)}
                  >
                    <Image
                      source={{ uri: image }}
                      style={styles.photo}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.photoCounter}>
                <Text style={styles.photoCounterText}>
                  {property.images.length} {property.images.length === 1 ? 'photo' : 'photos'}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.noPhotos}>
              <Text style={styles.noPhotosText}>📷 No photos</Text>
            </View>
          )}

          {/* Property Info */}
          <View style={styles.content}>
            {/* Title and Status */}
            <View style={styles.titleRow}>
              <Text style={styles.title}>{property.title}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.statusText, { color: statusColor.text }]}>
                  {property.status}
                </Text>
              </View>
            </View>

            {/* Rent */}
            <Text style={styles.rent}>R {(property.rent_amount || 0).toLocaleString()}/month</Text>

            {/* Address */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📍 Location</Text>
              <Text style={styles.address}>
                {property.address}
                {'\n'}
                {property.city}, {property.province}
                {property.postal_code ? ` ${property.postal_code}` : ''}
              </Text>
            </View>

            {/* Property Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏠 Property Details</Text>
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>{property.property_type}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Bedrooms</Text>
                  <Text style={styles.detailValue}>{property.bedrooms || 0}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Bathrooms</Text>
                  <Text style={styles.detailValue}>{property.bathrooms || 0}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Parking</Text>
                  <Text style={styles.detailValue}>{property.parking_spaces || 0}</Text>
                </View>
                {property.size_sqm && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Size</Text>
                    <Text style={styles.detailValue}>{property.size_sqm} sqm</Text>
                  </View>
                )}
                {property.deposit_amount && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Deposit</Text>
                    <Text style={styles.detailValue}>R {property.deposit_amount.toLocaleString()}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Lease Terms */}
            {(property.minimum_lease_months || property.pets_allowed !== null || property.smoking_allowed !== null) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📋 Lease Terms</Text>
                <View style={styles.termsGrid}>
                  {property.minimum_lease_months && (
                    <View style={styles.termItem}>
                      <Text style={styles.termLabel}>Minimum Lease</Text>
                      <Text style={styles.termValue}>{property.minimum_lease_months} months</Text>
                    </View>
                  )}
                  {property.pets_allowed !== null && (
                    <View style={styles.termItem}>
                      <Text style={styles.termLabel}>Pets</Text>
                      <Text style={styles.termValue}>{property.pets_allowed ? '✅ Allowed' : '❌ Not Allowed'}</Text>
                    </View>
                  )}
                  {property.smoking_allowed !== null && (
                    <View style={styles.termItem}>
                      <Text style={styles.termLabel}>Smoking</Text>
                      <Text style={styles.termValue}>{property.smoking_allowed ? '✅ Allowed' : '❌ Not Allowed'}</Text>
                    </View>
                  )}
                  {property.available_from && (
                    <View style={styles.termItem}>
                      <Text style={styles.termLabel}>Available From</Text>
                      <Text style={styles.termValue}>
                        {new Date(property.available_from).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>✨ Amenities</Text>
                <View style={styles.amenitiesGrid}>
                  {property.amenities.map((amenity, index) => (
                    <View key={index} style={styles.amenityChip}>
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Description */}
            {property.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📝 Description</Text>
                <Text style={styles.description}>{property.description}</Text>
              </View>
            )}

            {/* Current Tenant/Lease */}
            {activeLease && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>👤 Current Tenant</Text>
                <View style={styles.tenantCard}>
                  <View style={styles.tenantInfo}>
                    <Text style={styles.tenantName}>{activeLease.tenant?.full_name}</Text>
                    {activeLease.tenant?.email && (
                      <Text style={styles.tenantContact}>📧 {activeLease.tenant.email}</Text>
                    )}
                    {activeLease.tenant?.phone && (
                      <Text style={styles.tenantContact}>📱 {activeLease.tenant.phone}</Text>
                    )}
                  </View>
                  <View style={styles.leaseInfo}>
                    <Text style={styles.leaseLabel}>Lease Period</Text>
                    <Text style={styles.leaseValue}>
                      {new Date(activeLease.start_date).toLocaleDateString()} - {new Date(activeLease.end_date).toLocaleDateString()}
                    </Text>
                    <Text style={styles.leaseLabel}>Monthly Rent</Text>
                    <Text style={styles.leaseValue}>R {activeLease.monthly_rent.toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionsSection}>
              {property.status !== 'rented' && (
                <AnimatedButton onPress={handleToggleStatus}>
                  <View style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>
                      {property.status === 'available' ? 'Mark as Maintenance' : 'Mark as Available'}
                    </Text>
                  </View>
                </AnimatedButton>
              )}
              
              <AnimatedButton onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/(owner)/applications?propertyId=${id}` as any);
              }}>
                <View style={[styles.actionButton, styles.secondaryButton]}>
                  <Text style={styles.secondaryButtonText}>View Applications</Text>
                </View>
              </AnimatedButton>

              <AnimatedButton onPress={() => Alert.alert('Coming Soon', 'Maintenance history feature')}>
                <View style={[styles.actionButton, styles.secondaryButton]}>
                  <Text style={styles.secondaryButtonText}>Maintenance History</Text>
                </View>
              </AnimatedButton>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Full Screen Image Modal */}
      <Modal
        visible={!!fullScreenImage}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFullScreenImage}
      >
        <View style={styles.fullScreenContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeFullScreenImage}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          {/* Image Counter */}
          {property?.images && property.images.length > 1 && (
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {currentImageIndex + 1} / {property.images.length}
              </Text>
            </View>
          )}

          {/* Full Screen Image */}
          <ScrollView
            contentContainerStyle={styles.fullScreenImageContainer}
            maximumZoomScale={3}
            minimumZoomScale={1}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            <Image
              source={{ uri: fullScreenImage || '' }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </ScrollView>

          {/* Navigation Arrows */}
          {property?.images && property.images.length > 1 && (
            <>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonLeft]}
                onPress={() => navigateImage('prev')}
                activeOpacity={0.8}
              >
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navButton, styles.navButtonRight]}
                onPress={() => navigateImage('next')}
                activeOpacity={0.8}
              >
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
