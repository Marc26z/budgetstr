import type { CapacitorConfig } from '@capacitor/cli';

// budgetstr — Capacitor configuration for Android/iOS native builds.
//
// `appId` is the reverse-DNS bundle identifier and cannot be changed after
// publishing to an app store. Pick something stable up front.

const config: CapacitorConfig = {
  appId: 'wtf.shakespeare.budgetstr',
  appName: 'budgetstr',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  android: {
    // Disallow loading mixed-content (http:// inside https://).
    allowMixedContent: false,
    // Deep navy that matches the app theme — shown behind the web view
    // before first paint so the splash feels seamless.
    backgroundColor: '#0c1225',
  },
  ios: {
    backgroundColor: '#0c1225',
    // `never` prevents WKWebView from inset-adjusting scroll content — the
    // app handles safe-area insets itself in CSS via env(safe-area-inset-*).
    contentInset: 'never',
    // Custom URL scheme for deep-links (e.g. `budgetstr://…`) — match this
    // in your Info.plist CFBundleURLSchemes.
    scheme: 'budgetstr',
  },
  plugins: {
    SystemBars: {
      // Inject --safe-area-inset-* CSS variables on Android to work around
      // a Chromium bug (<140) where env(safe-area-inset-*) reports 0.
      insetsHandling: 'css',
    },
  },
};

export default config;
