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
import type { AppleSignInError } from "@satisfy/core/api";
import { Prisma, type Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { fullName, normaliseEmail } from "./domain";
import { APPLE, type AppleIdentity } from "./apple";
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

// Google and Apple -----------------------------------------------------------
//
// A known identity signs in. Otherwise an existing volunteer is matched by
// email, only when the provider has verified that email (an unverified
// address could otherwise take over an account), and the identity is linked.

type ProviderIdentity = { sub: string; email: string | null; emailVerified: boolean };
type ProviderRefusal = "unknown" | "unverified" | "inactive";

async function signInWithProvider(provider: string, identity: ProviderIdentity): Promise<SignedIn | { ok: false; reason: ProviderRefusal }> {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.sub } },
    include: { volunteer: true },
  });
  if (linked) {
    if (linked.volunteer.status !== "ACTIVE") return { ok: false, reason: "inactive" };
    if (identity.email && identity.email !== linked.email) {
      await db.oAuthAccount.update({ where: { id: linked.id }, data: { email: identity.email } });
    }
    return { ok: true, volunteer: linked.volunteer };
  }
  const volunteer = identity.email ? await db.volunteer.findUnique({ where: { email: identity.email } }) : null;
  if (!volunteer) return { ok: false, reason: "unknown" };
  if (!identity.emailVerified) return { ok: false, reason: "unverified" };
  if (volunteer.status !== "ACTIVE") return { ok: false, reason: "inactive" };
  await db.$transaction([
    db.oAuthAccount.create({ data: { volunteerId: volunteer.id, provider, providerAccountId: identity.sub, email: identity.email } }),
    // The provider vouching for the address proves the inbox is theirs.
    db.volunteer.updateMany({ where: { id: volunteer.id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } }),
  ]);
  return { ok: true, volunteer };
}

/** "Connect Google" or "Connect Apple" from Sign-in and security, for someone
 *  signed in. Matches nothing by email, so an Apple relay address works. */
async function connectProvider(provider: string, me: Volunteer, identity: ProviderIdentity): Promise<"connected" | "taken" | "exists"> {
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.sub } },
  });
  if (linked) return linked.volunteerId === me.id ? "connected" : "taken";
  try {
    await db.oAuthAccount.create({ data: { volunteerId: me.id, provider, providerAccountId: identity.sub, email: identity.email } });
  } catch (err) {
    // The unique constraints catch a second account or a double submit.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "exists";
    throw err;
  }
  return "connected";
}

/** "Disconnect" in Sign-in and security. */
export async function disconnectProvider(me: Volunteer, provider: typeof GOOGLE | typeof APPLE): Promise<void> {
  await db.oAuthAccount.deleteMany({ where: { volunteerId: me.id, provider } });
}

export type GoogleRefusal = "google_unknown" | "google_unverified" | "inactive";

export async function signInWithGoogle(identity: GoogleIdentity): Promise<SignedIn | { ok: false; reason: GoogleRefusal }> {
  const result = await signInWithProvider(GOOGLE, identity);
  if (result.ok) return result;
  if (result.reason === "inactive") return { ok: false, reason: "inactive" };
  return { ok: false, reason: result.reason === "unknown" ? "google_unknown" : "google_unverified" };
}

export async function connectGoogle(me: Volunteer, identity: GoogleIdentity): Promise<"connected" | "google_taken" | "google_exists"> {
  const outcome = await connectProvider(GOOGLE, me, identity);
  return outcome === "connected" ? outcome : `google_${outcome}`;
}

/** Apple always verifies the addresses it hands over. A relay address that
 *  matches nobody gets its own reason, since the fix is to connect Apple
 *  after signing in another way. */
export async function signInWithApple(identity: AppleIdentity): Promise<SignedIn | { ok: false; reason: AppleSignInError }> {
  const result = await signInWithProvider(APPLE, identity);
  if (result.ok) return result;
  if (result.reason === "inactive") return { ok: false, reason: "inactive" };
  return { ok: false, reason: identity.privateEmail ? "apple_private" : "apple_unknown" };
}

export async function connectApple(me: Volunteer, identity: AppleIdentity): Promise<"connected" | "apple_taken" | "apple_exists"> {
  const outcome = await connectProvider(APPLE, me, identity);
  return outcome === "connected" ? outcome : `apple_${outcome}`;
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
