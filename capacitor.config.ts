import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tareeq.app',
  appName: 'Tareeq',
  webDir: 'dist',
  server: {
    url: 'https://tareeq-eg.vercel.app',
  },
  android: {
    backgroundColor: '#0D1B2A',
  },
  plugins: {
    FirebaseAuthentication: {
      providers: ["google.com"],
      skipNativeAuth: true,
      config: {
        google: {
          serverClientId: "725660784165-9dvgvdshg3epjbmnc83kaao80brakenh.apps.googleusercontent.com",
        },
      },
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;