import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trueruff.monk',
  appName: 'Монах',
  webDir: 'dist',
  backgroundColor: '#0d0e10',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#D8A94F',
    },
  },
};

export default config;
