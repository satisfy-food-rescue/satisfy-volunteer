"use server";

import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/env";
import { normaliseEmail } from "@/lib/domain";
import { postSignInPath } from "@/lib/auth-shared";
import { createSession, destroySession, verifyPassword } from "@/lib/session";
import { sendSignInLink } from "@/lib/auth";
import { LIMITS, clientIp, reset, take } from "@/lib/rate-limit";
import { personaEmail } from "@/lib/demo/personas";

export type SignInState = { error?: string; email?: string };

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
  if (!parsed.success) return { error: "Enter your email and password.", email: typed };
  const email = normaliseEmail(parsed.data.email);
  const ip = await clientIp();
  const emailKey = `pw:email:${email}`;
  const ipKey = `pw:ip:${ip}`;
  if (!take(emailKey, LIMITS.passwordPerEmail) || !take(ipKey, LIMITS.passwordPerIp)) {
    return { error: "Too many attempts. Wait 15 minutes, or use “Forgot your password?” to get a sign-in link.", email: typed };
  }
  const volunteer = await db.volunteer.findUnique({ where: { email } });
  const ok = await verifyPassword(parsed.data.password, volunteer?.passwordHash ?? null);
  if (!volunteer || !ok) {
    return { error: "That email and password do not match. Check for typos, or use “Forgot your password?”.", email: typed };
  }
  // Only said once the password is right, so it does not reveal who has an account.
  if (volunteer.status !== "ACTIVE") {
    return { error: "This account is no longer active. Contact the volunteer coordinator if that is a mistake.", email: typed };
  }
  reset(emailKey);
  await createSession(volunteer.id);
  redirect(postSignInPath(volunteer.role, parsed.data.next));
}

export type LinkState = { error?: string; sent?: boolean; email?: string };

/** "Forgot your password?" and "First time here?". The reply is the same
 *  whether or not the address has an account. */
export async function requestSignInLink(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim());
  if (!parsed.success) return { error: "Enter the email address you volunteer with." };
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
