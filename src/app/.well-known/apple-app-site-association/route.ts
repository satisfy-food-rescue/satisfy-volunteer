import { env } from "@/lib/env";
import { NATIVE_APP_ID } from "@/lib/native-app";

export const dynamic = "force-dynamic";

/** Tells iOS the native app may use this site's passkeys (the app declares
 *  webcredentials:<host> in its associated domains). Apple fetches it
 *  through its CDN, so it must be served over HTTPS without redirects. */
export function GET() {
  const { APPLE_TEAM_ID } = env();
  if (!APPLE_TEAM_ID) return new Response("Not found", { status: 404 });
  return Response.json({ webcredentials: { apps: [`${APPLE_TEAM_ID}.${NATIVE_APP_ID}`] } });
}
