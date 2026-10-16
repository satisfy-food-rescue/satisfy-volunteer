"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { PASSWORD_MIN } from "@/lib/auth-shared";
import { destroyOtherSessions, hashPassword, requireVolunteer, verifyPassword } from "@/lib/session";
import { GOOGLE } from "@/lib/oauth";
import { CHALLENGE_EXPIRED, passkeyRegistrationOptions, savePasskey } from "@/lib/sign-in";
import { deviceLabel, storeChallenge, takeChallenge } from "@/lib/webauthn";
import type { ActionResult } from "@/lib/volunteer-actions";

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
  const options = await passkeyRegistrationOptions(me);
  await storeChallenge("registration", options.challenge);
  return { ok: true, options };
}

export async function finishPasskeyRegistration(response: RegistrationResponseJSON): Promise<ActionResult> {
  const me = await requireVolunteer();
  const expectedChallenge = await takeChallenge("registration");
  if (!expectedChallenge) return { ok: false, error: CHALLENGE_EXPIRED };
  const saved = await savePasskey(me, response, expectedChallenge, deviceLabel((await headers()).get("user-agent")));
  if (!saved.ok) return saved;
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
