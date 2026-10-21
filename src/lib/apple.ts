import "server-only";
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import { normaliseEmail } from "./domain";
import { appOrigin, env } from "./env";
import { NATIVE_APP_ID } from "./native-app";
import { OAuthError, checkCallback, exchangeCode, pkceChallenge, startRoundTrip, type RoundTrip } from "./oauth";

// Sign in with Apple. The website (and the Android app, in the system
// browser) uses Apple's authorization code flow with the Services ID as the
// client; the iOS app signs in natively and sends the identity token Apple
// gave it, whose audience is the app's bundle id. Either way the ID token is
// checked against Apple's published keys, and its nonce ties it to this
// sign-in. Apple's `sub` is the same for the website and the app, since both
// belong to one team.
//
// Apple lets people hide their address behind a relay
// (...@privaterelay.appleid.com), which matches no volunteer. They sign in
// another way once and connect Apple in Sign-in and security; from then on the
// `sub` is enough.

export const APPLE = "apple";

const ISSUER = "https://appleid.apple.com";
const AUTHORIZE_URL = `${ISSUER}/auth/authorize`;
const TOKEN_URL = `${ISSUER}/auth/token`;
const appleKeys = createRemoteJWKSet(new URL(`${ISSUER}/auth/keys`));

export type AppleIdentity = {
  sub: string;
  /** Absent if Apple left it out; a relay address if they chose Hide My Email. */
  email: string | null;
  emailVerified: boolean;
  /** The address is an Apple relay (Hide My Email). */
  privateEmail: boolean;
};

export function appleRedirectUri() {
  return `${appOrigin()}/auth/apple/callback`;
}

function credentials() {
  const { APPLE_TEAM_ID: teamId, APPLE_SERVICES_ID: servicesId, APPLE_KEY_ID: keyId, APPLE_PRIVATE_KEY: privateKey } = env();
  if (!teamId || !servicesId || !keyId || !privateKey) throw new Error("Sign in with Apple is not configured.");
  return { teamId, servicesId, keyId, privateKey };
}

/** Apple's client secret is a short-lived JWT signed with the team's Sign in
 *  with Apple key, made fresh for each code exchange. */
async function clientSecret(): Promise<string> {
  const { teamId, servicesId, keyId, privateKey } = credentials();
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setSubject(servicesId)
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(await importPKCS8(privateKey, "ES256"));
}

/** Starts the round trip and returns Apple's authorization URL. Asking for
 *  the email makes Apple answer with a form POST. The name is not asked for:
 *  Apple sign-in never creates an account. */
export async function startAppleSignIn(next: string | null, appChallenge: string | null): Promise<URL> {
  const { servicesId } = credentials();
  const { state, verifier } = await startRoundTrip(APPLE, next, appChallenge);
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    response_type: "code",
    response_mode: "form_post",
    client_id: servicesId,
    redirect_uri: appleRedirectUri(),
    scope: "email",
    state,
    nonce: pkceChallenge(verifier),
  }).toString();
  return url;
}

/** Checks state, exchanges the code and verifies the ID token and its
 *  nonce. */
export async function finishAppleSignIn(search: URLSearchParams, trip: RoundTrip): Promise<AppleIdentity> {
  const { code, verifier } = checkCallback(search, trip);
  const { servicesId } = credentials();
  const idToken = await exchangeCode(
    TOKEN_URL,
    { code, redirect_uri: appleRedirectUri(), client_id: servicesId, client_secret: await clientSecret() },
    "apple",
  );
  return verifyAppleIdToken(idToken, { audience: servicesId, nonce: pkceChallenge(verifier) });
}

/** The iOS app's native sign-in: the identity token Apple gave the app, and
 *  the nonce whose S256 hash the app asked Apple to put in it. */
export function verifyNativeAppleSignIn(identityToken: string, nonce: string, keys: JWTVerifyGetKey = appleKeys): Promise<AppleIdentity> {
  return verifyAppleIdToken(identityToken, { audience: NATIVE_APP_ID, nonce: pkceChallenge(nonce) }, keys);
}

// Apple sends booleans as either true or "true".
const boolish = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);

const Claims = z.object({
  sub: z.string().min(1),
  nonce: z.string(),
  email: z.email().optional(),
  email_verified: boolish.optional(),
  is_private_email: boolish.optional(),
});

const RELAY_DOMAIN = "@privaterelay.appleid.com";

export function isAppleRelay(email: string | null): boolean {
  return Boolean(email?.endsWith(RELAY_DOMAIN));
}

export async function verifyAppleIdToken(
  idToken: string,
  expected: { audience: string; nonce: string },
  keys: JWTVerifyGetKey = appleKeys,
): Promise<AppleIdentity> {
  let payload: unknown;
  try {
    ({ payload } = await jwtVerify(idToken, keys, { issuer: ISSUER, audience: expected.audience, algorithms: ["RS256"] }));
  } catch (err) {
    console.error("[apple] ID token rejected", err);
    throw new OAuthError("invalid_claims");
  }
  const parsed = Claims.safeParse(payload);
  if (!parsed.success || parsed.data.nonce !== expected.nonce) throw new OAuthError("invalid_claims");
  const email = parsed.data.email ? normaliseEmail(parsed.data.email) : null;
  return {
    sub: parsed.data.sub,
    email,
    emailVerified: parsed.data.email_verified ?? false,
    privateEmail: (parsed.data.is_private_email ?? false) || isAppleRelay(email),
  };
}

// Server-to-server notifications ----------------------------------------------
//
// Apple tells us when someone stops using Sign in with Apple with Satisfy,
// deletes their Apple Account, or turns their relay address off or on.
// Configured on the App ID in the Apple Developer portal; see DEPLOY.md.

export type AppleEvent = {
  type: "consent-revoked" | "account-delete" | "email-disabled" | "email-enabled";
  sub: string;
  /** For the email events: the relay address turned off or on. */
  email: string | null;
};

const Event = z.object({
  type: z.enum(["consent-revoked", "account-delete", "email-disabled", "email-enabled"]),
  sub: z.string().min(1),
  email: z.email().optional(),
});

/** Verifies a notification's signed payload and returns its event, or null
 *  for one we do not act on. Throws OAuthError("invalid_claims") if it is not
 *  from Apple, for us. */
export async function readAppleNotification(signedPayload: string, keys: JWTVerifyGetKey = appleKeys): Promise<AppleEvent | null> {
  // The audience is whichever client the notification is about: the
  // website's Services ID or the app's bundle id.
  const audience = [NATIVE_APP_ID, env().APPLE_SERVICES_ID].filter((a): a is string => Boolean(a));
  let payload: { events?: unknown };
  try {
    ({ payload } = await jwtVerify(signedPayload, keys, { issuer: ISSUER, audience, algorithms: ["RS256"] }));
  } catch (err) {
    console.error("[apple] notification rejected", err);
    throw new OAuthError("invalid_claims");
  }
  let events: unknown = payload.events;
  if (typeof events === "string") {
    try {
      events = JSON.parse(events);
    } catch {
      return null;
    }
  }
  const parsed = Event.safeParse(events);
  if (!parsed.success) return null;
  const { type, sub, email } = parsed.data;
  return { type, sub, email: email ? normaliseEmail(email) : null };
}
