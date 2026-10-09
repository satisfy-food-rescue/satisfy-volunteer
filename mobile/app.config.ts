import type { ExpoConfig } from "expo/config";

// Both come from EAS environment variables (`eas env:create`), so nothing
// deployment-specific is committed. EAS_PROJECT_ID links the app to its Expo
// project for push tokens and OTA updates; without it the app still runs in
// Expo Go and a simulator, minus push. EXPO_PUBLIC_API_URL is the server the
// app talks to; in development it defaults to the Metro host (src/lib/config.ts).
const projectId = process.env.EAS_PROJECT_ID;
const profile = process.env.EAS_BUILD_PROFILE;
if ((profile === "preview" || profile === "production") && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error(`EXPO_PUBLIC_API_URL must be set for the ${profile} build profile.`);
}

const TEAL = "#106379";

const config: ExpoConfig = {
  name: "Satisfy Volunteers",
  slug: "satisfy-volunteers",
  scheme: "satisfy",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/images/icon.png",
  ios: {
    bundleIdentifier: "nz.org.satisfyfoodrescue.volunteers",
    icon: "./assets/satisfy.icon",
    supportsTablet: false,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: "nz.org.satisfyfoodrescue.volunteers",
    adaptiveIcon: {
      backgroundColor: TEAL,
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        backgroundColor: TEAL,
        image: "./assets/images/splash-icon.png",
        imageWidth: 180,
        dark: { backgroundColor: TEAL, image: "./assets/images/splash-icon.png" },
      },
    ],
    "expo-secure-store",
    ["expo-notifications", { color: TEAL, defaultChannel: "default" }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  ...(projectId && {
    extra: { eas: { projectId } },
    runtimeVersion: { policy: "appVersion" },
    updates: { url: `https://u.expo.dev/${projectId}` },
  }),
};

export default config;
