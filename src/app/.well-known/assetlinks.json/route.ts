import { env } from "@/lib/env";
import { NATIVE_APP_ID } from "@/lib/native-app";

export const dynamic = "force-dynamic";

/** Tells Android the native app may use this site's passkeys, for each of its
 *  signing certificates (the upload key and Google Play's app signing key). */
export function GET() {
  const fingerprints = env().ANDROID_CERT_FINGERPRINTS;
  if (fingerprints.length === 0) return Response.json([]);
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls", "delegate_permission/common.get_login_creds"],
      target: { namespace: "android_app", package_name: NATIVE_APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
