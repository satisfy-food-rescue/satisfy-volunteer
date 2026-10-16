import type { ExpoConfig } from "expo/config";

// The Expo project (EAS builds, push tokens, OTA updates). Not a secret.
const projectId = "e8a98cba-bf1c-44a2-a796-7513d0de96b0";

const TEAL = "#106379";

// Passkeys are shared with the website, so iOS needs to know the app may use
// the site's credentials. The site serves the matching
// apple-app-site-association (it needs APPLE_TEAM_ID set). Only for an HTTPS
// API: development against a local server has no passkeys.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const webHost = apiUrl?.startsWith("https://") ? new URL(apiUrl).host : null;

const config: ExpoConfig = {
  // The label under the icon on the home screen. The store listings carry the
  // full "Satisfy Volunteers" name; that is set in App Store Connect and Play.
  name: "Satisfy",
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
    ...(webHost ? { associatedDomains: [`webcredentials:${webHost}`] } : {}),
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
