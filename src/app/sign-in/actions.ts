"use server";

import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/env";
import { normaliseEmail } from "@/lib/domain";
import { postSignInPath } from "@/lib/auth-shared";
import { createSession, destroySession } from "@/lib/session";
import { sendSignInLink } from "@/lib/auth";
import { LIMITS, clientIp, take } from "@/lib/rate-limit";
import { checkPassword } from "@/lib/sign-in";
import { personaEmail } from "@/lib/personas";

/** `invalid` marks the fields as wrong (a mismatch or a malformed entry), as
 *  opposed to a refusal such as too many attempts, where the fields are fine. */
export type SignInState = { error?: string; email?: string; invalid?: boolean };

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().optional(),
});

export async function signInWithPassword(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  const typed = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: "Enter your email and password.", email: typed, invalid: true };
  const result = await checkPassword(parsed.data.email, parsed.data.password, await clientIp());
  if (!result.ok) return { error: result.error, email: typed, invalid: result.mismatch === true };
  const { volunteer } = result;
  await createSession(volunteer.id);
  redirect(postSignInPath(volunteer.role, parsed.data.next));
}

/** `invalid` marks the email field as wrong, as opposed to a rate limit. */
export type LinkState = { error?: string; sent?: boolean; email?: string; invalid?: boolean };

/** "Forgot your password?" and "Set up your password". The reply is the same
 *  whether or not the address has an account. */
export async function requestSignInLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: "Enter the email address you volunteer with.", invalid: true };
  const email = normaliseEmail(parsed.data);
  const ip = await clientIp();
  if (!take(`link:email:${email}`, LIMITS.linkPerEmail) || !take(`link:ip:${ip}`, LIMITS.linkPerIp)) {
    return { error: "We have sent a few links already. Check your inbox and spam folder, or try again in an hour." };
  }
  // Looked up and sent after the response, so the reply takes the same time
  // whether or not the address has an account.
  after(async () => {
    const volunteer = await db.volunteer.findUnique({ where: { email } });
    if (volunteer?.status === "ACTIVE") await sendSignInLink(volunteer, "PASSWORD_RESET");
  });
  return { sent: true, email };
}

export async function signOut() {
  await destroySession();
  redirect("/sign-in");
}

/** Demo only: sign straight in as one of the personas. */
export async function signInAsPersona(formData: FormData) {
  if (!isDemo()) notFound();
  const email = personaEmail(String(formData.get("persona") ?? ""));
  const volunteer = email ? await db.volunteer.findUnique({ where: { email } }) : null;
  if (!volunteer) redirect("/sign-in");
  await createSession(volunteer.id);
  redirect(volunteer.role === "ADMIN" ? "/admin" : "/app");
}
