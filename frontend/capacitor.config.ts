import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecoplate.app',
  appName: 'EcoPlate',
  webDir: 'dist',
  server: {
    // For development, connect to local backend
    // Comment out for production builds
    url: 'http://10.0.2.2:5173',  // 10.0.2.2 is Android emulator's address for host machine
    cleartext: true,

    // NOTE: Android emulators can also use 10.0.2.2 as an alternative
    // iOS simulators require your actual local IP address
    // Find your IP: ipconfig getifaddr en0 (macOS) or ipconfig (Windows)
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#16a34a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#16a34a',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'EcoPlate',
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
