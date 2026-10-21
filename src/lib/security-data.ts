import "server-only";
import { cookies } from "next/headers";
import { isProviderConnectError, isProviderSignInError, providerConnectMessage, providerSignInMessage } from "@satisfy/core/sign-in";
import type { Volunteer } from "@/generated/prisma/client";
import type { SecurityProps } from "@/components/auth/security-settings";
import { APPLE, isAppleRelay } from "./apple";
import { db } from "./db";
import { SESSION_COOKIE } from "./auth-shared";
import { formatInstant } from "./dates";
import { appleConfigured, googleConfigured } from "./env";
import { GOOGLE } from "./oauth";
import { hashToken } from "./session";

/** What the Google or Apple connect round trip came back with: connected,
 *  refused, or cancelled or failed on the provider's side. */
function notice(search: { google?: string; apple?: string; error?: string }): SecurityProps["notice"] {
  if (search.google === "connected") return { tone: "success", text: "Google connected. You can now sign in with Google." };
  if (search.apple === "connected") return { tone: "success", text: "Apple connected. You can now sign in with Apple." };
  if (isProviderConnectError(search.error)) return { tone: "error", text: providerConnectMessage(search.error) };
  if (isProviderSignInError(search.error)) return { tone: "error", text: providerSignInMessage(search.error) };
  return null;
}

/** Everything the Sign-in and security page shows, for the signed-in person. */
export async function securityProps(me: Volunteer, search: { google?: string; apple?: string; error?: string }, returnPath: string): Promise<SecurityProps> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const [passkeys, google, apple, otherSessions] = await Promise.all([
    db.passkey.findMany({ where: { volunteerId: me.id }, orderBy: { createdAt: "asc" } }),
    db.oAuthAccount.findFirst({ where: { volunteerId: me.id, provider: GOOGLE } }),
    db.oAuthAccount.findFirst({ where: { volunteerId: me.id, provider: APPLE } }),
    db.session.count({ where: { volunteerId: me.id, expiresAt: { gt: new Date() }, ...(token ? { tokenHash: { not: hashToken(token) } } : {}) } }),
  ]);
  return {
    hasPassword: me.passwordHash !== null,
    passkeys: passkeys.map((p) => ({ id: p.id, name: p.name, added: formatInstant(p.createdAt), lastUsed: p.lastUsedAt ? formatInstant(p.lastUsedAt) : null })),
    google: google ? { email: google.email } : null,
    googleAvailable: googleConfigured(),
    // A relay address means nothing to the volunteer, so it is not shown.
    apple: apple ? { email: isAppleRelay(apple.email) ? null : apple.email } : null,
    appleAvailable: appleConfigured(),
    otherSessions,
    notice: notice(search),
    returnPath,
  };
}
