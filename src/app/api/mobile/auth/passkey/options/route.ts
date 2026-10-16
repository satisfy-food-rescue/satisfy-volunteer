import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import type { PasskeyOptions } from "@satisfy/core/api";
import { apiHandler, failure, json } from "@/lib/mobile-auth";
import { passkeysAvailableFor } from "@/lib/mobile-api/platform";
import { passkeySignInOptions } from "@/lib/sign-in";
import { storeAppChallenge } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (request) => {
  if (!passkeysAvailableFor(request)) return failure(404, "Passkeys are not set up for this app yet. Sign in another way.");
  const options = await passkeySignInOptions();
  const challengeId = await storeAppChallenge("authentication", options.challenge, null);
  return json<PasskeyOptions<PublicKeyCredentialRequestOptionsJSON>>({ challengeId, options });
});
