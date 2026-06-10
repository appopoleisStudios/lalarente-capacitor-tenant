module.exports = ({ config }) => {
  return {
    ...config,
    name: "lalarente-app",
    slug: "lalarente-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "lalarenteapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    owner: "arsalanahmed82",
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      router: {},
      eas: {
        projectId: "616e56ad-07ff-4f94-b0ef-a8f778468a92"
      }
    },
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.lalarente.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs access to your location to help you find properties nearby."
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDbwTaFT7cQJIEPKQpvr160QoBXkqVyM9U"
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.lalarente.app",
      edgeToEdgeEnabled: true,
      softwareKeyboardLayoutMode: "resize",
      predictiveBackGestureEnabled: false,
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDbwTaFT7cQJIEPKQpvr160QoBXkqVyM9U"
        }
      }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router"
    ],
    experiments: {
      typedRoutes: true
    }
  };
};
