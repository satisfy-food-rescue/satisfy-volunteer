// The native app's store identities. They differ because the iOS bundle id is
// taken on Google Play by another developer account. They cannot change after
// the first store upload.

/** ios.bundleIdentifier in mobile/app.config.ts: Sign in with Apple's audience
 *  and the app in apple-app-site-association. */
export const NATIVE_IOS_APP_ID = "nz.org.satisfyfoodrescue.volunteers";

/** android.package in mobile/app.config.ts: the app in assetlinks.json. */
export const NATIVE_ANDROID_PACKAGE = "nz.org.satisfyfoodrescue";
