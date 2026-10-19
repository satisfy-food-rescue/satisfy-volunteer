import { z } from "zod";
import type { MutationOk } from "@satisfy/core/api";
import { providerConnectMessage, providerSignInMessage } from "@satisfy/core/sign-in";
import { APPLE, verifyNativeAppleSignIn } from "@/lib/apple";
import { appleConfigured } from "@/lib/env";
import { failure, json, mobileHandler, readBody } from "@/lib/mobile-auth";
import { connectApple, disconnectProvider } from "@/lib/sign-in";

export const dynamic = "force-dynamic";

const schema = z.object({ identityToken: z.string().min(1).max(8_000), nonce: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) });

/** "Connect Apple" in the iOS app, from its native sign-in. */
export const POST = mobileHandler(async (me, request) => {
  const { identityToken, nonce } = await readBody(request, schema);
  if (!appleConfigured()) return failure(422, providerSignInMessage("apple_unavailable"));
  const identity = await verifyNativeAppleSignIn(identityToken, nonce).catch(() => null);
  if (!identity) return failure(422, providerSignInMessage("apple_failed"));
  const outcome = await connectApple(me, identity);
  if (outcome !== "connected") return failure(422, providerConnectMessage(outcome));
  return json<MutationOk>({ message: "Apple connected. You can now sign in with Apple." });
});

export const DELETE = mobileHandler(async (me) => {
  await disconnectProvider(me, APPLE);
  return json<MutationOk>({ message: "Apple disconnected." });
});
