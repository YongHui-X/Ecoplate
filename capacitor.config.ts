import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecoplate.app',
  appName: 'EcoPlate',
  webDir: 'backend/public',
  server: {
    androidScheme: 'https',
    allowNavigation: ['18.143.173.20']
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
