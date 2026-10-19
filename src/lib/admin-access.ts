import "server-only";
import { z } from "zod";
import { Prisma, type Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { isoToDate, todayISO } from "./dates";
import { fullName, normaliseEmail } from "./domain";
import { sendSignInLink } from "./auth";
import { afterShiftReleased } from "./cover";
import { queueEmail } from "./emails";
import { adminAccessGranted, adminAccessRemoved } from "./email-templates";
import type { ActionResult } from "./volunteer-actions";

// Who can use the coordinator admin. An admin (shown as a coordinator) is not
// in the volunteer pool: the roster, announcements, training figures and
// reports count role VOLUNTEER only. So making a volunteer an admin takes
// them off their regular slots and upcoming shifts, like deactivating does,
// and keeps their roles, training records and history, so removing the
// access again puts them back in the pool where they left off. There is
// always at least one active admin, and nobody removes their own access.
// The server actions in src/app/admin/actions.ts check requireAdmin() and
// pass the signed-in admin in as `actor`.

type Actor = Pick<Volunteer, "id" | "firstName">;

export const newAdminSchema = z.object({
  firstName: z.string().trim().min(1, "Add a first name.").max(60),
  lastName: z.string().trim().max(60),
  email: z.email("Check the email address."),
  /** Set once the coordinator has been told what making an existing
   *  volunteer an admin releases. */
  releaseConfirmed: z.boolean(),
});
export type NewAdminInput = z.infer<typeof newAdminSchema>;
type NewAdminField = "firstName" | "lastName" | "email";
const isNewAdminField = (k: unknown): k is NewAdminField => k === "firstName" || k === "lastName" || k === "email";

/** What making an existing volunteer an admin would take them off. */
export type ReleasePreview = { name: string; firstName: string; upcomingShifts: number; regularSlots: number };

/** `confirm` asks the coordinator to agree to releasing a volunteer's slots
 *  and shifts first; sending the form again with `releaseConfirmed` goes
 *  ahead. Errors about one field name it. */
export type GrantAdminResult =
  | { ok: true; message: string }
  | { ok: false; error: string; field?: NewAdminField; confirm?: ReleasePreview };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Upcoming bookings a volunteer would come off, the same set deactivating
 *  releases. */
function upcomingBookings(tx: Prisma.TransactionClient, volunteerId: string) {
  return tx.assignment.findMany({
    where: { volunteerId, status: "CONFIRMED", shift: { date: { gte: isoToDate(todayISO()) } } },
    select: { id: true, shiftId: true },
  });
}

/** Makes someone an admin: a new account (emailed an invite to set a
 *  password) or an existing volunteer, reactivated if need be. */
export async function grantAdminAccess(actor: Actor, input: NewAdminInput): Promise<GrantAdminResult> {
  const parsed = newAdminSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = issue?.path[0];
    return { ok: false, error: issue?.message ?? "Please check the form.", field: isNewAdminField(key) ? key : undefined };
  }
  const d = parsed.data;
  const email = normaliseEmail(d.email);
  const existing = await db.volunteer.findUnique({ where: { email } });
  if (!existing) return createAdmin(actor, { firstName: d.firstName, lastName: d.lastName || null, email });
  if (existing.role === "ADMIN" && existing.status === "ACTIVE") {
    return { ok: false, error: `${fullName(existing)} is already a coordinator.`, field: "email" };
  }
  return promoteToAdmin(actor, existing, d.releaseConfirmed);
}

async function createAdmin(actor: Actor, data: { firstName: string; lastName: string | null; email: string }): Promise<GrantAdminResult> {
  let admin: Volunteer;
  try {
    admin = await db.$transaction(async (tx) => {
      const created = await tx.volunteer.create({ data: { ...data, role: "ADMIN" } });
      await tx.contactLog.create({ data: { volunteerId: created.id, authorId: actor.id, kind: "ACCOUNT_CREATED", summary: `Added as a coordinator by ${actor.firstName}.` } });
      return created;
    });
  } catch (err) {
    // Someone added the same email a moment ago.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Someone with that email was just added. Check the list, then try again.", field: "email" };
    }
    throw err;
  }
  const invited = await sendSignInLink(admin, "INVITE");
  return {
    ok: true,
    message: `${fullName(admin)} is now a coordinator. ${invited ? `${admin.firstName} has been emailed a link to set up their account.` : "The invite email could not be sent: use Send invite to try again."}`,
  };
}

