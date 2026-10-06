import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { PATH_HEADER, SESSION_COOKIE } from "./auth-shared";

export { hashPassword, verifyPassword } from "./passwords";

// Sessions: a random token in an httpOnly cookie, stored server-side only as
// its SHA-256. Idle sessions expire after 30 days; activity slides that window
// (refreshed at most daily) up to a hard cap of 180 days, so regular
// volunteers rarely have to sign in again but a lost phone does not stay
// signed in forever.
const IDLE_DAYS = 30;
const MAX_DAYS = 180;
const TOUCH_AFTER_MS = 24 * 3_600_000;
const DAY_MS = 86_400_000;

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(volunteerId: string): Promise<void> {
  const token = newToken();
  const now = Date.now();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db.session.create({
    data: { tokenHash: hashToken(token), volunteerId, expiresAt: new Date(now + IDLE_DAYS * DAY_MS), userAgent },
  });
  await db.volunteer.update({ where: { id: volunteerId }, data: { lastSignInAt: new Date(now) } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_DAYS * 86_400,
  });
}

/** The signed-in person, or null. Deactivated accounts count as signed out. */
export const currentUser = cache(async (): Promise<Volunteer | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { volunteer: true } });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.volunteer.status !== "ACTIVE") return null;
  if (now - session.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    const cap = session.createdAt.getTime() + MAX_DAYS * DAY_MS;
    await db.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now), expiresAt: new Date(Math.min(now + IDLE_DAYS * DAY_MS, cap)) },
    });
  }
  return session.volunteer;
});

/** Ends this browser's session. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Ends every session for a person except, optionally, the current one. */
export async function destroyOtherSessions(volunteerId: string, keepCurrent: boolean): Promise<number> {
  const token = keepCurrent ? (await cookies()).get(SESSION_COOKIE)?.value : undefined;
  const { count } = await db.session.deleteMany({
    where: { volunteerId, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) },
  });
  return count;
}

async function signInRedirect(): Promise<never> {
  const path = (await headers()).get(PATH_HEADER);
  redirect(path ? `/sign-in?next=${encodeURIComponent(path)}` : "/sign-in");
}

/** Any signed-in person. Admins can use the volunteer app too. */
export async function requireVolunteer(): Promise<Volunteer> {
  const user = await currentUser();
  if (!user) return signInRedirect();
  return user;
}

export async function requireAdmin(): Promise<Volunteer> {
  const user = await currentUser();
  if (!user) return signInRedirect();
  if (user.role !== "ADMIN") redirect("/app");
  return user;
}
