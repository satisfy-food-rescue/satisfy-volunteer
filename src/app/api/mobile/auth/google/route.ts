import { z } from "zod";
import type { SignInResult } from "@satisfy/core/api";
import { apiHandler, createMobileSession, failure, json, readBody, redeemAppSignInCode } from "@/lib/mobile-auth";
import { mobileSession } from "@/lib/mobile-api/session";

export const dynamic = "force-dynamic";

// The verifier is 43 to 128 unreserved characters (RFC 7636).
const schema = z.object({ code: z.string().min(1).max(100), verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/) });

/** Redeems the code the system browser handed back after Google sign-in. */
export const POST = apiHandler(async (request) => {
  const { code, verifier } = await readBody(request, schema);
  const volunteer = await redeemAppSignInCode(code, verifier);
  if (!volunteer) return failure(403, "Google sign-in did not finish. Please try again.");
  const token = await createMobileSession(volunteer.id, request.headers.get("user-agent"));
  return json<SignInResult>({ token, session: await mobileSession(volunteer) });
});
