import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { StatusBadge } from './StatusBadge';
import { PriorityIndicator } from './PriorityIndicator';

interface MaintenanceCardProps {
  request: {
    id: string;
    title: string;
    description: string;
    status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'closed';
    priority: 'low' | 'medium' | 'high';
    created_at: string;
    images?: string[];
    property?: {
      title: string;
      address: string;
    };
    category?: {
      name: string;
    };
  };
  onPress: () => void;
}

export function MaintenanceCard({ request, onPress }: MaintenanceCardProps) {
  const formattedDate = new Date(request.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.badges}>
          <StatusBadge status={request.status} size="small" />
          <PriorityIndicator priority={request.priority} size="small" />
        </View>
        <Text style={styles.date}>{formattedDate}</Text>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={1}>
        {request.title}
      </Text>

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>
        {request.description}
      </Text>

      {/* Property & Category */}
      <View style={styles.meta}>
        {request.property && (
          <Text style={styles.metaText} numberOfLines={1}>
            📍 {request.property.title}
          </Text>
        )}
        {request.category && (
          <Text style={styles.metaText}>
            🔧 {request.category.name}
          </Text>
        )}
      </View>

      {/* Images Preview */}
      {request.images && request.images.length > 0 && (
        <View style={styles.imagesPreview}>
          {request.images.slice(0, 3).map((uri, index) => (
            <Image
              key={index}
              source={{ uri }}
              style={styles.thumbnail}
            />
          ))}
          {request.images.length > 3 && (
            <View style={styles.moreImages}>
              <Text style={styles.moreImagesText}>+{request.images.length - 3}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  date: {
    fontSize: 12,
    color: '#64748B',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 12,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    flex: 1,
  },
  imagesPreview: {
    flexDirection: 'row',
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  moreImages: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
});
