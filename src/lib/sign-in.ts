import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { Prisma, type Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { fullName, normaliseEmail } from "./domain";
import { GOOGLE, type GoogleIdentity } from "./oauth";
import { verifyPassword } from "./passwords";
import { LIMITS, reset, take } from "./rate-limit";
import { RP_NAME, expectedOrigins, rpID } from "./webauthn";

// The sign-in rules, shared by the website (server actions, cookie sessions)
// and the native app (/api/mobile/auth, bearer sessions), so both accept
// exactly the same people. Nothing here creates a session: the caller does.
// Accounts are never created here either: volunteers are approved by the
// coordinator first.

export type SignedIn = { ok: true; volunteer: Volunteer };
/** `mismatch` marks a refusal where the email or password itself is wrong,
 *  so a form can flag its fields, as opposed to a rate limit or an inactive
 *  account. */
export type Refused = { ok: false; error: string; mismatch?: boolean };

export const INACTIVE = "This account is no longer active. Contact the volunteer coordinator if that is a mistake.";

// Password ------------------------------------------------------------------

export async function checkPassword(emailInput: string, password: string, ip: string): Promise<SignedIn | Refused> {
  const email = normaliseEmail(emailInput);
  const emailKey = `pw:email:${email}`;
  if (!take(emailKey, LIMITS.passwordPerEmail) || !take(`pw:ip:${ip}`, LIMITS.passwordPerIp)) {
    return { ok: false, error: "Too many attempts. Wait 15 minutes, or use “Forgot your password?” to get a sign-in link." };
  }
  const volunteer = await db.volunteer.findUnique({ where: { email } });
  const matches = await verifyPassword(password, volunteer?.passwordHash ?? null);
  if (!volunteer || !matches) {
    return { ok: false, error: "That email and password do not match. Check for typos, or use “Forgot your password?”.", mismatch: true };
  }
  // Only said once the password is right, so it does not reveal who has an account.
  if (volunteer.status !== "ACTIVE") return { ok: false, error: INACTIVE };
  reset(emailKey);
  return { ok: true, volunteer };
}

// Google --------------------------------------------------------------------

export type GoogleRefusal = "google_unknown" | "google_unverified" | "inactive";

/** A known Google identity signs in. Otherwise an existing volunteer is
 *  matched by email, only when Google has verified that email (an unverified
 *  address could otherwise take over an account), and Google is linked. */
export async function signInWithGoogle(identity: GoogleIdentity): Promise<SignedIn | { ok: false; reason: GoogleRefusal }> {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: GOOGLE, providerAccountId: identity.sub } },
    include: { volunteer: true },
  });
  if (linked) {
    if (linked.volunteer.status !== "ACTIVE") return { ok: false, reason: "inactive" };
    return { ok: true, volunteer: linked.volunteer };
  }
  const volunteer = await db.volunteer.findUnique({ where: { email: identity.email } });
  if (!volunteer) return { ok: false, reason: "google_unknown" };
  if (!identity.emailVerified) return { ok: false, reason: "google_unverified" };
  if (volunteer.status !== "ACTIVE") return { ok: false, reason: "inactive" };
  await db.$transaction([
    db.oAuthAccount.create({ data: { volunteerId: volunteer.id, provider: GOOGLE, providerAccountId: identity.sub, email: identity.email } }),
    // Google vouching for the address proves the inbox is theirs.
    db.volunteer.updateMany({ where: { id: volunteer.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return { ok: true, volunteer };
}

/** "Connect Google" from Sign-in and security, for someone signed in. */
export async function connectGoogle(me: Volunteer, identity: GoogleIdentity): Promise<"connected" | "google_taken" | "google_exists"> {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: GOOGLE, providerAccountId: identity.sub } },
  });
  if (linked) return linked.volunteerId === me.id ? "connected" : "google_taken";
  try {
    await db.oAuthAccount.create({ data: { volunteerId: me.id, provider: GOOGLE, providerAccountId: identity.sub, email: identity.email } });
  } catch (err) {
    // The unique constraints catch a second Google account or a double submit.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "google_exists";
    throw err;
  }
  return "connected";
}

// Passkeys ------------------------------------------------------------------

const PASSKEY_FAILED = "We could not verify that passkey. Please try again.";
const PASSKEY_NOT_SAVED = "We could not save that passkey. Please try again.";
export const CHALLENGE_EXPIRED = "That took too long. Please try again.";

/** Usernameless sign-in: no allowCredentials, so the device offers whichever
 *  passkey it holds for this site. */
export function passkeySignInOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({ rpID: rpID(), userVerification: "preferred", allowCredentials: [] });
}

export async function verifyPasskeySignIn(response: AuthenticationResponseJSON, expectedChallenge: string): Promise<SignedIn | Refused> {
  const passkey = await db.passkey.findUnique({ where: { credentialId: response.id }, include: { volunteer: true } });
  if (!passkey) return { ok: false, error: "We do not recognise that passkey. It may have been removed. Sign in another way." };
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: rpID(),
      requireUserVerification: false,
      credential: { id: passkey.credentialId, publicKey: passkey.publicKey, counter: passkey.counter, transports: passkey.transports },
    });
  } catch (err) {
    console.error("[passkey] sign-in verification failed", err);
    return { ok: false, error: PASSKEY_FAILED };
  }
  if (!verification.verified) return { ok: false, error: PASSKEY_FAILED };
  if (passkey.volunteer.status !== "ACTIVE") return { ok: false, error: INACTIVE };
  await db.passkey.update({
    where: { id: passkey.id },
    data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  return { ok: true, volunteer: passkey.volunteer };
}

export async function passkeyRegistrationOptions(me: Volunteer): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await db.passkey.findMany({ where: { volunteerId: me.id }, select: { credentialId: true, transports: true } });
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(),
    userName: me.email,
    userDisplayName: fullName(me),
    userID: new TextEncoder().encode(me.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId, transports: p.transports })),
    // Discoverable credentials, so sign-in does not need the email first.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
}

export async function savePasskey(
  me: Volunteer,
  response: RegistrationResponseJSON,
  expectedChallenge: string,
  name: string,
): Promise<{ ok: true } | Refused> {
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: expectedOrigins(),
      expectedRPID: rpID(),
      requireUserVerification: false,
    });
  } catch (err) {
    console.error("[passkey] registration verification failed", err);
    return { ok: false, error: PASSKEY_NOT_SAVED };
  }
  if (!verification.verified) return { ok: false, error: PASSKEY_NOT_SAVED };
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  try {
    await db.passkey.create({
      data: {
        volunteerId: me.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: name.slice(0, 80),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "That passkey is already saved." };
    }
    throw err;
  }
  return { ok: true };
}
