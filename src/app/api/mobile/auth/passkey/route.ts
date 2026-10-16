import { z } from "zod";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import type { SignInResult } from "@satisfy/core/api";
import { apiHandler, createMobileSession, failure, json, readBody } from "@/lib/mobile-auth";
import { mobileSession } from "@/lib/mobile-api/session";
import { CHALLENGE_EXPIRED, verifyPasskeySignIn } from "@/lib/sign-in";
import { takeAppChallenge } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

// The response is checked properly by @simplewebauthn/server; this only
// makes sure it has the shape that library expects.
const schema = z.object({
  challengeId: z.string().min(1),
  response: z.looseObject({ id: z.string().min(1), rawId: z.string(), type: z.literal("public-key"), response: z.looseObject({}) }),
});

export const POST = apiHandler(async (request) => {
  const { challengeId, response } = await readBody(request, schema);
  const challenge = await takeAppChallenge("authentication", challengeId, null);
  if (!challenge) return failure(403, CHALLENGE_EXPIRED);
  const result = await verifyPasskeySignIn(response as unknown as AuthenticationResponseJSON, challenge);
  if (!result.ok) return failure(403, result.error);
  const token = await createMobileSession(result.volunteer.id, request.headers.get("user-agent"));
  return json<SignInResult>({ token, session: await mobileSession(result.volunteer) });
});
