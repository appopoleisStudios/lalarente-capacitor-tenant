import Constants from 'expo-constants';

export const env = {
  supabase: {
    url: Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    anonKey: Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  sentry: {
    dsn: Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN || '',
  },
  payfast: {
    sandbox: process.env.EXPO_PUBLIC_PAYFAST_SANDBOX === 'true',
  },
  yoco: {
    publicKey: process.env.EXPO_PUBLIC_YOCO_PUBLIC_KEY || '',
    sandbox: process.env.EXPO_PUBLIC_YOCO_SANDBOX === 'true',
  },
  googleMaps: {
    apiKey: Constants.expoConfig?.extra?.googleMapsApiKey || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  },
  isDev: __DEV__,
};

export const RELEASE_VERSION =
  Constants.expoConfig?.extra?.releaseVersion ?? 'dev';