async function promoteToAdmin(actor: Actor, volunteer: Volunteer, releaseConfirmed: boolean): Promise<GrantAdminResult> {
  const [upcoming, regularSlots] = await Promise.all([upcomingBookings(db, volunteer.id), db.regularSlot.count({ where: { volunteerId: volunteer.id } })]);
  if ((upcoming.length > 0 || regularSlots > 0) && !releaseConfirmed) {
    return {
      ok: false,
      error: `${fullName(volunteer)} is rostered as a volunteer. Confirm to take them off their shifts.`,
      confirm: { name: fullName(volunteer), firstName: volunteer.firstName, upcomingShifts: upcoming.length, regularSlots },
    };
  }
  const reactivated = volunteer.status !== "ACTIVE";
  const released = await db.$transaction(async (tx) => {
    // Read again inside the transaction, so a booking made since the
    // confirmation is released too.
    const bookings = await upcomingBookings(tx, volunteer.id);
    const slots = await tx.regularSlot.deleteMany({ where: { volunteerId: volunteer.id } });
    await tx.assignment.updateMany({ where: { id: { in: bookings.map((b) => b.id) } }, data: { status: "CANCELLED" } });
    await tx.volunteer.update({ where: { id: volunteer.id }, data: { role: "ADMIN", status: "ACTIVE", isRegular: false } });
    const releasedText =
      bookings.length + slots.count > 0
        ? ` Removed from ${[slots.count > 0 && plural(slots.count, "regular slot", "regular slots"), bookings.length > 0 && plural(bookings.length, "upcoming shift", "upcoming shifts")].filter(Boolean).join(" and ")}.`
        : "";
    await tx.contactLog.create({
      data: { volunteerId: volunteer.id, authorId: actor.id, kind: "ADMIN_ACCESS", summary: `Made a coordinator by ${actor.firstName}.${reactivated ? " Reactivated." : ""}${releasedText}` },
    });
    return { shiftIds: [...new Set(bookings.map((b) => b.shiftId))], shifts: bookings.length, slots: slots.count };
  });
  let gaps = 0;
  for (const shiftId of released.shiftIds) if (await afterShiftReleased(shiftId, null)) gaps++;

  // Someone who has never signed in needs a way to; anyone else just hears
  // about the change.
  const hasSignedIn = Boolean(volunteer.passwordHash || volunteer.lastSignInAt);
  const admin = { ...volunteer, role: "ADMIN" as const, status: "ACTIVE" as const };
  let emailed: string;
  if (hasSignedIn) {
    await queueEmail(admin, adminAccessGranted({ firstName: volunteer.firstName, grantedBy: actor.firstName, releasedShifts: released.shifts, releasedSlots: released.slots }));
    emailed = `${volunteer.firstName} has been emailed.`;
  } else {
    emailed = (await sendSignInLink(admin, "INVITE"))
      ? `${volunteer.firstName} has been emailed a link to set up their account.`
      : "The invite email could not be sent: use Send invite to try again.";
  }
  const cover = released.shifts > 0 ? ` and has come off ${plural(released.shifts, "upcoming shift", "upcoming shifts")}${gaps > 0 ? `, ${gaps === released.shifts && gaps === 1 ? "which now needs" : `${gaps} of which now ${gaps === 1 ? "needs" : "need"}`} cover` : ""}` : "";
  return { ok: true, message: `${fullName(volunteer)} is now a coordinator${cover}. ${emailed}` };
}

/** Makes an admin a volunteer again. Refused for your own account and for
 *  the last active admin. The person stays signed in and lands in the
 *  volunteer app from their next page. */
export async function revokeAdminAccess(actor: Actor, volunteerId: string): Promise<ActionResult> {
  const id = z.string().min(1).safeParse(volunteerId);
  if (!id.success) return { ok: false, error: "Coordinator not found." };
  if (id.data === actor.id) return { ok: false, error: "You cannot remove your own coordinator access. Ask another coordinator to do it." };
  const result = await db.$transaction(async (tx) => {
    // Locks every active admin, so two removals at the same moment (two
    // coordinators removing each other) cannot leave nobody: the second
    // waits, then sees the first one's change.
    const active = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Volunteer" WHERE role = 'ADMIN' AND status = 'ACTIVE' FOR UPDATE`;
    if (!active.some((a) => a.id === actor.id)) return { ok: false, error: "Your coordinator access has changed. Reload the page." } as const;
    const target = await tx.volunteer.findUnique({ where: { id: id.data } });
    if (!target || target.role !== "ADMIN") return { ok: false, error: "That person is not a coordinator any more." } as const;
    if (!active.some((a) => a.id !== target.id)) return { ok: false, error: `${target.firstName} is the only active coordinator, so their access stays.` } as const;
    await tx.volunteer.update({ where: { id: target.id }, data: { role: "VOLUNTEER" } });
    await tx.contactLog.create({ data: { volunteerId: target.id, authorId: actor.id, kind: "ADMIN_ACCESS", summary: `Coordinator access removed by ${actor.firstName}.` } });
    return { ok: true, target } as const;
  });
  if (!result.ok) return result;
  const { target } = result;
  if (target.status === "ACTIVE") await queueEmail(target, adminAccessRemoved({ firstName: target.firstName, removedBy: actor.firstName }));
  return { ok: true, message: `${fullName(target)} is no longer a coordinator and is listed under Volunteers.${target.status === "ACTIVE" ? ` ${target.firstName} has been emailed.` : ""}` };
}
