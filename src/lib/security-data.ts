import "server-only";
import { cookies } from "next/headers";
import type { Volunteer } from "@/generated/prisma/client";
import type { SecurityProps } from "@/components/auth/security-settings";
import { db } from "./db";
import { SESSION_COOKIE } from "./auth-shared";
import { formatInstant } from "./dates";
import { googleConfigured } from "./env";
import { GOOGLE } from "./oauth";
import { hashToken } from "./session";

const NOTICES: Record<string, SecurityProps["notice"]> = {
  connected: { tone: "success", text: "Google connected. You can now sign in with Google." },
  google_taken: { tone: "error", text: "That Google account is already connected to someone else's volunteer account." },
  google_exists: { tone: "error", text: "A Google account is already connected. Disconnect it first to connect a different one." },
};

/** Everything the Sign-in and security page shows, for the signed-in person. */
export async function securityProps(me: Volunteer, search: { google?: string; error?: string }, returnPath: string): Promise<SecurityProps> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [passkeys, google, otherSessions] = await Promise.all([
    db.passkey.findMany({ where: { volunteerId: me.id }, orderBy: { createdAt: "asc" } }),
    db.oAuthAccount.findFirst({ where: { volunteerId: me.id, provider: GOOGLE } }),
    db.session.count({ where: { volunteerId: me.id, expiresAt: { gt: new Date() }, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) } }),
  ]);
  return {
    hasPassword: me.passwordHash !== null,
    passkeys: passkeys.map((p) => ({ id: p.id, name: p.name, added: formatInstant(p.createdAt), lastUsed: p.lastUsedAt ? formatInstant(p.lastUsedAt) : null })),
    google: google ? { email: google.email } : null,
    googleAvailable: googleConfigured(),
    otherSessions,
    notice: NOTICES[search.google === "connected" ? "connected" : (search.error ?? "")] ?? null,
    returnPath,
  };
}
