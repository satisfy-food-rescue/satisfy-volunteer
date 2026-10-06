import "server-only";
import { cookies } from "next/headers";
import { Google, decodeIdToken, generateCodeVerifier, generateState } from "arctic";
import { z } from "zod";
import { appOrigin, env } from "./env";

// Google sign-in: authorization code + PKCE through arctic. State, verifier
// and the post-sign-in destination ride in short-lived httpOnly cookies.

const STATE_COOKIE = "sfr_oauth_state";
const VERIFIER_COOKIE = "sfr_oauth_verifier";
const NEXT_COOKIE = "sfr_oauth_next";
const ROUND_TRIP_SECONDS = 10 * 60;

export const GOOGLE = "google";

export function googleRedirectUri() {
  return `${appOrigin()}/auth/google/callback`;
}

function client() {
  const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = env();
  if (!id || !secret) throw new Error("Google sign-in is not configured.");
  return new Google(id, secret, googleRedirectUri());
}

/** Thrown for any recoverable callback failure, with a stable reason code. */
export class OAuthError extends Error {
  constructor(public reason: "access_denied" | "invalid_request" | "state_mismatch" | "exchange_failed" | "invalid_claims") {
    super(reason);
    this.name = "OAuthError";
  }
}

export async function startGoogleSignIn(next: string | null): Promise<URL> {
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url = client().createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  url.searchParams.set("prompt", "select_account");
  const jar = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: ROUND_TRIP_SECONDS };
  jar.set(STATE_COOKIE, state, opts);
  jar.set(VERIFIER_COOKIE, verifier, opts);
  if (next) jar.set(NEXT_COOKIE, next, opts);
  else jar.delete(NEXT_COOKIE);
  return url;
}

const Claims = z.object({
  sub: z.string().min(1),
  email: z.email(),
  email_verified: z.boolean().optional().default(false),
});

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean };

/** Checks state (CSRF), exchanges the code and reads the ID token claims,
 *  which are trusted because they came straight from Google over TLS. The
 *  round-trip cookies are cleared whatever happens. */
export async function finishGoogleSignIn(search: URLSearchParams): Promise<{ identity: GoogleIdentity; next: string | null }> {
  const jar = await cookies();
  const storedState = jar.get(STATE_COOKIE)?.value;
  const verifier = jar.get(VERIFIER_COOKIE)?.value;
  const next = jar.get(NEXT_COOKIE)?.value ?? null;
  jar.delete(STATE_COOKIE);
  jar.delete(VERIFIER_COOKIE);
  jar.delete(NEXT_COOKIE);

  if (search.get("error")) throw new OAuthError("access_denied");
  const code = search.get("code");
  const state = search.get("state");
  if (!code || !state || !storedState || !verifier) throw new OAuthError("invalid_request");
  if (state !== storedState) throw new OAuthError("state_mismatch");

  let claims: unknown;
  try {
    const tokens = await client().validateAuthorizationCode(code, verifier);
    claims = decodeIdToken(tokens.idToken());
  } catch {
    throw new OAuthError("exchange_failed");
  }
  const parsed = Claims.safeParse(claims);
  if (!parsed.success) throw new OAuthError("invalid_claims");
  return {
    identity: { sub: parsed.data.sub, email: parsed.data.email.trim().toLowerCase(), emailVerified: parsed.data.email_verified },
    next,
  };
}
