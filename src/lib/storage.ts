import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase, STORAGE_BUCKETS } from './supabase';

// Re-export STORAGE_BUCKETS for convenience
export { STORAGE_BUCKETS };

export type UploadResult = {
  url: string;
  path: string;
  error?: string;
};

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  bucket: keyof typeof STORAGE_BUCKETS,
  file: {
    uri: string;
    name: string;
    type: string;
  },
  folder?: string
): Promise<UploadResult> {
  try {
    const bucketName = STORAGE_BUCKETS[bucket];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = folder ? `${folder}/${fileName}` : fileName;

    // Read as base64 then decode to ArrayBuffer — fetch().blob() is not available on Hermes/RN
    const base64 = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const arrayBuffer = decode(base64);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, arrayBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error: any) {
    return {
      url: '',
      path: '',
      error: error.message,
    };
  }
}

/**
 * Upload multiple files
 */
export async function uploadMultipleFiles(
  bucket: keyof typeof STORAGE_BUCKETS,
  files: Array<{ uri: string; name: string; type: string }>,
  folder?: string
): Promise<UploadResult[]> {
  const uploads = files.map((file) => uploadFile(bucket, file, folder));
  return Promise.all(uploads);
}

/**
 * Delete file from storage
 */
export async function deleteFile(
  bucket: keyof typeof STORAGE_BUCKETS,
  path: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const bucketName = STORAGE_BUCKETS[bucket];
    const { error } = await supabase.storage.from(bucketName).remove([path]);

    if (error) throw error;

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
