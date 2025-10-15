import { createClient } from '@supabase/supabase-js';
import { Database } from '@/src/types/database.types';

// TODO: Add these to .env
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Storage bucket names
export const STORAGE_BUCKETS = {
  PROPERTY_IMAGES: 'property-images',
  DOCUMENTS: 'documents',
  CONTRACTS: 'contracts',
} as const;
