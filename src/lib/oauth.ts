import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
import { normaliseEmail } from "./domain";
import { appOrigin, env } from "./env";

// Sign-in with an identity provider: the authorization code flow, talking to
// the provider's endpoints directly. The ID token's signature, issuer,
// audience and expiry are checked against the provider's published keys.
// State, a verifier, the post-sign-in destination and (for the native app)
// the app's own PKCE challenge ride in short-lived httpOnly cookies.
//
// The native app signs in through this same flow in the system browser
// (RFC 8252): one client per provider, one redirect URI, and the app never
// sees a provider's token. See src/lib/oauth-callback.ts. Google lives here;
// Apple, which also signs in natively on iOS, in src/lib/apple.ts.

const ROUND_TRIP_SECONDS = 10 * 60;

/** Thrown for any recoverable callback failure, with a stable reason code. */
export class OAuthError extends Error {
  constructor(public reason: "access_denied" | "invalid_request" | "state_mismatch" | "exchange_failed" | "invalid_claims") {
    super(reason);
    this.name = "OAuthError";
  }
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** The S256 PKCE challenge for a verifier (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/** A PKCE challenge as the native app sends it: 43 base64url characters. */
export const AppChallenge = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

// The round trip --------------------------------------------------------------
//
// Each provider keeps its own cookies, so starting one sign-in never spoils
// another in a second tab. The cookies are SameSite=Lax: Apple answers with a
// cross-site POST, which carries none of them (nor the session cookie), so its
// callback first redirects to itself as a GET (src/app/auth/apple/callback).

export type OAuthProvider = "google" | "apple";

const COOKIE_PREFIX: Record<OAuthProvider, string> = { google: "sfr_oauth", apple: "sfr_apple" };

export type RoundTrip = {
  state: string | null;
  /** Google's PKCE verifier. Apple's ID token carries its S256 hash as the
   *  nonce instead. */
  verifier: string | null;
  next: string | null;
  /** Set when the native app started the round trip. */
  appChallenge: string | null;
};

const COOKIE_SUFFIX: Record<keyof RoundTrip, string> = { state: "state", verifier: "verifier", next: "next", appChallenge: "app" };

/** Sets the round-trip cookies and returns the fresh state and verifier.
 *  `appChallenge` is set when the native app opened this in the system
 *  browser: the callback then hands the app a one-time code bound to that
 *  challenge instead of signing the browser in. */
export async function startRoundTrip(
  provider: OAuthProvider,
  next: string | null,
  appChallenge: string | null,
): Promise<{ state: string; verifier: string }> {
  const state = randomToken();
  const verifier = randomToken();
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: ROUND_TRIP_SECONDS };
  const values: RoundTrip = { state, verifier, next, appChallenge };
  for (const field of Object.keys(values) as (keyof RoundTrip)[]) {
    const name = `${COOKIE_PREFIX[provider]}_${COOKIE_SUFFIX[field]}`;
    const value = values[field];
    if (value) jar.set(name, value, opts);
    else jar.delete(name);
  }
  return { state, verifier };
}

/** Reads and clears the round-trip cookies. Called first by the callback so
 *  it knows where to send failures, whatever happens next. */
export async function takeRoundTrip(provider: OAuthProvider): Promise<RoundTrip> {
  const jar = await cookies();
  const read = (field: keyof RoundTrip) => {
    const name = `${COOKIE_PREFIX[provider]}_${COOKIE_SUFFIX[field]}`;
    const value = jar.get(name)?.value ?? null;
    jar.delete(name);
    return value;
  };
  return { state: read("state"), verifier: read("verifier"), next: read("next"), appChallenge: read("appChallenge") };
}

/** The provider's answer, checked against the round trip: state is the CSRF
 *  check, for an error as much as for a code. */
export function checkCallback(search: URLSearchParams, trip: RoundTrip): { code: string; verifier: string } {
  const code = search.get("code");
  const state = search.get("state");
  if (search.get("error")) {
    if (state && state !== trip.state) throw new OAuthError("state_mismatch");
    throw new OAuthError("access_denied");
  }
  if (!code || !state || !trip.state || !trip.verifier) throw new OAuthError("invalid_request");
  if (state !== trip.state) throw new OAuthError("state_mismatch");
  return { code, verifier: trip.verifier };
}

/** Swaps an authorization code for the provider's ID token. */
export async function exchangeCode(tokenUrl: string, body: Record<string, string>, log: string): Promise<string> {
  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", ...body }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { id_token?: unknown; error?: unknown };
    if (!res.ok || typeof json.id_token !== "string") throw new Error(`token endpoint ${res.status}: ${String(json.error)}`);
    return json.id_token;
  } catch (err) {
    console.error(`[${log}] code exchange failed`, err);
    throw new OAuthError("exchange_failed");
  }
}

// Google ----------------------------------------------------------------------

export const GOOGLE = "google";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export function googleRedirectUri() {
  return `${appOrigin()}/auth/google/callback`;
}

function googleCredentials() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = env();
  if (!id || !secret) throw new Error("Google sign-in is not configured.");
  return { id, secret };
}

/** Starts the round trip and returns Google's authorization URL. */
export async function startGoogleSignIn(next: string | null, appChallenge: string | null): Promise<URL> {
  const { id } = googleCredentials();
  const { state, verifier } = await startRoundTrip(GOOGLE, next, appChallenge);
  const url = new URL(GOOGLE_AUTHORIZE_URL);
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
  return url;
}

const GoogleClaims = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional().default(false),
});

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean };

/** Checks state, exchanges the code with the PKCE verifier and verifies the
 *  ID token. */
export async function finishGoogleSignIn(search: URLSearchParams, trip: RoundTrip): Promise<GoogleIdentity> {
  const { code, verifier } = checkCallback(search, trip);
  const { id, secret } = googleCredentials();
  const idToken = await exchangeCode(
    GOOGLE_TOKEN_URL,
    { code, code_verifier: verifier, redirect_uri: googleRedirectUri(), client_id: id, client_secret: secret },
    "google",
  );
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(idToken, googleKeys, { issuer: GOOGLE_ISSUERS, audience: id }));
  } catch (err) {
    console.error("[google] ID token rejected", err);
    throw new OAuthError("invalid_claims");
  }
  const parsed = GoogleClaims.safeParse(payload);
  if (!parsed.success) throw new OAuthError("invalid_claims");
  return { sub: parsed.data.sub, email: normaliseEmail(parsed.data.email), emailVerified: parsed.data.email_verified };
}
