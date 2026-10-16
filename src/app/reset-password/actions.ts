"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { PASSWORD_MIN, postSignInPath } from "@/lib/auth-shared";
import { findUsableToken } from "@/lib/auth";
import { createSession, hashPassword } from "@/lib/session";

export type SetPasswordState = { error?: string; fieldErrors?: { password?: string; confirm?: string } };

const schema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`).max(200, "That is too long."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The two passwords do not match.", path: ["confirm"] });

const EXPIRED = "This link has expired or has already been used. Ask for a new one below.";

export async function setPasswordWithToken(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const parsed = schema.safeParse({ token: formData.get("token"), password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) {
    const fieldErrors: SetPasswordState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === "token") return { error: EXPIRED };
      if (key === "password" || key === "confirm") fieldErrors[key] ??= issue.message;
    }
    return { fieldErrors };
  }
  const token = await findUsableToken(parsed.data.token);
  if (!token) return { error: EXPIRED };

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();
  const used = await db.$transaction(async (tx) => {
    // Claim the token first: a double submit gets exactly one winner.
    const claim = await tx.authToken.updateMany({ where: { id: token.id, usedAt: null }, data: { usedAt: now } });
    if (claim.count === 0) return false;
    await tx.volunteer.update({
      where: { id: token.volunteerId },
      // Receiving the link proves the inbox is theirs.
      data: { passwordHash, emailVerifiedAt: token.volunteer.emailVerifiedAt ?? now },
    });
    // A new password signs out every other device and kills any other links.
    await tx.session.deleteMany({ where: { volunteerId: token.volunteerId } });
    await tx.authToken.deleteMany({ where: { volunteerId: token.volunteerId, usedAt: null } });
    return true;
  });
  if (!used) return { error: EXPIRED };

  await createSession(token.volunteerId);
  redirect(postSignInPath(token.volunteer.role, null));
}
