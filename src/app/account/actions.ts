"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { fullName } from "@/lib/domain";
import { PASSWORD_MIN } from "@/lib/auth-shared";
import { destroyOtherSessions, hashPassword, requireVolunteer, verifyPassword } from "@/lib/session";
import { GOOGLE } from "@/lib/oauth";
import { RP_NAME, deviceLabel, rpID, rpOrigin, storeChallenge, takeChallenge } from "@/lib/webauthn";
import type { ActionResult } from "@/app/app/actions";

// Self-service sign-in settings, shared by /app/security and /admin/security.

function revalidate() {
  revalidatePath("/app/security");
  revalidatePath("/admin/security");
}

const passwordSchema = z
  .object({
    current: z.string().optional(),
    password: z.string().min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`).max(200, "That is too long."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "The two new passwords do not match.", path: ["confirm"] });

export async function changePassword(input: z.infer<typeof passwordSchema>): Promise<ActionResult> {
  const me = await requireVolunteer();
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  if (me.passwordHash && !(await verifyPassword(parsed.data.current ?? "", me.passwordHash))) {
    return { ok: false, error: "Your current password is not right." };
  }
  await db.volunteer.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  const others = await destroyOtherSessions(me.id, true);
  revalidate();
  return { ok: true, message: `Password ${me.passwordHash ? "changed" : "set"}.${others ? " Other devices have been signed out." : ""}` };
}

export type RegistrationBegin = { ok: true; options: PublicKeyCredentialCreationOptionsJSON } | { ok: false; error: string };

export async function beginPasskeyRegistration(): Promise<RegistrationBegin> {
  const me = await requireVolunteer();
  const existing = await db.passkey.findMany({ where: { volunteerId: me.id }, select: { credentialId: true, transports: true } });
  const options = await generateRegistrationOptions({
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
  await storeChallenge("registration", options.challenge);
  return { ok: true, options };
}

export async function finishPasskeyRegistration(response: RegistrationResponseJSON): Promise<ActionResult> {
  const me = await requireVolunteer();
  const expectedChallenge = await takeChallenge("registration");
  if (!expectedChallenge) return { ok: false, error: "That took too long. Please try again." };
  let verification;
  try {
    verification = await verifyRegistrationResponse({ response, expectedChallenge, expectedOrigin: rpOrigin(), expectedRPID: rpID(), requireUserVerification: false });
  } catch (err) {
    console.error("[passkey] registration verification failed", err);
    return { ok: false, error: "We could not save that passkey. Please try again." };
  }
  if (!verification.verified) return { ok: false, error: "We could not save that passkey. Please try again." };
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const userAgent = (await headers()).get("user-agent");
  await db.passkey.create({
    data: {
      volunteerId: me.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: deviceLabel(userAgent),
    },
  });
  revalidate();
  return { ok: true, message: "Passkey added. Next time, tap “Sign in with a passkey”." };
}

export async function removePasskey(id: string): Promise<ActionResult> {
  const me = await requireVolunteer();
  const { count } = await db.passkey.deleteMany({ where: { id, volunteerId: me.id } });
  if (count === 0) return { ok: false, error: "That passkey has already been removed." };
  revalidate();
  return { ok: true, message: "Passkey removed. You may also want to delete it from the device." };
}

export async function disconnectGoogle(): Promise<ActionResult> {
  const me = await requireVolunteer();
  await db.oAuthAccount.deleteMany({ where: { volunteerId: me.id, provider: GOOGLE } });
  revalidate();
  return { ok: true, message: "Google disconnected." };
}

export async function signOutOtherDevices(): Promise<ActionResult> {
  const me = await requireVolunteer();
  const count = await destroyOtherSessions(me.id, true);
  revalidate();
  return { ok: true, message: count === 0 ? "You were not signed in anywhere else." : `Signed out of ${count} other ${count === 1 ? "device" : "devices"}.` };
}
