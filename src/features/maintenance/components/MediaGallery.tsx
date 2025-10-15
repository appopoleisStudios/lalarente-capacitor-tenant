import React, { useState } from 'react';
import { View, Image, Text, TouchableOpacity, Modal, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/shared/theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const THUMBNAIL_SIZE = (SCREEN_WIDTH - 48) / 3; // 3 columns with padding

interface MediaGalleryProps {
  images: string[];
}

export function MediaGallery({ images }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const isVideo = (url: string) => url.includes('.mp4') || url.includes('.mov');

  return (
    <>
      {/* Thumbnail Grid */}
      <View style={styles.grid}>
        {images.map((url, index) => (
          <TouchableOpacity
            key={index}
            style={styles.thumbnail}
            onPress={() => setSelectedIndex(index)}
          >
            {isVideo(url) ? (
              <View style={styles.videoThumbnail}>
                <Ionicons name="play-circle" size={32} color="#FFFFFF" />
              </View>
            ) : (
              <Image source={{ uri: url }} style={styles.thumbnailImage} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Full Screen Modal */}
      <Modal
        visible={selectedIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
      >
        <View style={styles.modalContainer}>
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedIndex(null)}
          >
            <Ionicons name="close" size={32} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Media Viewer */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: (selectedIndex || 0) * SCREEN_WIDTH, y: 0 }}
          >
            {images.map((url, index) => (
              <View key={index} style={styles.mediaContainer}>
                {isVideo(url) ? (
                  <Video
                    source={{ uri: url }}
                    style={styles.fullMedia}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={index === selectedIndex}
                  />
                ) : (
                  <Image
                    source={{ uri: url }}
                    style={styles.fullMedia}
                    resizeMode="contain"
                  />
                )}
              </View>
            ))}
          </ScrollView>

          {/* Counter */}
          {selectedIndex !== null && (
            <View style={styles.counter}>
              <Ionicons name="images" size={16} color="#FFFFFF" />
              <View style={styles.counterSpacer} />
              <Text style={styles.counterText}>
                {selectedIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.gray[200],
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray[800],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMedia: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  counter: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  counterSpacer: {
    width: 8,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
