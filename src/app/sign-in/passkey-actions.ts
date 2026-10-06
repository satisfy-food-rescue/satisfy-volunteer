"use server";

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { postSignInPath } from "@/lib/auth-shared";
import { createSession } from "@/lib/session";
import { rpID, rpOrigin, storeChallenge, takeChallenge } from "@/lib/webauthn";

export type PasskeyBegin = { ok: true; options: PublicKeyCredentialRequestOptionsJSON } | { ok: false; error: string };
export type PasskeyFinish = { ok: true; redirectTo: string } | { ok: false; error: string };

/** Usernameless sign-in: no allowCredentials, so the device offers whichever
 *  passkey it holds for this site. */
export async function beginPasskeySignIn(): Promise<PasskeyBegin> {
  const options = await generateAuthenticationOptions({ rpID: rpID(), userVerification: "preferred", allowCredentials: [] });
  await storeChallenge("authentication", options.challenge);
  return { ok: true, options };
}

export async function finishPasskeySignIn(response: AuthenticationResponseJSON, next: string | null): Promise<PasskeyFinish> {
  const expectedChallenge = await takeChallenge("authentication");
  if (!expectedChallenge) return { ok: false, error: "That took too long. Please try again." };
  const passkey = await db.passkey.findUnique({ where: { credentialId: response.id }, include: { volunteer: true } });
  if (!passkey) return { ok: false, error: "We do not recognise that passkey. It may have been removed. Sign in another way." };

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: rpOrigin(),
      expectedRPID: rpID(),
      requireUserVerification: false,
      credential: { id: passkey.credentialId, publicKey: passkey.publicKey, counter: passkey.counter, transports: passkey.transports },
    });
  } catch (err) {
    console.error("[passkey] sign-in verification failed", err);
    return { ok: false, error: "We could not verify that passkey. Please try again." };
  }
  if (!verification.verified) return { ok: false, error: "We could not verify that passkey. Please try again." };
  if (passkey.volunteer.status !== "ACTIVE") {
    return { ok: false, error: "This account is no longer active. Contact the volunteer coordinator if that is a mistake." };
  }
  await db.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  await createSession(passkey.volunteerId);
  return { ok: true, redirectTo: postSignInPath(passkey.volunteer.role, next) };
}
