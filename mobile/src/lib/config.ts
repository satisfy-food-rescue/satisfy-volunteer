import Constants from "expo-constants";

/** Where the API lives. Release builds set EXPO_PUBLIC_API_URL. In
 *  development the Next.js server runs on the machine serving Metro, so the
 *  app reuses Metro's host: that works in a simulator, an emulator and on a
 *  phone on the same network alike. */
export function resolveApiUrl(configured: string | undefined, metroHostUri: string | undefined): string {
  if (configured) return configured.replace(/\/+$/, "");
  const host = metroHostUri?.replace(/^[a-z]+:\/\//, "").split(/[:/]/)[0];
  return `http://${host || "localhost"}:3000`;
}

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, Constants.expoConfig?.hostUri);
