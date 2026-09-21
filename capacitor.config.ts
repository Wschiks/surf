import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the built web game (dist/) as a phone app. See README, "Phone app".
const config: CapacitorConfig = {
  appId: 'com.example.surftycoon',
  appName: 'Surf Tycoon',
  webDir: 'dist',
  backgroundColor: '#0b5d8a',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false },
};

export default config;
