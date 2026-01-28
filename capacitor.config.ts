import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ecoplate.app',
  appName: 'EcoPlate',
  webDir: 'backend/public',
  server: {
    androidScheme: 'https'
  }
};

export default config;