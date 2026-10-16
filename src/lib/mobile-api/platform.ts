import "server-only";
import { env } from "../env";

/** The native app says which platform it runs on, so the server can tell
 *  whether passkeys are set up for it: iOS needs the Apple team id in
 *  apple-app-site-association, Android the signing certificates in
 *  assetlinks.json. */
export function passkeysAvailableFor(request: Request): boolean {
  const platform = request.headers.get("x-platform");
  const e = env();
  if (platform === "ios") return Boolean(e.APPLE_TEAM_ID);
  if (platform === "android") return e.ANDROID_CERT_FINGERPRINTS.length > 0;
  return false;
}
