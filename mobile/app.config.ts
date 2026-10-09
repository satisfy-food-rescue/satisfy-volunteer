import type { ExpoConfig } from "expo/config";

// The Expo project (EAS builds, push tokens, OTA updates). Not a secret.
const projectId = "e8a98cba-bf1c-44a2-a796-7513d0de96b0";

// The server the app talks to comes from an EAS environment variable
// (`eas env:create`); in development it defaults to the Metro host
// (src/lib/config.ts). A release build (EAS_BUILD_PROFILE) or OTA update
// (RELEASE_CHANNEL, set by the update:* scripts) without it would point every
// installed app at localhost, so refuse.
const release = process.env.EAS_BUILD_PROFILE ?? process.env.RELEASE_CHANNEL;
if (release && release !== "development" && !process.env.EXPO_PUBLIC_API_URL) {
  throw new Error(`EXPO_PUBLIC_API_URL must be set for ${release}. Add it with \`eas env:create\` (see README).`);
}

const TEAL = "#106379";

const config: ExpoConfig = {
  name: "Satisfy Volunteers",
  slug: "satisfy-volunteers",
  owner: "malinmw",
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
  extra: { eas: { projectId } },
  runtimeVersion: { policy: "appVersion" },
  updates: { url: `https://u.expo.dev/${projectId}` },
};

export default config;
