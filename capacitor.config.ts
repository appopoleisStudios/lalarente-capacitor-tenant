import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lalarente.app',
  appName: 'Lala Rente',
  webDir: 'out',
  server: {
    url: 'https://lalarente-app.vercel.app', // Your Vercel app domain
    androidScheme: 'https',
    cleartext: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#16a34a",
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#16a34a'
    },
    Keyboard: {
      resize: 'body',
      style: 'dark'
    }
  }
};

export default config;
