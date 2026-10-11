import type { CapacitorConfig } from '@capacitor/cli';

/** Android verzia hry (Capacitor). APK sa zostavuje v GitHub Actions – pozri docs/TECH.md. */
const config: CapacitorConfig = {
  appId: 'sk.meowambulance.app',
  appName: 'Meow Ambulance',
  webDir: 'dist',
  android: {
    backgroundColor: '#2b2533',
    // Android 15+: hra nezasahuje pod výrez kamery (lišty sú skryté – MainActivity)
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
