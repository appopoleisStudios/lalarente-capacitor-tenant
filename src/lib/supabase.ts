import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Database } from '@/src/types/database.types';
import { createFetchWithTimeout } from './fetchWithTimeout';

// Session storage: memory first, SecureStore behind it (CT7-067).
// supabase-js reads the session back from storage for every request. A
// SecureStore write that failed (swallowed) or hung used to leave the client
// without a session right after a successful sign-in, so every query ran
// anonymously. Now:
// - writes land in memory at once and are persisted in the background;
// - persistence always writes a key's LATEST value (so a later sign-out's
//   delete can't be overtaken by an older write) and every SecureStore call
//   has a time limit, so one hung call can't stall later ones; a failed or
//   timed-out call is retried a few times with the then-latest value;
// - a call that timed out but lands later triggers a rewrite of the latest
//   value, so it can't leave stale data behind;
// - a cold-start read has a time limit too (treated as "no session").
export const SECURE_STORE_TIMEOUT_MS = 3_000;
export const SECURE_STORE_RETRIES = 3;
const SECURE_STORE_RETRY_DELAY_MS = 2_000;

function bounded<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('SecureStore timed out')),
      SECURE_STORE_TIMEOUT_MS
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

const memory = new Map<string, string | null>();
const dirty = new Set<string>();
const failures = new Map<string, number>();
let flushing = false;

function schedulePersist(key: string) {
  dirty.add(key);
  if (!flushing) void flush();
}

async function flush() {
  flushing = true;
  try {
    while (dirty.size > 0) {
      const key = dirty.values().next().value as string;
      dirty.delete(key);
      const value = memory.get(key) ?? null;
      const op =
        value === null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value);
      try {
        await bounded(op);
        failures.delete(key);
      } catch (e) {
        // A timed-out call is not cancelled and may still land later, after
        // newer writes (e.g. an old session written back over a sign-out).
        // When it settles, write the then-latest value again.
        op.then(
          () => schedulePersist(key),
          () => {}
        );
        console.warn('SecureStore write failed:', e);
        const n = (failures.get(key) ?? 0) + 1;
        failures.set(key, n);
        if (n <= SECURE_STORE_RETRIES) {
          setTimeout(() => schedulePersist(key), SECURE_STORE_RETRY_DELAY_MS);
        }
      }
    }
  } finally {
    flushing = false;
  }
}

export const secureStoreAdapter = {
  getItem: async (key: string) => {
    if (memory.has(key)) return memory.get(key) ?? null;
    try {
      const value = await bounded(SecureStore.getItemAsync(key));
      if (!memory.has(key)) memory.set(key, value); // a newer write wins
      return memory.get(key) ?? null;
    } catch (e) {
      console.warn('SecureStore.getItemAsync failed:', e);
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    memory.set(key, value);
    failures.delete(key);
    schedulePersist(key);
  },
  removeItem: async (key: string) => {
    memory.set(key, null);
    failures.delete(key);
    schedulePersist(key);
  },
};

// Environment variables (accessed via Constants.expoConfig.extra for React Native)
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || '';
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || '';

// Validate environment variables — fail fast so missing config is never silent
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
  throw new Error(
    'Missing Supabase environment variables. Ensure .env file exists and Metro bundler is restarted.'
  );
}

// Create typed Supabase client with encrypted session storage
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: secureStoreAdapter,
  },
  // CT7-068: no request may hang forever (Android fetch has no timeout)
  global: { fetch: createFetchWithTimeout() },
});

/**
 * CT7-067: remove this device's session without any network call.
 * `auth.signOut({ scope: 'local' })` first calls the logout endpoint and, if
 * that fails (offline, 5xx), returns `{ error }` WITHOUT removing the stored
 * session. Clearing storage first makes the signOut that follows purely
 * local (no access token left to send); it still stops the refresh timer and
 * emits SIGNED_OUT.
 */
export async function clearLocalSession(): Promise<void> {
  const key: string | undefined = (supabase.auth as unknown as { storageKey?: string }).storageKey;
  if (key) await secureStoreAdapter.removeItem(key);
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  PROPERTY_IMAGES: 'property-images',
  MAINTENANCE_MEDIA: 'maintenance-media',
  DOCUMENTS: 'documents',
  CONTRACTS: 'contracts',
  INSPECTION_PHOTOS: 'inspection-photos',
  MESSAGE_ATTACHMENTS: 'message-attachments',
  PROFILES: 'profiles',
  ID_DOCUMENTS: 'id-documents',
  PROOF_OF_INCOME: 'proof-of-income',
  SIGNATURES: 'signatures',
} as const;

// Helper type exports for cleaner code
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

// Convenience type aliases for commonly used tables
export type Property = Tables<'properties'>;
export type PropertyInsert = InsertTables<'properties'>;
export type PropertyUpdate = UpdateTables<'properties'>;

export type Lease = Tables<'leases'>;
export type LeaseInsert = InsertTables<'leases'>;
export type LeaseUpdate = UpdateTables<'leases'>;

export type Payment = Tables<'payments'>;
export type PaymentInsert = InsertTables<'payments'>;

export type RentalApplication = Tables<'rental_applications'>;
export type RentalApplicationInsert = InsertTables<'rental_applications'>;

export type Inspection = Tables<'inspections'>;
export type InspectionInsert = InsertTables<'inspections'>;

export type Message = Tables<'messages'>;
export type MessageThread = Tables<'message_threads'>;

export type Document = Tables<'documents'>;
export type DocumentInsert = InsertTables<'documents'>;

// Enum types
export type PropertyStatus = Enums<'property_status'>;
export type UserRole = Enums<'user_role'>;

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return !!session;
};

// Helper function to get current user
export const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

// Helper function to get current user's profile
export const getCurrentUserProfile = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  if (error) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return data;
};

// Storage helper functions
export const uploadFile = async (
  bucket: keyof typeof STORAGE_BUCKETS,
  path: string,
  file: Blob | File,
  options?: { contentType?: string; cacheControl?: string }
) => {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKETS[bucket]).upload(path, file, {
    contentType: options?.contentType,
    cacheControl: options?.cacheControl || '3600',
    upsert: false,
  });

  if (error) throw error;
  return data;
};

export const getPublicUrl = (bucket: keyof typeof STORAGE_BUCKETS, path: string) => {
  const { data } = supabase.storage.from(STORAGE_BUCKETS[bucket]).getPublicUrl(path);

  return data.publicUrl;
};

export const deleteFile = async (bucket: keyof typeof STORAGE_BUCKETS, path: string) => {
  const { error } = await supabase.storage.from(STORAGE_BUCKETS[bucket]).remove([path]);

  if (error) throw error;
};
