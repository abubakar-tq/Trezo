import "dotenv/config";
import { withAppBuildGradle } from "@expo/config-plugins";
import type { ExpoConfig } from "expo/config";

const extra = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_OVERRIDE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_OVERRIDE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
  passkeyRpId: process.env.EXPO_PUBLIC_PASSKEY_RP_ID ?? "trezo.app",
  passkeyRpName: process.env.EXPO_PUBLIC_PASSKEY_RP_NAME ?? "Trezo Wallet",
  eas: {
    projectId: "7c6127fd-2254-4834-907e-9db320c2d7d7"
  }
};

// In a monorepo the RN Gradle plugin passes `--entry-file index.js` (a
// relative path) to Expo CLI, but Expo CLI can detect the workspace root
// as its projectRoot instead of apps/mobile.  Metro then looks for
// index.js at the workspace root and fails.  Passing the absolute path
// via extraPackagerArgs forces Metro to use the right file regardless of
// where Expo CLI thinks the project root is.
const withAbsoluteEntryFile = (config: ExpoConfig): ExpoConfig =>
  withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes("evaluatedEntryFile")) {
      return mod;
    }
    mod.modResults.contents = mod.modResults.contents.replace(
      /( +)entryFile = (file\([^\n]+\))/,
      [
        "$1def evaluatedEntryFile = $2",
        "$1entryFile = evaluatedEntryFile",
        '$1extraPackagerArgs = ["--entry-file", evaluatedEntryFile.absolutePath]',
      ].join("\n"),
    );
    return mod;
  });

const config: ExpoConfig = {
  name: "Trezo",
  slug: "trezo",
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
      backgroundColor: "#050505",
      foregroundImage: "./assets/images/adaptive-icon.png",
    },
    icon: "./assets/images/icon.png",
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: "com.trezo.wallet", // set your Android applicationId
    googleServicesFile: "./google-services.json",
  },
  web: {
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    [
      "expo-splash-screen",
      {
        image: "./assets/images/icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#050505",
        dark: {
          image: "./assets/images/icon.png",
          backgroundColor: "#050505",
        },
      },
    ],
    [
      "expo-local-authentication",
      {
        faceIDPermission: "Allow Trezo Wallet to use Face ID for secure authentication."
      }
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/images/notification-icon.png",
        color: "#050505",
        defaultChannel: "default",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Allow Trezo Wallet to use the camera to scan pairing QR codes from a trusted device.",
      },
    ],
    "expo-web-browser",
  ],
  experiments: {
    reactCompiler: true,
  },
  extra,
};

export default withAbsoluteEntryFile(config);
