import { z } from "zod";
import type { SignInResult } from "@satisfy/core/api";
import { apiHandler, createMobileSession, failure, json } from "@/lib/mobile-auth";
import { mobileSession } from "@/lib/mobile-api/session";
import { clientIp } from "@/lib/rate-limit";
import { checkPassword } from "@/lib/sign-in";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });

export const POST = apiHandler(async (request) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure(400, "Enter your email and password.");
  const result = await checkPassword(parsed.data.email, parsed.data.password, await clientIp());
  if (!result.ok) return failure(403, result.error);
  const token = await createMobileSession(result.volunteer.id, request.headers.get("user-agent"));
  return json<SignInResult>({ token, session: await mobileSession(result.volunteer) });
});
