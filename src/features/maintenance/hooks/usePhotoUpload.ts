import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { uploadMultipleFiles } from '@/src/lib/storage';
import { Alert } from 'react-native';

export function usePhotoUpload(maxPhotos: number = 10) {
  const [photos, setPhotos] = useState<string[]>([]); // Local URIs
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Request camera permissions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos');
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Photo library access is needed');
      return false;
    }
    return true;
  };

  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    if (photos.length >= maxPhotos) {
      Alert.alert('Limit Reached', `You can only upload up to ${maxPhotos} photos`);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotos((prev) => [...prev, uri]);
    }
  };

  // Pick photos from gallery (multiple selection)
  const pickPhotos = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    const remainingSlots = maxPhotos - photos.length;
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', `You can only upload up to ${maxPhotos} photos`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remainingSlots,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uris = result.assets.map(asset => asset.uri);
      setPhotos((prev) => [...prev, ...uris]);
    }
  };

  // Remove photo
  const removePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter(photo => photo !== uri));
  };

  // Upload photos to Supabase Storage (returns array of URLs)
  const uploadPhotos = async (
    bucketKey: 'PROPERTY_IMAGES' | 'DOCUMENTS' | 'CONTRACTS' = 'PROPERTY_IMAGES',
    folder?: string
  ) => {
    if (photos.length === 0) return [];

    try {
      setUploading(true);
      setUploadProgress(0);

      // Convert photo URIs to file objects
      const fileObjects = photos.map((uri, index) => ({
        uri,
        name: `photo_${Date.now()}_${index}.jpg`,
        type: 'image/jpeg',
      }));

      // Upload files and get results
      const results = await uploadMultipleFiles(bucketKey, fileObjects, folder);

      // Extract URLs from successful uploads
      const urls = results
        .filter(r => !r.error)
        .map(r => r.url);

      // Calculate progress (simplified)
      setUploadProgress(100);
      setUploading(false);

      return urls; // These URLs go directly into the 'images' column (text[])
    } catch (error: any) {
      setUploading(false);
      Alert.alert('Upload Failed', error.message);
      throw error;
    }
  };

  // Reset
  const reset = () => {
    setPhotos([]);
    setUploadProgress(0);
  };

  return {
    photos,
    uploading,
    uploadProgress,
    takePhoto,
    pickPhotos,
    removePhoto,
    uploadPhotos,
    reset,
    canAddMore: photos.length < maxPhotos,
  };
}
