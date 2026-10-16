import { z } from "zod";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import type { MutationOk } from "@satisfy/core/api";
import { failure, json, mobileHandler, readBody } from "@/lib/mobile-auth";
import { CHALLENGE_EXPIRED, savePasskey } from "@/lib/sign-in";
import { takeAppChallenge } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

const schema = z.object({
  challengeId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  response: z.looseObject({ id: z.string().min(1), rawId: z.string(), type: z.literal("public-key"), response: z.looseObject({}) }),
});

/** Saves a passkey created on this phone. */
export const POST = mobileHandler(async (me, request) => {
  const { challengeId, name, response } = await readBody(request, schema);
  const challenge = await takeAppChallenge("registration", challengeId, me.id);
  if (!challenge) return failure(422, CHALLENGE_EXPIRED);
  const saved = await savePasskey(me, response as unknown as RegistrationResponseJSON, challenge, name);
  if (!saved.ok) return failure(422, saved.error);
  return json<MutationOk>({ message: "Passkey added. Next time, sign in with it." });
});
