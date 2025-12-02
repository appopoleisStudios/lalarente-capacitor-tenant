import { createClient } from '@supabase/supabase-js';
import { Database } from '@/src/types/database.types';

// Environment variables (using Expo naming convention)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables!');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗');
}

// Create typed Supabase client
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Storage bucket names - UPDATED with all new buckets
export const STORAGE_BUCKETS = {
  // Property Management
  PROPERTY_IMAGES: 'property-images',

  // Maintenance
  MAINTENANCE_MEDIA: 'maintenance-media',

  // Documents
  DOCUMENTS: 'documents',
  CONTRACTS: 'contracts',

  // Rental Management (NEW)
  INSPECTION_PHOTOS: 'inspection-photos',        // From Task 1.8
  MESSAGE_ATTACHMENTS: 'message-attachments',    // From Task 1.9

  // User Profiles
  PROFILES: 'profiles',
  ID_DOCUMENTS: 'id-documents',                  // For rental applications
  PROOF_OF_INCOME: 'proof-of-income',           // For rental applications

  // Signatures
  SIGNATURES: 'signatures',                      // For lease & inspection signatures
} as const;

// Helper type exports for cleaner code
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

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
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
};

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper function to get current user's profile
export const getCurrentUserProfile = async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

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
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .upload(path, file, {
      contentType: options?.contentType,
      cacheControl: options?.cacheControl || '3600',
      upsert: false,
    });

  if (error) throw error;
  return data;
};

export const getPublicUrl = (
  bucket: keyof typeof STORAGE_BUCKETS,
  path: string
) => {
  const { data } = supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .getPublicUrl(path);

  return data.publicUrl;
};

export const deleteFile = async (
  bucket: keyof typeof STORAGE_BUCKETS,
  path: string
) => {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKETS[bucket])
    .remove([path]);

  if (error) throw error;
};
