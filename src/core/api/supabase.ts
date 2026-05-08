import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const configuredSupabaseUrl = extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const configuredSupabaseAnonKey =
  extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const hasSupabaseConfig = Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey);

if (!hasSupabaseConfig) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('EXPO_PUBLIC_SUPABASE_URL:', configuredSupabaseUrl ? '✓' : '✗');
  console.error('EXPO_PUBLIC_SUPABASE_ANON_KEY:', configuredSupabaseAnonKey ? '✓' : '✗');
  console.error('Constants.expoConfig?.extra:', Constants.expoConfig?.extra);
  // Don't throw - let the app start so we can see the error logs
}

const supabaseUrl = hasSupabaseConfig ? configuredSupabaseUrl : 'https://placeholder.invalid';
const supabaseAnonKey = hasSupabaseConfig ? configuredSupabaseAnonKey : 'missing-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: undefined, // Will use AsyncStorage via expo-secure-store later
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
