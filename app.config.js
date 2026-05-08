module.exports = ({ config }) => {
  return {
    ...config,
    name: "Lalarente",
    slug: "lalarente-app",
    version: "1.0.2",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "lalarenteapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    owner: "oxii",
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      agentUrl: process.env.EXPO_PUBLIC_AGENT_URL,
      router: {},
      eas: {
        projectId: "25439f9c-1f86-4ae3-a4f1-a724ab57cbfc"
      }
    },
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      buildNumber: "3",
      bundleIdentifier: "com.lalarente.app",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs access to your location to help you find properties nearby."
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "AIzaSyDbwTaFT7cQJIEPKQpvr160QoBXkqVyM9U"
      }
    },
    android: {
      versionCode: 3,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.lalarente.app",
      edgeToEdgeEnabled: true,
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
