import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import type { PasskeyOptions } from "@satisfy/core/api";
import { failure, json, mobileHandler } from "@/lib/mobile-auth";
import { passkeysAvailableFor } from "@/lib/mobile-api/platform";
import { passkeyRegistrationOptions } from "@/lib/sign-in";
import { storeAppChallenge } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export const POST = mobileHandler(async (me, request) => {
  if (!passkeysAvailableFor(request)) return failure(404, "Passkeys are not set up for this app yet.");
  const options = await passkeyRegistrationOptions(me);
  const challengeId = await storeAppChallenge("registration", options.challenge, me.id);
  return json<PasskeyOptions<PublicKeyCredentialCreationOptionsJSON>>({ challengeId, options });
});
