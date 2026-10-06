import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { postSignInPath } from "@/lib/auth-shared";
import { createSession, currentUser } from "@/lib/session";
import { GOOGLE, OAuthError, finishGoogleSignIn, type GoogleIdentity } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function securityPath(role: "ADMIN" | "VOLUNTEER") {
  return role === "ADMIN" ? "/admin/security" : "/app/security";
}

/**
 * Turns a Google identity into a destination.
 *  - Already signed in: link Google to this account ("Connect Google").
 *  - Known Google identity: sign in.
 *  - Otherwise match an existing volunteer by email, only when Google has
 *    verified that email (an unverified address could otherwise take over an
 *    account). Accounts are never created here: volunteers are approved by
 *    the coordinator first.
 */
async function resolve(identity: GoogleIdentity, next: string | null): Promise<string> {
  const where = { provider_providerAccountId: { provider: GOOGLE, providerAccountId: identity.sub } };
  const linked = await db.oAuthAccount.findUnique({ where, include: { volunteer: true } });
  const me = await currentUser();

  if (me) {
    const back = securityPath(me.role);
    if (linked) return linked.volunteerId === me.id ? `${back}?google=connected` : `${back}?error=google_taken`;
    try {
      await db.oAuthAccount.create({ data: { volunteerId: me.id, provider: GOOGLE, providerAccountId: identity.sub, email: identity.email } });
    } catch (err) {
      // The unique constraints catch a second Google account or a double submit.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return `${back}?error=google_exists`;
      throw err;
    }
    return `${back}?google=connected`;
  }

  if (linked) {
    if (linked.volunteer.status !== "ACTIVE") return "/sign-in?error=inactive";
    await createSession(linked.volunteerId);
    return postSignInPath(linked.volunteer.role, next);
  }

  const volunteer = await db.volunteer.findUnique({ where: { email: identity.email } });
  if (!volunteer) return `/sign-in?error=google_unknown&email=${encodeURIComponent(identity.email)}`;
  if (!identity.emailVerified) return "/sign-in?error=google_unverified";
  if (volunteer.status !== "ACTIVE") return "/sign-in?error=inactive";
  await db.$transaction([
    db.oAuthAccount.create({ data: { volunteerId: volunteer.id, provider: GOOGLE, providerAccountId: identity.sub, email: identity.email } }),
    // Google vouching for the address proves the inbox is theirs.
    db.volunteer.updateMany({ where: { id: volunteer.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } }),
  ]);
  await createSession(volunteer.id);
  return postSignInPath(volunteer.role, next);
}

export async function GET(req: Request) {
  let destination: string;
  try {
    const { identity, next } = await finishGoogleSignIn(new URL(req.url).searchParams);
    destination = await resolve(identity, next);
  } catch (err) {
    const reason = err instanceof OAuthError ? err.reason : "unknown";
    console.error("[google] callback failed", reason, err);
    destination = `/sign-in?error=${reason === "access_denied" ? "google_cancelled" : "google_failed"}`;
  }
  redirect(destination);
}
