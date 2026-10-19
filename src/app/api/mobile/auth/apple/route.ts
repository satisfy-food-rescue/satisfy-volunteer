import { z } from "zod";
import type { SignInResult } from "@satisfy/core/api";
import type { Volunteer } from "@/generated/prisma/client";
import { providerSignInMessage } from "@satisfy/core/sign-in";
import { isAppleRelay, verifyNativeAppleSignIn } from "@/lib/apple";
import { appleConfigured } from "@/lib/env";
import { apiHandler, createMobileSession, failure, json, readBody, redeemAppSignInCode } from "@/lib/mobile-auth";
import { mobileSession } from "@/lib/mobile-api/session";
import { signInWithApple } from "@/lib/sign-in";

export const dynamic = "force-dynamic";

// Apple's identity tokens are a few kilobytes at most. The nonce is the
// app's PKCE-style verifier: 43 to 128 unreserved characters (RFC 7636).
const verifier = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);
const schema = z.union([
  z.object({ identityToken: z.string().min(1).max(8_000), nonce: verifier }),
  z.object({ code: z.string().min(1).max(100), verifier }),
]);

/** Sign in with Apple from the app: the iOS app's native sign-in, or the
 *  Android app redeeming the code the system browser handed back. */
export const POST = apiHandler(async (request) => {
  const body = await readBody(request, schema);
  let volunteer: Volunteer;
  if ("code" in body) {
    const redeemed = await redeemAppSignInCode(body.code, body.verifier);
    if (!redeemed) return failure(403, "Apple sign-in did not finish. Please try again.");
    volunteer = redeemed;
  } else {
    if (!appleConfigured()) return failure(403, providerSignInMessage("apple_unavailable"));
    const identity = await verifyNativeAppleSignIn(body.identityToken, body.nonce).catch(() => null);
    if (!identity) return failure(403, providerSignInMessage("apple_failed"));
    const result = await signInWithApple(identity);
    if (!result.ok) return failure(403, providerSignInMessage(result.reason, isAppleRelay(identity.email) ? null : identity.email));
    volunteer = result.volunteer;
  }
  const token = await createMobileSession(volunteer.id, request.headers.get("user-agent"));
  return json<SignInResult>({ token, session: await mobileSession(volunteer) });
});
