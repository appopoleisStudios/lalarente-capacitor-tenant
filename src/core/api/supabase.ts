import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓' : '✗');
  console.error('Constants.expoConfig?.extra:', Constants.expoConfig?.extra);
  // Don't throw - let the app start so we can see the error logs
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: undefined, // Will use AsyncStorage via expo-secure-store later
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
