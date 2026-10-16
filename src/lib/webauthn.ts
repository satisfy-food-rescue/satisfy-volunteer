import "server-only";
import { cookies } from "next/headers";
import { db } from "./db";
import { env } from "./env";

// Passkey relying-party settings, derived from APP_URL so they cannot drift
// from where the app is served. rpID is the bare host (no scheme or port);
// the origin includes the port. localhost is a secure context, so passkeys
// work in development with no setup.
//
// The native app uses the same relying party, so one passkey works in both:
// iOS vouches for the app through apple-app-site-association and signs with
// the website's origin; Android vouches through assetlinks.json and signs
// with an origin naming the app's signing certificate.

export const RP_NAME = "Satisfy Volunteers";

export function rpID(): string {
  return new URL(env().APP_URL).hostname;
}

export function rpOrigin(): string {
  return new URL(env().APP_URL).origin;
}

/** The Android app's origin for a signing certificate fingerprint
 *  ("AB:CD:..."): "android:apk-key-hash:" and the certificate's SHA-256 in
 *  base64url. */
export function androidOrigin(fingerprint: string): string {
  return `android:apk-key-hash:${Buffer.from(fingerprint.replaceAll(":", ""), "hex").toString("base64url")}`;
}

/** Every origin a passkey response may come from: the website (and the iOS
 *  app, which uses it), plus each configured Android signing certificate. */
export function expectedOrigins(): string[] {
  return [rpOrigin(), ...env().ANDROID_CERT_FINGERPRINTS.map(androidOrigin)];
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

// The native app has no cookie jar for the challenge, so it is kept in the
// database and the app sends back its id.
const APP_CHALLENGE_TTL_MS = CHALLENGE_TTL_SECONDS * 1000;

export async function storeAppChallenge(kind: Ceremony, challenge: string, volunteerId: string | null): Promise<string> {
  const row = await db.passkeyChallenge.create({
    data: {
      ceremony: kind === "registration" ? "REGISTRATION" : "AUTHENTICATION",
      challenge,
      volunteerId,
      expiresAt: new Date(Date.now() + APP_CHALLENGE_TTL_MS),
    },
  });
  return row.id;
}

/** Consumes an app challenge: deleting it is the claim, so it answers once.
 *  A registration challenge only answers for the volunteer it was issued to. */
export async function takeAppChallenge(kind: Ceremony, id: string, volunteerId: string | null): Promise<string | null> {
  const ceremony = kind === "registration" ? "REGISTRATION" : "AUTHENTICATION";
  const row = await db.passkeyChallenge.findUnique({ where: { id } });
  if (!row || row.ceremony !== ceremony || row.volunteerId !== volunteerId) return null;
  const { count } = await db.passkeyChallenge.deleteMany({ where: { id } });
  if (count === 0 || row.expiresAt <= new Date()) return null;
  return row.challenge;
}

/** A readable default name for a new passkey, from the browser's user agent. */
export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? "";
  const device = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android phone" : /Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux computer" : "This device";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  return browser ? `${device} (${browser})` : device;
}
