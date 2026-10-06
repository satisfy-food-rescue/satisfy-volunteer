import "server-only";
import { cookies } from "next/headers";
import { env } from "./env";

// Passkey relying-party settings, derived from APP_URL so they cannot drift
// from where the app is served. rpID is the bare host (no scheme or port);
// the origin includes the port. localhost is a secure context, so passkeys
// work in development with no setup.

export const RP_NAME = "Satisfy Volunteers";

export function rpID(): string {
  return new URL(env().APP_URL).hostname;
}

export function rpOrigin(): string {
  return new URL(env().APP_URL).origin;
}

// The challenge the server generated must come back signed by the
// authenticator. It is kept in an httpOnly cookie and consumed once.
// Registration and sign-in use separate cookies so one ceremony cannot answer
// the other.
const CHALLENGE_COOKIE = { registration: "sfr_pk_reg", authentication: "sfr_pk_auth" } as const;
const CHALLENGE_TTL_SECONDS = 5 * 60;

export type Ceremony = keyof typeof CHALLENGE_COOKIE;

export async function storeChallenge(kind: Ceremony, challenge: string) {
  (await cookies()).set(CHALLENGE_COOKIE[kind], challenge, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
  });
}

export async function takeChallenge(kind: Ceremony): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(CHALLENGE_COOKIE[kind])?.value ?? null;
  if (value) jar.delete(CHALLENGE_COOKIE[kind]);
  return value;
}

/** A readable default name for a new passkey, from the browser's user agent. */
export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux computer" : "This device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  return browser ? `${device} (${browser})` : device;
}
