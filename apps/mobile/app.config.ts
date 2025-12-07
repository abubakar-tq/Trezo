import "dotenv/config";
import type { ExpoConfig } from "expo/config";

const extra = {
  eas: {
    projectId: "95fc18a7-8bfb-45e5-a51d-bc853f9ca1e0"
  },
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? "trezo.app",
  passkeyRpName: process.env.EXPO_PUBLIC_PASSKEY_RP_NAME ?? "Trezo Wallet",
};

const config: ExpoConfig = {
  name: "Trezo_Wallet",
  slug: "Trezo_Wallet",
  owner: "bakar00009",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "trezowallet",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.trezo.wallet",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSFaceIDUsageDescription: "Trezo Wallet uses Face ID to securely unlock your wallet and authenticate transactions.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.trezo.wallet", // set your Android applicationId
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    [
      "expo-local-authentication",
      {
        faceIDPermission: "Allow Trezo Wallet to use Face ID for secure authentication."
      }
    ],
    "expo-web-browser",
  ],
  experiments: {
    reactCompiler: true,
  },
  extra,
};

export default config;
