import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carmasr.app',
  appName: 'كار مصر',
  webDir: 'dist',
  server: {
    url: 'https://carmasr-app.vercel.app',
  },
  android: {
    backgroundColor: '#0B1E3A',
  },
  plugins: {
    FirebaseAuthentication: {
      providers: ["google.com"],
      skipNativeAuth: true,
      config: {
        google: {
          serverClientId: "218607261985-eo1sstr3om7rqgbdovq04h2o4qsdmjlt.apps.googleusercontent.com",
        },
      },
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
