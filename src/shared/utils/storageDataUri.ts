import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/src/lib/supabase';

/**
 * Turns a photo/signature reference into an embeddable data URI. Remote files
 * are downloaded first — expo-print does not reliably wait for remote <img>s,
 * so linked photos went missing from the PDF. Returns null when unavailable
 * (e.g. an old file:// path from another device).
 */
export async function toDataUri(uri: string | null | undefined): Promise<string | null> {
  if (!uri) return null;
  try {
    let local = uri;
    if (/^https?:\/\//.test(uri)) {
      const target = `${FileSystem.cacheDirectory}pdf-${Math.random().toString(36).slice(2)}`;
      const res = await FileSystem.downloadAsync(uri, target);
      if (res.status >= 400) return null;
      local = res.uri;
    }
    const base64 = await FileSystem.readAsStringAsync(local, { encoding: 'base64' as any });
    const mime = /\.png(\?|$)/i.test(uri) ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

/** Signatures live in the private `signatures` bucket — sign the URL first. */
export async function signatureDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const m = /\/signatures\/(.+?)(\?|$)/.exec(url);
  if (!m) return toDataUri(url);
  const { data } = await supabase.storage.from('signatures').createSignedUrl(m[1], 300);
  return toDataUri(data?.signedUrl ?? url);
}
