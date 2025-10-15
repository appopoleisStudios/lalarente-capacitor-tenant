import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { uploadMultipleFiles } from '../../../lib/storage';
import { Alert } from 'react-native';

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB (Supabase limit)

type MediaFile = {
  uri: string;
  type: 'photo' | 'video';
  size?: number;
};

export function useMediaUpload(maxFiles: number = 10) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Request camera permissions
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed');
      return false;
    }
    return true;
  };

  // Request media library permissions
  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Media library access is needed');
      return false;
    }
    return true;
  };

  // Take photo with camera
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    if (files.length >= maxFiles) {
      Alert.alert('Limit Reached', `You can only upload up to ${maxFiles} files`);
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setFiles((prev) => [...prev, {
        uri: result.assets[0].uri,
        type: 'photo',
      }]);
    }
  };

  // Pick photos/videos from gallery
  const pickMedia = async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return;

    const remainingSlots = maxFiles - files.length;
    if (remainingSlots <= 0) {
      Alert.alert('Limit Reached', `You can only upload up to ${maxFiles} files`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, // Photos + Videos
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remainingSlots,
      videoMaxDuration: 120, // 2 minutes max
    });

    if (!result.canceled && result.assets.length > 0) {
      const newFiles: MediaFile[] = [];
      
      for (const asset of result.assets) {
        // Check video size
        if (asset.type === 'video' && asset.fileSize && asset.fileSize > MAX_VIDEO_SIZE) {
          Alert.alert(
            'File Too Large',
            `Video exceeds 50MB limit. Please choose a smaller file.`
          );
          continue;
        }

        newFiles.push({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'photo',
          size: asset.fileSize,
        });
      }

      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  // Remove file
  const removeFile = (uri: string) => {
    setFiles((prev) => prev.filter(file => file.uri !== uri));
  };

  // Upload files to Supabase Storage
  const uploadFiles = async (bucket: string = 'maintenance-images') => {
    if (files.length === 0) return { photos: [], videos: [] };

    try {
      setUploading(true);
      setUploadProgress(0);

      const uris = files.map(f => f.uri);
      const urls = await uploadMultipleFiles(
        uris,
        bucket,
        (progress) => setUploadProgress(progress)
      );

      // Separate photos and videos
      const photos: string[] = [];
      const videos: string[] = [];

      files.forEach((file, index) => {
        if (file.type === 'video') {
          videos.push(urls[index]);
        } else {
          photos.push(urls[index]);
        }
      });

      setUploading(false);
      return { photos, videos };
    } catch (error: any) {
      setUploading(false);
      Alert.alert('Upload Failed', error.message);
      throw error;
    }
  };

  // Reset
  const reset = () => {
    setFiles([]);
    setUploadProgress(0);
  };

  return {
    files,
    uploading,
    uploadProgress,
    takePhoto,
    pickMedia,
    removeFile,
    uploadFiles,
    reset,
    canAddMore: files.length < maxFiles,
  };
}
