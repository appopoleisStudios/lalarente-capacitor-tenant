import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { propertiesApi } from '../../properties/api/propertiesApi';
import type { PropertyWithRelations } from '../../properties/api/propertiesApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RSA = { green: '#007A4D', blue: '#002395' };

const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'available':
      return { backgroundColor: '#E8F5E9' };
    case 'rented':
      return { backgroundColor: '#FFEBEE' };
    case 'maintenance':
      return { backgroundColor: '#FFF3E0' };
    default:
      return { backgroundColor: '#F5F5F5' };
  }
};

const getStatusTextColor = (status: string) => {
  switch (status) {
    case 'available':
      return '#4CAF50';
    case 'rented':
      return '#F44336';
    case 'maintenance':
      return '#FF9800';
    default:
      return '#666';
  }
};

export default function TenantPropertyDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [property, setProperty] = useState<PropertyWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [hasActiveApplication, setHasActiveApplication] = useState(false);
  const [isCurrentProperty, setIsCurrentProperty] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadPropertyDetails();
    }
  }, [id]);

  // Reload when screen comes into focus (to show updated application status)
  useFocusEffect(
    useCallback(() => {
      if (id) {
        loadPropertyDetails();
      }
    }, [id])
  );

  const loadPropertyDetails = async () => {
    try {
      setError(null);
      console.log('🏠 Loading property details for ID:', id);
      const data = await propertiesApi.getProperty(id);
      
      console.log('📦 Property data received:', data);
      console.log('👤 Owner in property data:', data.owner);
      console.log('📝 Owner full_name:', data.owner?.full_name);
      
      // Business Logic: Check if property is actually available
      if (data.status !== 'available') {
        setError('This property is no longer available');
        setProperty(data);
        setLoading(false);
        return;
      }

      // Check for active leases (double verification)
      const { data: activeLeases } = await supabase
        .from('leases')
        .select('id, status, end_date')
        .eq('property_id', id)
        .eq('status', 'active')
        .single();

      if (activeLeases) {
        // Property has an active lease - should not be available
        setError('This property is currently occupied');
        setProperty(data);
        setLoading(false);
        return;
      }

      setProperty(data);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('👤 Current user ID:', user.id);
        
        // Check if tenant already has an active lease on this property
        const { data: tenantLease, error: leaseError } = await supabase
          .from('leases')
          .select('id')
          .eq('property_id', id)
          .eq('tenant_id', user.id)
          .eq('status', 'active')
          .maybeSingle();

        console.log('🏠 Tenant lease check:', tenantLease, leaseError);

        if (tenantLease) {
          console.log('✅ User has active lease on this property');
          setIsCurrentProperty(true);
        }

        // Check if tenant already has a pending application for this property
        const { data: existingApp, error: appError } = await supabase
          .from('rental_applications')
          .select('id, status, rejected_at, created_at')
          .eq('property_id', id)
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        console.log('📝 Existing application check:', existingApp, appError);

        if (existingApp) {
          // Store the application for status display
          setApplicationStatus(existingApp.status);
          setApplicationId(existingApp.id);
          
          // Check for pending applications (draft, submitted, under_review)
          if (['draft', 'submitted', 'under_review'].includes(existingApp.status)) {
            console.log('⚠️ User has pending application:', existingApp.status);
            setHasActiveApplication(true);
          }
          // Check for rejected applications within 3 months
          else if (existingApp.status === 'rejected' && existingApp.rejected_at) {
            const rejectedDate = new Date(existingApp.rejected_at);
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
            
            if (rejectedDate > threeMonthsAgo) {
              console.log('⚠️ User was rejected within 3 months - cannot reapply yet');
              setHasActiveApplication(true);
              // Don't set error - let the status banner show instead
            } else {
              console.log('✅ Rejection was more than 3 months ago - user can apply');
              setHasActiveApplication(false);
            }
          }
          // Approved applications - user should not apply again
          else if (existingApp.status === 'approved') {
            console.log('⚠️ User already has approved application');
            setHasActiveApplication(true);
          }
          else {
            console.log('✅ Previous application was withdrawn or old rejection - user can apply');
            setHasActiveApplication(false);
          }
        } else {
          console.log('✅ No previous application - user can apply');
          setHasActiveApplication(false);
        }

        // TODO: Check favorites table when implemented
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load property');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestViewing = () => {
    if (isCurrentProperty) {
      Alert.alert('Notice', 'This is your current property. You are already living here.');
      return;
    }
    if (!property) {
      Alert.alert('Error', 'Property information not available');
      return;
    }
    router.push({
      pathname: '/(tenant)/viewings/request',
      params: {
        propertyId: property.id,
        propertyTitle: property.title,
        ownerId: property.owner_id,
      },
    });
  };

  const handleApply = () => {
    if (isCurrentProperty) {
      Alert.alert('Notice', 'This is your current property. You are already living here.');
      return;
    }
    if (hasActiveApplication) {
      Alert.alert('Notice', 'You already have a pending application for this property.');
      return;
    }
    router.push(`/(tenant)/apply/${id}` as any);
  };

  const handleToggleFavorite = () => {
    setIsFavorite(!isFavorite);
    // TODO: Save to favorites table
  };

  const handleShare = () => {
    Alert.alert('Share', 'Share functionality coming soon');
  };

  const handleContactOwner = () => {
    if (property?.owner) {
      Alert.alert(
        'Contact Owner',
        `${property.owner.full_name}\n${property.owner.phone || ''}\n${property.owner.email || ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call', onPress: () => {} },
          { text: 'Message', onPress: () => {} },
        ]
      );
    }
  };

  // Debug log before render
  console.log('🎨 Rendering with property:', property);
  console.log('🎨 Property owner in state:', property?.owner);
  console.log('🔘 hasActiveApplication:', hasActiveApplication);
  console.log('🔘 isCurrentProperty:', isCurrentProperty);
  console.log('🔘 Button should be disabled:', isCurrentProperty || hasActiveApplication);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={RSA.green} />
          <Text style={styles.loadingText}>Loading property...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !property) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
          <Text style={styles.errorText}>{error || 'Property not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPropertyDetails}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const images = property.images && property.images.length > 0 ? property.images : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
              <Ionicons name="share-outline" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleToggleFavorite} style={styles.headerButton}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorite ? '#F44336' : '#333'}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Image Gallery */}
          {images.length > 0 ? (
            <View style={styles.imageContainer}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setCurrentImageIndex(index);
                }}
                scrollEventThrottle={16}
              >
                {images.map((image, index) => (
                  <Image key={index} source={{ uri: image }} style={styles.propertyImage} />
                ))}
              </ScrollView>
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1} / {images.length}
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.propertyImage, styles.noImage]}>
              <Ionicons name="home-outline" size={64} color="#CCC" />
            </View>
          )}

          {/* Property Info */}
          <View style={styles.content}>
            {/* Title and Price */}
            <View style={styles.titleSection}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{property.title}</Text>
                <View style={[styles.statusBadge, getStatusBadgeStyle(property.status || 'available')]}>
                  <Text style={styles.statusBadgeText}>{property.status || 'available'}</Text>
                </View>
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.price}>R {(property.rent_amount || 0).toLocaleString()}</Text>
                <Text style={styles.priceLabel}>/month</Text>
              </View>
            </View>

            {/* Location */}
            <View style={styles.locationRow}>
              <Ionicons name="location" size={20} color={RSA.green} />
              <Text style={styles.locationText}>
                {property.address}, {property.city}, {property.province}
              </Text>
            </View>

            {/* Owner Name */}
            {property.owner && (
              <View style={styles.ownerRow}>
                <Ionicons name="person-outline" size={18} color="#666" />
                <Text style={styles.ownerText}>
                  Listed by {property.owner.full_name}
                </Text>
              </View>
            )}
            
            {/* Debug: Show if owner data is missing */}
            {!property.owner && (
              <View style={styles.ownerRow}>
                <Ionicons name="alert-circle-outline" size={18} color="#F44336" />
                <Text style={[styles.ownerText, { color: '#F44336' }]}>
                  DEBUG: Owner data not loaded
                </Text>
              </View>
            )}

            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="bed-outline" size={24} color="#666" />
                <Text style={styles.statText}>{property.bedrooms || 0} Beds</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="water-outline" size={24} color="#666" />
                <Text style={styles.statText}>{property.bathrooms || 0} Baths</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="car-outline" size={24} color="#666" />
                <Text style={styles.statText}>{property.parking_spaces || 0} Parking</Text>
              </View>
              {property.size_sqm && (
                <View style={styles.statItem}>
                  <Ionicons name="resize-outline" size={24} color="#666" />
                  <Text style={styles.statText}>{property.size_sqm} sqm</Text>
                </View>
              )}
            </View>

            {/* Description */}
            {property.description && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.description}>{property.description}</Text>
              </View>
            )}

            {/* Property Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Property Details</Text>
              <View style={styles.detailsGrid}>
                <DetailRow label="Type" value={property.property_type} />
                {property.deposit_amount && (
                  <DetailRow label="Deposit" value={`R ${property.deposit_amount.toLocaleString()}`} />
                )}
                {property.available_from && (
                  <DetailRow
                    label="Available From"
                    value={new Date(property.available_from).toLocaleDateString()}
                  />
                )}
                {property.minimum_lease_months && (
                  <DetailRow label="Min. Lease" value={`${property.minimum_lease_months} months`} />
                )}
              </View>
            </View>

            {/* Lease Terms */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lease Terms</Text>
              <View style={styles.termsGrid}>
                <TermItem
                  icon="paw"
                  label="Pets"
                  value={property.pets_allowed ? 'Allowed' : 'Not Allowed'}
                  allowed={property.pets_allowed}
                />
                <TermItem
                  icon="ban"
                  label="Smoking"
                  value={property.smoking_allowed ? 'Allowed' : 'Not Allowed'}
                  allowed={property.smoking_allowed}
                />
              </View>
            </View>

            {/* Amenities */}
            {property.amenities && property.amenities.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Amenities</Text>
                <View style={styles.amenitiesGrid}>
                  {property.amenities.map((amenity, index) => (
                    <View key={index} style={styles.amenityChip}>
                      <Ionicons name="checkmark-circle" size={16} color={RSA.green} />
                      <Text style={styles.amenityText}>{amenity}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Owner Info */}
            {property.owner && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Property Owner</Text>
                <View style={styles.ownerCard}>
                  <View style={styles.ownerAvatar}>
                    <Ionicons name="person" size={32} color="#FFF" />
                  </View>
                  <View style={styles.ownerInfo}>
                    <Text style={styles.ownerName}>{property.owner.full_name}</Text>
                    <Text style={styles.ownerLabel}>Property Owner</Text>
                  </View>
                  <TouchableOpacity style={styles.contactButton} onPress={handleContactOwner}>
                    <Ionicons name="chatbubble-outline" size={20} color={RSA.green} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Application Status Banner */}
        {applicationStatus && (
          <View style={[styles.statusBanner, getStatusBannerStyle(applicationStatus)]}>
            <Ionicons name={getStatusIcon(applicationStatus)} size={20} color="#FFF" />
            <View style={styles.statusBannerContent}>
              <Text style={styles.statusBannerTitle}>
                {getStatusTitle(applicationStatus)}
              </Text>
              <Text style={styles.statusBannerText}>
                {getStatusMessage(applicationStatus)}
              </Text>
            </View>
            {applicationId && (
              <TouchableOpacity 
                onPress={() => router.push(`/(tenant)/applications/${applicationId}` as any)}
                style={styles.viewApplicationButton}
              >
                <Text style={styles.viewApplicationButtonText}>View</Text>
                <Ionicons name="chevron-forward" size={16} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Action Buttons - Only show if property is available */}
        {property.status === 'available' && !error && (
          <View style={styles.actionBar}>
            <TouchableOpacity 
              style={[styles.viewingButton, isCurrentProperty && styles.disabledButton]} 
              onPress={handleRequestViewing}
              disabled={isCurrentProperty}
            >
              <Ionicons name="calendar-outline" size={20} color={isCurrentProperty ? '#999' : RSA.green} />
              <Text style={[styles.viewingButtonText, isCurrentProperty && styles.disabledButtonText]}>
                Request Viewing
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.applyButton, (isCurrentProperty || hasActiveApplication) && styles.disabledButton]} 
              onPress={handleApply}
              disabled={isCurrentProperty || hasActiveApplication}
            >
              <Text style={[styles.applyButtonText, (isCurrentProperty || hasActiveApplication) && styles.disabledButtonText]}>
                {isCurrentProperty 
                  ? 'Current Property' 
                  : hasActiveApplication 
                    ? applicationStatus === 'rejected'
                      ? 'Cannot Reapply Yet'
                      : applicationStatus === 'approved'
                        ? 'Already Approved'
                        : 'Application Pending'
                    : 'Apply Now'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Show unavailable message if property is not available */}
        {(property.status !== 'available' || error) && (
          <View style={styles.unavailableBar}>
            <Ionicons name="information-circle" size={20} color="#F44336" />
            <Text style={styles.unavailableText}>
              {error || 'This property is not available for rent'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const TermItem = ({
  icon,
  label,
  value,
  allowed,
}: {
  icon: any;
  label: string;
  value: string;
  allowed: boolean | null;
}) => (
  <View style={styles.termItem}>
    <Ionicons name={icon} size={20} color={allowed ? RSA.green : '#F44336'} />
    <View style={styles.termContent}>
      <Text style={styles.termLabel}>{label}</Text>
      <Text style={[styles.termValue, { color: allowed ? RSA.green : '#F44336' }]}>{value}</Text>
    </View>
  </View>
);

// Helper functions for application status
const getStatusBannerStyle = (status: string) => {
  switch (status) {
    case 'submitted':
      return { backgroundColor: '#2196F3' };
    case 'under_review':
      return { backgroundColor: '#FF9800' };
    case 'approved':
      return { backgroundColor: '#4CAF50' };
    case 'rejected':
      return { backgroundColor: '#F44336' };
    case 'withdrawn':
      return { backgroundColor: '#9E9E9E' };
    default:
      return { backgroundColor: '#757575' };
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'submitted':
      return 'paper-plane';
    case 'under_review':
      return 'eye';
    case 'approved':
      return 'checkmark-circle';
    case 'rejected':
      return 'close-circle';
    case 'withdrawn':
      return 'remove-circle';
    default:
      return 'document-text';
  }
};

const getStatusTitle = (status: string) => {
  switch (status) {
    case 'submitted':
      return 'Application Submitted';
    case 'under_review':
      return 'Under Review';
    case 'approved':
      return 'Application Approved!';
    case 'rejected':
      return 'Application Rejected';
    case 'withdrawn':
      return 'Application Withdrawn';
    default:
      return 'Application Status';
  }
};

const getStatusMessage = (status: string) => {
  switch (status) {
    case 'submitted':
      return 'Your application is waiting for the owner to review';
    case 'under_review':
      return 'The owner is currently reviewing your application';
    case 'approved':
      return 'Congratulations! The owner will contact you to proceed with the lease';
    case 'rejected':
      return 'Unfortunately, your application was not accepted';
    case 'withdrawn':
      return 'You withdrew this application';
    default:
      return '';
  }
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: RSA.green,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  scrollView: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
  },
  propertyImage: {
    width: SCREEN_WIDTH,
    height: 300,
    backgroundColor: '#F5F5F5',
  },
  noImage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  imageCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  titleSection: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
    textTransform: 'capitalize',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: RSA.green,
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  ownerText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  detailsGrid: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  detailLabel: {
    fontSize: 16,
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize',
  },
  termsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  termItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  termContent: {
    flex: 1,
  },
  termLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  termValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  amenityText: {
    fontSize: 14,
    color: '#666',
  },
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
  },
  ownerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: RSA.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  ownerLabel: {
    fontSize: 14,
    color: '#666',
  },
  contactButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 12,
  },
  viewingButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: RSA.green,
    gap: 8,
  },
  viewingButtonText: {
    color: RSA.green,
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: RSA.green,
  },
  applyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  unavailableBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#FFEBEE',
    borderTopWidth: 1,
    borderTopColor: '#FFCDD2',
    gap: 8,
  },
  unavailableText: {
    color: '#F44336',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#E0E0E0',
    borderColor: '#E0E0E0',
  },
  disabledButtonText: {
    color: '#999',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  statusBannerContent: {
    flex: 1,
  },
  statusBannerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  statusBannerText: {
    color: '#FFF',
    fontSize: 14,
    opacity: 0.9,
  },
  viewApplicationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    gap: 4,
  },
  viewApplicationButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
