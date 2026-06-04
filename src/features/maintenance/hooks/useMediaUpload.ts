import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { supabase, STORAGE_BUCKETS } from '@/src/lib/supabase';
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
    if (files.length >= maxFiles) {
      Alert.alert('Limit Reached', `You can only upload up to ${maxFiles} files`);
      return;
    }

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], // Updated from deprecated MediaTypeOptions
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setFiles((prev) => [...prev, {
          uri: result.assets[0].uri,
          type: 'photo',
        }]);
      }
    } catch (error: any) {
      // Handle simulator camera error gracefully
      if (error.message?.includes('Camera') || error.message?.includes('simulator')) {
        Alert.alert(
          'Camera Not Available',
          'Camera is not available on simulator. Please use "Pick from Gallery" instead or test on a physical device.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Camera Error', error.message || 'Failed to open camera');
      }
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

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'], // Updated from deprecated MediaTypeOptions.All
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
    } catch (error: any) {
      Alert.alert('Gallery Error', error.message || 'Failed to open gallery');
    }
  };

  // Remove file
  const removeFile = (uri: string) => {
    setFiles((prev) => prev.filter(file => file.uri !== uri));
  };

  // Upload files to Supabase Storage
  const uploadFiles = async (requestId: string) => {
    if (files.length === 0) return [];

    try {
      setUploading(true);
      setUploadProgress(0);

      const uploadedUrls: string[] = [];
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Generate unique filename
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const ext = file.type === 'video' ? 'mp4' : 'jpg';
        const fileName = `${timestamp}-${random}.${ext}`;
        const filePath = `${requestId}/${fileName}`;

        // React Native: read local URI as base64 (camera content:// URIs fail with fetch)
        const base64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const arrayBuffer = decode(base64);

        // Upload to Supabase Storage using ArrayBuffer
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKETS.MAINTENANCE_MEDIA)
          .upload(filePath, arrayBuffer, {
            contentType: file.type === 'video' ? 'video/mp4' : 'image/jpeg',
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload ${file.type}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKETS.MAINTENANCE_MEDIA)
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);

        // Update progress
        setUploadProgress(((i + 1) / totalFiles) * 100);
      }

      setUploading(false);
      return uploadedUrls;
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
