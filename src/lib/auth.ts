import "server-only";
import type { AuthTokenPurpose, Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { accountInvite, passwordReset } from "./email-templates";
import { sendSignInLinkEmail } from "./emails";
import { absoluteUrl } from "./env";
import { hashToken, newToken } from "./session";

// Single-use sign-in links. An invite (sent when an admin creates an account)
// and a password reset (forgot password, or "first time here?" for someone
// whose account was imported) both let the holder set a password and sign in.
// Only the SHA-256 of the token is stored.

export const TOKEN_TTL_HOURS: Record<AuthTokenPurpose, number> = {
  INVITE: 7 * 24,
  PASSWORD_RESET: 2,
};

/** Issues a fresh link (revoking any unused one of the same kind) and emails
 *  it. Returns whether the email was handed to the provider. */
export async function sendSignInLink(volunteer: Volunteer, purpose: AuthTokenPurpose): Promise<boolean> {
  const raw = newToken();
  const hours = TOKEN_TTL_HOURS[purpose];
  await db.$transaction([
    db.authToken.deleteMany({ where: { volunteerId: volunteer.id, purpose, usedAt: null } }),
    db.authToken.create({
      data: { tokenHash: hashToken(raw), volunteerId: volunteer.id, purpose, expiresAt: new Date(Date.now() + hours * 3_600_000) },
    }),
  ]);
  const url = absoluteUrl(`/reset-password?token=${raw}`);
  const draft =
    purpose === "INVITE"
      ? accountInvite({ firstName: volunteer.firstName, expiresDays: hours / 24 })
      : passwordReset({ firstName: volunteer.firstName, expiresHours: hours, hasPassword: volunteer.passwordHash !== null });
  return sendSignInLinkEmail(volunteer, draft, url);
}

/** Looks a link up without using it (GET requests from link scanners must
 *  not burn it). Null when unknown, used, expired or the account is inactive. */
export async function findUsableToken(raw: string) {
  if (!raw) return null;
  const token = await db.authToken.findUnique({ where: { tokenHash: hashToken(raw) }, include: { volunteer: true } });
  if (!token || token.usedAt || token.expiresAt <= new Date() || token.volunteer.status !== "ACTIVE") return null;
  return token;
}
