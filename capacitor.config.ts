import type { CapacitorConfig } from '@capacitor/cli';

// Wraps the built web game (dist/) as a phone app. See docs/STORE-READINESS.md.
// The app id is the reverse of a domain name you control. Change it once here and run `npm run phone:id` to
// copy it into the Android and iOS projects.
const config: CapacitorConfig = {
  appId: 'com.wschiks.surftycoon',
  appName: 'Surf Tycoon',
  webDir: 'dist',
  backgroundColor: '#0b5d8a',
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
  android: { allowMixedContent: false, backgroundColor: '#0b5d8a' },
  server: { androidScheme: 'https' },
  plugins: { SplashScreen: { launchAutoHide: true, backgroundColor: '#0b5d8a', showSpinner: false } },
};

export default config;
