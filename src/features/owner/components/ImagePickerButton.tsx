import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Pressable } from 'react-native';
import { AnimatedButton } from './AnimatedButton';

interface ImagePickerButtonProps {
  images: string[];
  onPick: () => void;
  onRemove: (index: number) => void;
}

export const ImagePickerButton = ({ images, onPick, onRemove }: ImagePickerButtonProps) => {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
        {/* Add Photo Button */}
        <AnimatedButton onPress={onPick}>
          <View style={styles.addImageButton}>
            <Text style={styles.addImageIcon}>📷</Text>
            <Text style={styles.addImageText}>Add Photos</Text>
            <Text style={styles.addImageSubtext}>Up to 5</Text>
          </View>
        </AnimatedButton>

        {/* Image Previews */}
        {images.map((uri, index) => (
          <View key={index} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.image} />
            <Pressable style={styles.removeButton} onPress={() => onRemove(index)}>
              <Text style={styles.removeIcon}>✕</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <Text style={styles.hint}>Tap to add up to 5 photos of your property</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  imageScroll: { marginBottom: 8 },
  addImageButton: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addImageIcon: { fontSize: 32, marginBottom: 4 },
  addImageText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  addImageSubtext: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  imageWrapper: {
    width: 120,
    height: 120,
    marginRight: 12,
    position: 'relative',
  },
  image: { width: '100%', height: '100%', borderRadius: 12 },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeIcon: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});
