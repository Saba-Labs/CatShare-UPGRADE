import { CapacitorConfig } from '@capacitor/cli';
import dotenv from 'dotenv';

// Capacitor config runs in Node (cap sync/build), so load env files explicitly.
dotenv.config(); // .env
dotenv.config({ path: '.env.local', override: true });

const config: CapacitorConfig = {
  appId: 'com.catshare.official',
  appName: 'CatShare',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_launcher_foreground',
      iconColor: '#3b82f6',
      sound: 'notification',
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    StatusBar: {
      overlay: false,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      showSpinner: false,
      backgroundColor: '#ffffff',
    },
    FirebaseAnalytics: {
      // No extra config needed here, it reads from google-services.json
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      // Important: set this to your Google OAuth Web Client ID (same one used for Firebase Google sign-in)
      serverClientId: process.env.VITE_GOOGLE_WEB_CLIENT_ID,
      forceCodeForRefreshToken: false,
    },
  },
};

export default config;
