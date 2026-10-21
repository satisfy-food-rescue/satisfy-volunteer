import type { ExpoConfig } from "expo/config";
import { AndroidConfig, withAndroidStyles, type ConfigPlugin } from "expo/config-plugins";

// The Expo project (EAS builds, push tokens, OTA updates). Not a secret.
const projectId = "e8a98cba-bf1c-44a2-a796-7513d0de96b0";

const TEAL = "#106379";

// Passkeys are shared with the website, so iOS needs to know the app may use
// the site's credentials. The site serves the matching
// apple-app-site-association (it needs APPLE_TEAM_ID set). Only for an HTTPS
// API: development against a local server has no passkeys.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const webHost = apiUrl?.startsWith("https://") ? new URL(apiUrl).host : null;

// Android 15 and later lay out a TextView by its glyphs' drawn bounds once an
// app targets SDK 35 (TextView#setUseBoundsForWidth), but React Native still
// measures text by advance width. Where a glyph draws past its advance, as
// Montserrat's often do, shrink-wrapped text no longer fits the box it was
// measured for: the last word wraps onto a second line the box clips ("All
// done" showed "All"). Drawing by advance width again matches the measurement.
// The style extends AppCompat's own TextView style, which AppTheme otherwise
// uses.
const TEXT_VIEW_STYLE = { name: "AppTextView", parent: "Widget.AppCompat.TextView" };

const withTextMeasuredByAdvance: ConfigPlugin = (config) =>
  withAndroidStyles(config, (config) => {
    let xml = AndroidConfig.Styles.assignStylesValue(config.modResults, {
      add: true,
      parent: TEXT_VIEW_STYLE,
      name: "android:useBoundsForWidth",
      value: "false",
      targetApi: "35",
    });
    xml = AndroidConfig.Styles.assignStylesValue(xml, {
      add: true,
      parent: AndroidConfig.Styles.getAppThemeGroup(),
      name: "android:textViewStyle",
      value: `@style/${TEXT_VIEW_STYLE.name}`,
    });
    config.modResults = xml;
    return config;
  });

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
    // Sign in with Apple, natively. EAS turns the capability on for the App
    // ID when it syncs capabilities. Android signs in with Apple in the
    // system browser instead.
    usesAppleSignIn: true,
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
    "expo-apple-authentication",
    ["expo-notifications", { color: TEAL, defaultChannel: "default" }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: { eas: { projectId } },
  runtimeVersion: { policy: "appVersion" },
  updates: { url: `https://u.expo.dev/${projectId}` },
};

export default withTextMeasuredByAdvance(config);
