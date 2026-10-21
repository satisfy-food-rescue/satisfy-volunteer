import "server-only";
import type { Volunteer } from "@/generated/prisma/client";
import { postSignInPath } from "./auth-shared";
import { finishAppleSignIn, isAppleRelay } from "./apple";
import { appRedirect, issueAppSignInCode } from "./mobile-auth";
import { OAuthError, finishGoogleSignIn, takeRoundTrip, type OAuthProvider, type RoundTrip } from "./oauth";
import { createSession, currentUser } from "./session";
import { connectApple, connectGoogle, signInWithApple, signInWithGoogle, type SignedIn } from "./sign-in";

type Identified = {
  /** The address to name in "we could not find a volunteer account for",
   *  never an Apple relay address. */
  email: string | null;
  signIn: () => Promise<SignedIn | { ok: false; reason: string }>;
  connect: (me: Volunteer) => Promise<string>;
};

async function identify(provider: OAuthProvider, search: URLSearchParams, trip: RoundTrip): Promise<Identified> {
  if (provider === "google") {
    const identity = await finishGoogleSignIn(search, trip);
    return { email: identity.email, signIn: () => signInWithGoogle(identity), connect: (me) => connectGoogle(me, identity) };
  }
  const identity = await finishAppleSignIn(search, trip);
  return {
    email: identity.email && !isAppleRelay(identity.email) ? identity.email : null,
    signIn: () => signInWithApple(identity),
    connect: (me) => connectApple(me, identity),
  };
}

function securityPath(role: "ADMIN" | "VOLUNTEER") {
  return role === "ADMIN" ? "/admin/security" : "/app/security";
}

/**
 * Turns a provider's answer into a destination, for /auth/google/callback and
 * /auth/apple/callback alike.
 *  - The native app started it: hand the app a one-time code (it redeems it
 *    with its PKCE verifier at /api/mobile/auth/<provider>). The browser
 *    itself is never signed in.
 *  - Someone is signed in: link the identity to their account ("Connect").
 *  - Otherwise: sign in, following the shared rules in src/lib/sign-in.ts.
 */
export async function oauthCallbackDestination(provider: OAuthProvider, search: URLSearchParams): Promise<string> {
  const trip = await takeRoundTrip(provider);
  try {
    const { email, signIn, connect } = await identify(provider, search, trip);
    const refusal = (reason: string) => ({ error: reason, ...(reason === `${provider}_unknown` && email ? { email } : {}) });
    if (trip.appChallenge) {
      const result = await signIn();
      return result.ok ? appRedirect({ code: await issueAppSignInCode(result.volunteer.id, trip.appChallenge) }) : appRedirect(refusal(result.reason));
    }
    const me = await currentUser();
    if (me) {
      const outcome = await connect(me);
      return `${securityPath(me.role)}?${outcome === "connected" ? `${provider}=connected` : `error=${outcome}`}`;
    }
    const result = await signIn();
    if (!result.ok) return `/sign-in?${new URLSearchParams(refusal(result.reason)).toString()}`;
    await createSession(result.volunteer.id);
    return postSignInPath(result.volunteer.role, trip.next);
  } catch (err) {
    const reason = err instanceof OAuthError ? err.reason : "unknown";
    // Backing out at the provider is not a problem worth a stack trace.
    if (reason === "access_denied") console.info(`[${provider}] sign-in cancelled`);
    else console.error(`[${provider}] callback failed`, reason, err);
    const code = `${provider}_${reason === "access_denied" ? "cancelled" : "failed"}`;
    if (trip.appChallenge) return appRedirect({ error: code });
    // Someone connecting goes back to where they started, not to sign-in
    // (which would only send them on to their home page).
    const me = await currentUser().catch(() => null);
    return me ? `${securityPath(me.role)}?error=${code}` : `/sign-in?error=${code}`;
  }
}
