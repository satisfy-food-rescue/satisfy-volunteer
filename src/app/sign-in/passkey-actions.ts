"use server";

import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { postSignInPath } from "@/lib/auth-shared";
import { createSession } from "@/lib/session";
import { CHALLENGE_EXPIRED, passkeySignInOptions, verifyPasskeySignIn } from "@/lib/sign-in";
import { storeChallenge, takeChallenge } from "@/lib/webauthn";

export type PasskeyBegin = { ok: true; options: PublicKeyCredentialRequestOptionsJSON } | { ok: false; error: string };
export type PasskeyFinish = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function beginPasskeySignIn(): Promise<PasskeyBegin> {
  const options = await passkeySignInOptions();
  await storeChallenge("authentication", options.challenge);
  return { ok: true, options };
}

export async function finishPasskeySignIn(response: AuthenticationResponseJSON, next: string | null): Promise<PasskeyFinish> {
  const expectedChallenge = await takeChallenge("authentication");
  if (!expectedChallenge) return { ok: false, error: CHALLENGE_EXPIRED };
  const result = await verifyPasskeySignIn(response, expectedChallenge);
  if (!result.ok) return result;
  await createSession(result.volunteer.id);
  return { ok: true, redirectTo: postSignInPath(result.volunteer.role, next) };
}
