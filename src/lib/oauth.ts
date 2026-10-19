import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { normaliseEmail } from "./domain";
import { appOrigin, env } from "./env";

// Google sign-in: the authorization code flow with PKCE, talking to Google's
// endpoints directly. The ID token's signature, issuer, audience and expiry
// are checked against Google's published keys. State, the PKCE verifier, the
// post-sign-in destination and (for the native app) the app's own PKCE
// challenge ride in short-lived httpOnly cookies.
//
// The native app signs in through this same flow in the system browser
// (RFC 8252): one Google client, one redirect URI, and the app never sees a
// Google token. See src/app/auth/google/callback/route.ts.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

const STATE_COOKIE = "sfr_oauth_state";
const VERIFIER_COOKIE = "sfr_oauth_verifier";
const NEXT_COOKIE = "sfr_oauth_next";
const APP_COOKIE = "sfr_oauth_app";
const ROUND_TRIP_SECONDS = 10 * 60;

export const GOOGLE = "google";

export function googleRedirectUri() {
  return `${appOrigin()}/auth/google/callback`;
}

function credentials() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = env();
  if (!id || !secret) throw new Error("Google sign-in is not configured.");
  return { id, secret };
}

/** Thrown for any recoverable callback failure, with a stable reason code. */
export class OAuthError extends Error {
  constructor(public reason: "access_denied" | "invalid_request" | "state_mismatch" | "exchange_failed" | "invalid_claims") {
    super(reason);
    this.name = "OAuthError";
  }
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The S256 PKCE challenge for a verifier (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** A PKCE challenge as the native app sends it: 43 base64url characters. */
export const AppChallenge = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/** Starts the round trip. `appChallenge` is set when the native app opened
 *  this in the system browser: the callback then hands the app a one-time
 *  code bound to that challenge instead of signing the browser in. */
export async function startGoogleSignIn(next: string | null, appChallenge: string | null): Promise<URL> {
  const { id } = credentials();
  const state = randomToken();
  const verifier = randomToken();
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: id,
    redirect_uri: googleRedirectUri(),
    scope: "openid email",
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: ROUND_TRIP_SECONDS };
  jar.set(STATE_COOKIE, state, opts);
  jar.set(VERIFIER_COOKIE, verifier, opts);
  if (next) jar.set(NEXT_COOKIE, next, opts);
  else jar.delete(NEXT_COOKIE);
  if (appChallenge) jar.set(APP_COOKIE, appChallenge, opts);
  else jar.delete(APP_COOKIE);
  return url;
}

const Claims = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional().default(false),
});

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean };

export type GoogleRoundTrip = {
  next: string | null;
  /** Set when the native app started the round trip. */
  appChallenge: string | null;
};

/** Reads and clears the round-trip cookies. Called first by the callback so
 *  it knows where to send failures, whatever happens next. */
export async function takeGoogleRoundTrip(): Promise<GoogleRoundTrip & { state: string | null; verifier: string | null }> {
  const jar = await cookies();
  const read = (name: string) => {
    const value = jar.get(name)?.value ?? null;
    jar.delete(name);
    return value;
  };
  return { state: read(STATE_COOKIE), verifier: read(VERIFIER_COOKIE), next: read(NEXT_COOKIE), appChallenge: read(APP_COOKIE) };
}

/** Checks state (CSRF), exchanges the code with the PKCE verifier and
 *  verifies the ID token. */
export async function finishGoogleSignIn(
  search: URLSearchParams,
  trip: { state: string | null; verifier: string | null },
): Promise<GoogleIdentity> {
  if (search.get("error")) throw new OAuthError("access_denied");
  const code = search.get("code");
  const state = search.get("state");
  if (!code || !state || !trip.state || !trip.verifier) throw new OAuthError("invalid_request");
  if (state !== trip.state) throw new OAuthError("state_mismatch");

  const { id, secret } = credentials();
  let idToken: string;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier: trip.verifier,
        redirect_uri: googleRedirectUri(),
        client_id: id,
        client_secret: secret,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { id_token?: unknown; error?: unknown };
    if (!res.ok || typeof json.id_token !== "string") throw new Error(`token endpoint ${res.status}: ${String(json.error)}`);
    idToken = json.id_token;
  } catch (err) {
    console.error("[google] code exchange failed", err);
    throw new OAuthError("exchange_failed");
  }

  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, { issuer: ISSUERS, audience: id }));
  } catch (err) {
    console.error("[google] ID token rejected", err);
    throw new OAuthError("invalid_claims");
  }
  const parsed = Claims.safeParse(payload);
  if (!parsed.success) throw new OAuthError("invalid_claims");
  return { sub: parsed.data.sub, email: normaliseEmail(parsed.data.email), emailVerified: parsed.data.email_verified };
}
