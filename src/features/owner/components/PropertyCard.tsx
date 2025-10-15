import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { AnimatedButton } from './AnimatedButton';

interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  province: string;
  rent_amount: number;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  status: 'available' | 'occupied' | 'maintenance' | 'vacant';
  images?: string[];
}

interface PropertyCardProps {
  property: Property;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
}

const STATUS_COLORS = {
  available: { bg: '#d1fae5', text: '#065f46' },
  occupied: { bg: '#dbeafe', text: '#1e40af' },
  maintenance: { bg: '#fef3c7', text: '#92400e' },
  vacant: { bg: '#f1f5f9', text: '#475569' },
};

export const PropertyCard = ({ property, onView, onEdit }: PropertyCardProps) => {
  const statusColor = STATUS_COLORS[property.status];

  return (
    <View style={styles.card}>
      {/* Image */}
      <View style={styles.imageContainer}>
        {property.images && property.images.length > 0 ? (
          <Image source={{ uri: property.images[0] }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>No photos</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>{property.status}</Text>
          </View>
        </View>

        <Text style={styles.address} numberOfLines={1}>
          {property.address}, {property.city}, {property.province}
        </Text>

        <Text style={styles.rent}>R {property.rent_amount.toLocaleString()}</Text>

        {(property.bedrooms != null || property.bathrooms != null || property.parking_spaces != null) && (
          <View style={styles.details}>
            {property.bedrooms != null && <Text style={styles.detail}>{property.bedrooms} bd</Text>}
            {property.bathrooms != null && <Text style={styles.detail}>{property.bathrooms} ba</Text>}
            {property.parking_spaces != null && <Text style={styles.detail}>{property.parking_spaces} parking</Text>}
          </View>
        )}

        <View style={styles.actions}>
          <AnimatedButton onPress={() => onView(property.id)} style={styles.viewButtonWrapper}>
            <View style={styles.viewButton}>
              <Text style={styles.viewButtonText}>View</Text>
            </View>
          </AnimatedButton>
          <AnimatedButton onPress={() => onEdit(property.id)} style={styles.editButtonWrapper}>
            <View style={styles.editButton}>
              <Text style={styles.editButtonText}>Edit</Text>
            </View>
          </AnimatedButton>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { 
    borderRadius: 12, 
    overflow: 'hidden', 
    backgroundColor: '#ffffff', 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#e5e7eb',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  imageContainer: { height: 112, backgroundColor: '#f3f4f6' },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 12, color: '#9ca3af' },
  content: { padding: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '600' },
  address: { fontSize: 13, color: '#6b7280', marginBottom: 6, lineHeight: 18 },
  rent: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 6 },
  details: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  detail: { fontSize: 12, color: '#6b7280' },
  actions: { flexDirection: 'row', gap: 8 },
  viewButtonWrapper: { flex: 1 },
  viewButton: { backgroundColor: '#002395', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  viewButtonText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  editButtonWrapper: { flex: 1 },
  editButton: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#d1d5db', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  editButtonText: { fontSize: 13, fontWeight: '600', color: '#374151' },
});
