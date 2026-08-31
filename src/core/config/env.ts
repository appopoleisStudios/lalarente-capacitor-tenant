import Constants from 'expo-constants';

export const env = {
  supabase: {
    url: Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey:
      Constants.expoConfig?.extra?.supabaseAnonKey ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      '',
  },
  sentry: {
    dsn: Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  },
  payfast: {
    merchantId: process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_ID || '',
    merchantKey: process.env.EXPO_PUBLIC_PAYFAST_MERCHANT_KEY || '',
    passphrase: process.env.EXPO_PUBLIC_PAYFAST_PASSPHRASE || '',
    sandbox: process.env.EXPO_PUBLIC_PAYFAST_SANDBOX !== 'false',
  },
  yoco: {
    publicKey: process.env.EXPO_PUBLIC_YOCO_PUBLIC_KEY || '',
    secretKey: process.env.EXPO_PUBLIC_YOCO_SECRET_KEY || '',
    sandbox: process.env.EXPO_PUBLIC_YOCO_SANDBOX === 'true',
  },
  googleMaps: {
    apiKey:
      Constants.expoConfig?.extra?.googleMapsApiKey ||
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
      '',
  },
  payments: {
    webhookBaseUrl:
      process.env.EXPO_PUBLIC_WEBHOOK_BASE_URL ||
      'https://vvepwaolnkzfzhzgxlwr.supabase.co/functions/v1',
  },
  isDev: __DEV__,
};

export const RELEASE_VERSION = Constants.expoConfig?.extra?.releaseVersion ?? 'dev';
