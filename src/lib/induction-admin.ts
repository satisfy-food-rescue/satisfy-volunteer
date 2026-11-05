import "server-only";
// What coordinators change about induction: recording the Ministry of
// Justice checks they have sighted, and which roles need one. The server
// actions in src/app/admin/induction-actions.ts check requireAdmin() and pass
// the signed-in coordinator in as `actor`.
import { z } from "zod";
import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { formatDate, isoToDate, todayISO } from "./dates";
import { VOLUNTEER_ROLES, sortRoles } from "./domain";
import { mojRenewsISO } from "./induction";
import { inductionFor } from "./induction-data";
import { queueEmail } from "./emails";
import { mojCheckRecorded } from "./email-templates";
import type { ActionResult } from "./volunteer-actions";

type Actor = Pick<Volunteer, "id" | "firstName">;

export const mojCheckSchema = z.object({
  volunteerId: z.string().min(1),
  /** The date printed on the check. */
  checkedISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(300),
});

/** Records a check the coordinator has sighted. Renewal runs three years
 *  from the date on it. The volunteer is emailed to say it is done. */
export async function recordMojCheck(actor: Actor, input: z.infer<typeof mojCheckSchema>): Promise<ActionResult> {
  const parsed = mojCheckSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick the date on the check." };
  const { volunteerId, checkedISO, note } = parsed.data;
  const today = todayISO();
  if (checkedISO > today) return { ok: false, error: "The date on the check cannot be in the future." };
  const renewsISO = mojRenewsISO(checkedISO);
  const volunteer = await db.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer || volunteer.status === "DELETED") return { ok: false, error: "Volunteer not found." };
  if (renewsISO < today) return { ok: false, error: `A check dated ${formatDate(checkedISO)} ran out on ${formatDate(renewsISO)}. ${volunteer.firstName} needs a new one.` };
  await db.$transaction([
    db.mojCheck.create({ data: { volunteerId, checkedOn: isoToDate(checkedISO), recordedById: actor.id, note: note || null } }),
    db.contactLog.create({ data: { volunteerId, authorId: actor.id, kind: "MOJ_CHECK", summary: `Ministry of Justice check sighted, dated ${formatDate(checkedISO)}. Renews ${formatDate(renewsISO)}.${note ? ` ${note}` : ""}` } }),
  ]);
  if (volunteer.status === "ACTIVE") {
    const induction = await inductionFor(volunteer, today);
    await queueEmail(volunteer, mojCheckRecorded({ firstName: volunteer.firstName, checkedISO, renewsISO, inductionComplete: induction.complete }));
  }
  return { ok: true, message: `Recorded. ${volunteer.firstName}'s check renews on ${formatDate(renewsISO)}.${volunteer.status === "ACTIVE" ? ` ${volunteer.firstName} has been emailed.` : ""}` };
}

/** Takes back a check recorded by mistake (the wrong person or date). */
export async function removeMojCheck(actor: Actor, checkId: string): Promise<ActionResult> {
  const check = await db.mojCheck.findUnique({ where: { id: checkId } });
  if (!check) return { ok: false, error: "That check has already been removed." };
  await db.$transaction([
    db.mojCheck.delete({ where: { id: check.id } }),
    db.contactLog.create({ data: { volunteerId: check.volunteerId, authorId: actor.id, kind: "MOJ_CHECK", summary: `Ministry of Justice check dated ${formatDate(todayISO(check.checkedOn))} removed by ${actor.firstName}.` } }),
  ]);
  return { ok: true, message: "Check removed." };
}

export const mojRolesSchema = z.object({ roles: z.array(z.enum(VOLUNTEER_ROLES)) });

/** Which roles need a check. Turning a role on asks everyone who holds it
 *  for a check before their next training or booking. */
export async function saveMojRoles(input: z.infer<typeof mojRolesSchema>): Promise<ActionResult> {
  const parsed = mojRolesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick the roles that need a check." };
  const roles = sortRoles(parsed.data.roles);
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1, mojCheckRoles: roles }, update: { mojCheckRoles: roles } });
  return { ok: true, message: roles.length === 0 ? "No role needs a Ministry of Justice check now." : "Saved. Volunteers with those roles need a current check to train and book." };
}
