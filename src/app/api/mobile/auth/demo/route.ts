import { z } from "zod";
import type { SignInResult } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { apiHandler, createMobileSession, failure, json, readBody } from "@/lib/mobile-auth";
import { mobileSession } from "@/lib/mobile-api/session";

export const dynamic = "force-dynamic";

const schema = z.object({ personaKey: z.string().min(1) });

/** Demo sign-in: pick a persona, no password. */
export const POST = apiHandler(async (request) => {
  if (!isDemo()) return failure(404, "Not found.");
  const { personaKey } = await readBody(request, schema);
  const volunteer = await db.volunteer.findUnique({ where: { personaKey } });
  if (!volunteer) return failure(404, "That persona is not in the demo any more.");
  if (volunteer.role === "ADMIN") {
    return failure(403, `${volunteer.firstName} is the coordinator. Coordinator tools are on the web: open the demo in a browser to sign in as ${volunteer.firstName}.`);
  }
  if (volunteer.status !== "ACTIVE") return failure(403, `${volunteer.firstName}'s account is not active.`);
  const token = await createMobileSession(volunteer.id, request.headers.get("user-agent"));
  return json<SignInResult>({ token, session: await mobileSession(volunteer) });
});
