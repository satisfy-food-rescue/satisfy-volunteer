import { after } from "next/server";
import { z } from "zod";
import type { MutationOk } from "@satisfy/core/api";
import { sendSignInLink } from "@/lib/auth";
import { db } from "@/lib/db";
import { normaliseEmail } from "@/lib/domain";
import { isDemo } from "@/lib/env";
import { apiHandler, failure, json } from "@/lib/mobile-auth";
import { LIMITS, clientIp, take } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** "Forgot your password?" in the app. Same rules and reply as the website:
 *  the answer does not say whether the address has an account. */
export const POST = apiHandler(async (request) => {
  if (isDemo()) return failure(404, "Not found.");
  const parsed = z.object({ email: z.email() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure(400, "Enter the email address you volunteer with.");
  const email = normaliseEmail(parsed.data.email);
  if (!take(`link:email:${email}`, LIMITS.linkPerEmail) || !take(`link:ip:${await clientIp()}`, LIMITS.linkPerIp)) {
    return failure(429, "We have sent a few links already. Check your inbox and spam folder, or try again in an hour.");
  }
  // Looked up and sent after the response, so the reply takes the same time
  // whether or not the address has an account.
  after(async () => {
    const volunteer = await db.volunteer.findUnique({ where: { email } });
    if (volunteer?.status === "ACTIVE") await sendSignInLink(volunteer, "PASSWORD_RESET");
  });
  return json<MutationOk>({ message: `If ${email} has a volunteer account, we have emailed it a link to choose a password. It works for 2 hours.` });
});
