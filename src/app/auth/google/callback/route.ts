import { redirect } from "next/navigation";
import { postSignInPath } from "@/lib/auth-shared";
import { createSession, currentUser } from "@/lib/session";
import { OAuthError, finishGoogleSignIn, takeGoogleRoundTrip } from "@/lib/oauth";
import { connectGoogle, signInWithGoogle } from "@/lib/sign-in";
import { appRedirect, issueAppSignInCode } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

function securityPath(role: "ADMIN" | "VOLUNTEER") {
  return role === "ADMIN" ? "/admin/security" : "/app/security";
}

/**
 * Turns Google's answer into a destination.
 *  - The native app started it: hand the app a one-time code (it redeems it
 *    with its PKCE verifier at /api/mobile/auth/google). The browser itself
 *    is never signed in.
 *  - Someone is signed in: link Google to their account ("Connect Google").
 *  - Otherwise: sign in, following the shared rules in src/lib/sign-in.ts.
 */
export async function GET(req: Request) {
  const trip = await takeGoogleRoundTrip();
  let destination: string;
  try {
    const identity = await finishGoogleSignIn(new URL(req.url).searchParams, trip);
    if (trip.appChallenge) {
      const result = await signInWithGoogle(identity);
      destination = result.ok
        ? appRedirect({ code: await issueAppSignInCode(result.volunteer.id, trip.appChallenge) })
        : appRedirect({ error: result.reason, ...(result.reason === "google_unknown" ? { email: identity.email } : {}) });
    } else {
      const me = await currentUser();
      if (me) {
        const outcome = await connectGoogle(me, identity);
        destination = `${securityPath(me.role)}?${outcome === "connected" ? "google=connected" : `error=${outcome}`}`;
      } else {
        const result = await signInWithGoogle(identity);
        if (result.ok) {
          await createSession(result.volunteer.id);
          destination = postSignInPath(result.volunteer.role, trip.next);
        } else {
          destination = `/sign-in?error=${result.reason}${result.reason === "google_unknown" ? `&email=${encodeURIComponent(identity.email)}` : ""}`;
        }
      }
    }
  } catch (err) {
    const reason = err instanceof OAuthError ? err.reason : "unknown";
    console.error("[google] callback failed", reason, err);
    const code = reason === "access_denied" ? "google_cancelled" : "google_failed";
    destination = trip.appChallenge ? appRedirect({ error: code }) : `/sign-in?error=${code}`;
  }
  redirect(destination);
}
