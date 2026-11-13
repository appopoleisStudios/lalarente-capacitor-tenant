import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/src/lib/supabase';

/** Longest side of an uploaded photo — sharp on a phone, a few hundred KB. */
export const UPLOAD_PHOTO_MAX_PX = 1280;

/**
 * Shrinks a picked/captured photo to at most UPLOAD_PHOTO_MAX_PX on its longer
 * side and re-encodes it as JPEG (HEIC included). Camera originals (4032×3024,
 * 1–3 MB) took ~20 s to show on listing screens.
 */
export async function preparePhotoForUpload(uri: string): Promise<string> {
  const probe = await manipulateAsync(uri, []);
  const longest = Math.max(probe.width, probe.height);
  const resize =
    longest > UPLOAD_PHOTO_MAX_PX
      ? probe.width >= probe.height
        ? [{ resize: { width: UPLOAD_PHOTO_MAX_PX } }]
        : [{ resize: { height: UPLOAD_PHOTO_MAX_PX } }]
      : [];
  const out = await manipulateAsync(uri, resize, { compress: 0.6, format: SaveFormat.JPEG });
  return out.uri;
}

/**
 * Resizes a local photo and uploads it to `bucket` under `folder/`, returning
 * the public URL. Reads base64 → ArrayBuffer because `fetch(uri).blob()` is
 * empty on React Native + Hermes.
 */
export async function uploadPhoto(
  bucket: string,
  folder: string,
  localUri: string
): Promise<string> {
  const photoUri = await preparePhotoForUpload(localUri);
  const base64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, decode(base64), {
    contentType: 'image/jpeg',
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(`Failed to upload photo: ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
}
