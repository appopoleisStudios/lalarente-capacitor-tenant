import Constants from 'expo-constants';

export const env = {
  supabase: {
    url: Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  payfast: {
    merchantId: process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_ID || '',
    merchantKey: process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_KEY || '',
    passphrase: process.env.EXPO_PUBLIC_PAYFAST_PASSPHRASE || '',
    sandbox: process.env.EXPO_PUBLIC_PAYFAST_SANDBOX === 'true',
  },
  isDev: __DEV__,
};
