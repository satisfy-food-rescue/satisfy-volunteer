// What a volunteer can change, shared by the web server actions
// (src/app/app/actions.ts) and the native app's route handlers
// (src/app/api/mobile). Each takes the signed-in volunteer first; callers
// authenticate. Messages are written for the volunteer and shown as is.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { addMonths, daysBetween, isoToDate, todayISO, dateToISO } from "./dates";
import { ABSENCE_REASON_LABEL, fullName, type AbsenceReason } from "./domain";
import { eligibilityFor } from "./training";
import { shiftById } from "./roster";
import { afterShiftReleased } from "./cover";
import { trainingContext } from "./volunteer-data";
import { queueEmail } from "./emails";
import * as T from "./email-templates";

/** `notFound` lets the API answer 404 instead of 422; the web ignores it. */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string; notFound?: true };

function revalidateAll() {
  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");
}

export async function bookShift(me: Volunteer, shiftId: string): Promise<ActionResult> {
  const view = await shiftById(shiftId);
  if (!view) return { ok: false, error: "That shift no longer exists.", notFound: true };
  const today = todayISO();
  if (view.iso < today) return { ok: false, error: "That shift has already happened." };
  if (view.shift.status !== "SCHEDULED") return { ok: false, error: "That shift has been cancelled." };
  if (view.confirmed.some((a) => a.volunteerId === me.id)) return { ok: false, error: "You are already on this shift." };
  const { statuses } = await trainingContext(me, today);
  const elig = eligibilityFor(me, view.kind, statuses);
  if (!elig.eligible) return { ok: false, error: elig.reason ?? "You are not eligible for this shift yet." };
  if (view.isFull) return { ok: false, error: "This shift is full." };
  const sameDay = await db.assignment.findFirst({
    where: { volunteerId: me.id, status: "CONFIRMED", shift: { date: view.shift.date } },
  });
  if (sameDay) return { ok: false, error: "You are already rostered on another shift that day." };

  const covering = view.isGap;
  await db.assignment.create({
    data: { shiftId, volunteerId: me.id, source: covering ? "COVER" : "BOOKED", status: "CONFIRMED" },
  });
  if (covering) {
    await queueEmail(me, T.coverConfirmed({ firstName: me.firstName, shiftName: view.shift.template.name, dateISO: view.iso, start: view.shift.startTime, end: view.shift.endTime, shiftId }));
  }
  revalidateAll();
  return { ok: true, message: covering ? "Ka pai, you're covering this shift." : "You're booked on." };
}

export async function cancelBooking(me: Volunteer, assignmentId: string): Promise<ActionResult> {
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, include: { shift: true } });
  if (!a || a.volunteerId !== me.id) return { ok: false, error: "Booking not found.", notFound: true };
  if (a.source === "REGULAR") return { ok: false, error: "This is your regular slot. Use Mark me away instead." };
  if (dateToISO(a.shift.date) < todayISO()) return { ok: false, error: "That shift has already happened." };
  await db.assignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });
  await afterShiftReleased(a.shiftId, `${fullName(me)} cancelled`);
  revalidateAll();
  return { ok: true, message: "Booking cancelled." };
}

export const awaySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(["HOLIDAY", "SICK", "OTHER"]),
  note: z.string().trim().max(200).optional(),
});

export async function markAway(me: Volunteer, input: z.infer<typeof awaySchema>): Promise<ActionResult> {
  const parsed = awaySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the dates and reason." };
  const { startDate, endDate, reason, note } = parsed.data;
  const today = todayISO();
  if (startDate < today) return { ok: false, error: "The start date cannot be in the past." };
  if (endDate < startDate) return { ok: false, error: "The end date must be on or after the start date." };
  if (daysBetween(startDate, endDate) > 90) return { ok: false, error: "Absences longer than 90 days: please talk to the coordinator." };

  const absence = await db.absence.create({
    data: { volunteerId: me.id, startDate: isoToDate(startDate), endDate: isoToDate(endDate), reason, note: note || null },
  });
  const affected = await db.assignment.findMany({
    where: { volunteerId: me.id, status: "CONFIRMED", shift: { date: { gte: isoToDate(startDate), lte: isoToDate(endDate) } } },
    select: { id: true, shiftId: true },
  });
  await db.assignment.updateMany({
    where: { id: { in: affected.map((a) => a.id) } },
    data: { status: "RELEASED", absenceId: absence.id },
  });
  await queueEmail(me, T.absenceConfirmed({ firstName: me.firstName, startISO: startDate, endISO: endDate, reasonLabel: ABSENCE_REASON_LABEL[reason as AbsenceReason], releasedCount: affected.length }));
  for (const a of affected) {
    await afterShiftReleased(a.shiftId, `${fullName(me)} marked away (${ABSENCE_REASON_LABEL[reason as AbsenceReason].toLowerCase()})`);
  }
  revalidateAll();
  return { ok: true, message: affected.length === 0 ? "Marked away. No regular shifts fall in that period." : `Marked away. ${affected.length} ${affected.length === 1 ? "shift" : "shifts"} released for cover.` };
}

export async function removeAbsence(me: Volunteer, absenceId: string): Promise<ActionResult> {
  const absence = await db.absence.findUnique({ where: { id: absenceId } });
  if (!absence || absence.volunteerId !== me.id) return { ok: false, error: "Absence not found.", notFound: true };
  const today = todayISO();
  // Restore released shifts that are still in the future and not yet covered.
  const released = await db.assignment.findMany({ where: { absenceId, status: "RELEASED" }, include: { shift: { include: { assignments: true } } } });
  for (const r of released) {
    const iso = dateToISO(r.shift.date);
    const covered = r.shift.assignments.some((x) => x.status === "CONFIRMED" && x.source === "COVER");
    await db.assignment.update({ where: { id: r.id }, data: iso >= today && !covered ? { status: "CONFIRMED", absenceId: null } : { status: "CANCELLED" } });
  }
  await db.absence.delete({ where: { id: absenceId } });
  revalidateAll();
  return { ok: true, message: "Absence removed. Your regular shifts are back on." };
}

export async function completeOnlineModule(me: Volunteer, moduleId: string): Promise<ActionResult> {
  const mod = await db.trainingModule.findUnique({ where: { id: moduleId } });
  if (!mod) return { ok: false, error: "Module not found.", notFound: true };
  if (mod.delivery !== "ONLINE_CONFIRM") return { ok: false, error: "This module is completed in person." };
  const today = todayISO();
  const expiresISO = mod.validityMonths ? addMonths(today, mod.validityMonths) : null;
  await db.trainingRecord.create({
    data: { volunteerId: me.id, moduleId, completedAt: isoToDate(today), expiresAt: expiresISO ? isoToDate(expiresISO) : null, method: "ONLINE" },
  });
  await queueEmail(me, T.trainingCompleted({ firstName: me.firstName, moduleName: mod.name, expiresISO }));
  revalidateAll();
  return { ok: true, message: `${mod.name} recorded. ${expiresISO ? "Next refresher in " + mod.validityMonths + " months." : ""}`.trim() };
}

export const rsvpSchema = z.object({ going: z.boolean() });

export async function rsvpSession(me: Volunteer, sessionId: string, going: boolean): Promise<ActionResult> {
  const session = await db.trainingSession.findUnique({ where: { id: sessionId }, include: { module: true, rsvps: true } });
  if (!session) return { ok: false, error: "Session not found.", notFound: true };
  if (going && session.rsvps.filter((r) => r.status === "GOING" && r.volunteerId !== me.id).length >= session.capacity) {
    return { ok: false, error: "This session is full. The coordinator will schedule another." };
  }
  await db.sessionRsvp.upsert({
    where: { sessionId_volunteerId: { sessionId, volunteerId: me.id } },
    create: { sessionId, volunteerId: me.id, status: going ? "GOING" : "DECLINED" },
    update: { status: going ? "GOING" : "DECLINED" },
  });
  if (going) {
    await queueEmail(me, T.sessionConfirmed({ firstName: me.firstName, moduleName: session.module.name, startsAt: session.startsAt, location: session.location }));
  }
  revalidateAll();
  return { ok: true, message: going ? "You're booked in." : "Noted, you can't make this one." };
}

export const harvestPoolSchema = z.object({ inPool: z.boolean() });

export async function setHarvestPool(me: Volunteer, inPool: boolean): Promise<ActionResult> {
  await db.volunteer.update({ where: { id: me.id }, data: { inHarvestPool: inPool } });
  revalidateAll();
  return { ok: true, message: inPool ? "You're in the harvest pool." : "You've left the harvest pool." };
}

export async function rsvpHarvest(me: Volunteer, calloutId: string, going: boolean): Promise<ActionResult> {
  // Callouts go to the pool, so only pool members can answer them. The web
  // hides the buttons; this is the rule the API relies on.
  if (!me.inHarvestPool) return { ok: false, error: "Join the harvest pool to respond to callouts." };
  const callout = await db.harvestCallout.findUnique({ where: { id: calloutId }, select: { id: true } });
  if (!callout) return { ok: false, error: "Callout not found.", notFound: true };
  await db.harvestRsvp.upsert({
    where: { calloutId_volunteerId: { calloutId, volunteerId: me.id } },
    create: { calloutId, volunteerId: me.id, status: going ? "GOING" : "DECLINED" },
    update: { status: going ? "GOING" : "DECLINED" },
  });
  revalidateAll();
  return { ok: true, message: going ? "See you at the harvest." : "No worries, maybe next time." };
}

export const profileSchema = z.object({
  phone: z.string().trim().max(30),
  suburb: z.string().trim().max(60),
  emergencyName: z.string().trim().max(80),
  emergencyPhone: z.string().trim().max(30),
  availabilityNote: z.string().trim().max(300),
  lastMinuteOk: z.boolean(),
});

export async function updateProfile(me: Volunteer, input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const d = parsed.data;
  await db.volunteer.update({
    where: { id: me.id },
    data: { phone: d.phone || null, suburb: d.suburb || null, emergencyName: d.emergencyName || null, emergencyPhone: d.emergencyPhone || null, availabilityNote: d.availabilityNote || null, lastMinuteOk: d.lastMinuteOk },
  });
  revalidateAll();
  return { ok: true, message: "Profile saved. Contact changes sync to Infoodle overnight." };
}

export const roleRequestSchema = z.object({ message: z.string() });

export async function requestRoleChange(me: Volunteer, message: string): Promise<ActionResult> {
  const text = message.trim();
  if (text.length < 3) return { ok: false, error: "Tell the coordinator what you would like to change." };
  if (text.length > 500) return { ok: false, error: "Please keep it under 500 characters." };
  await db.contactLog.create({ data: { volunteerId: me.id, authorId: me.id, kind: "ROLE_REQUEST", summary: text } });
  await queueEmail(null, T.roleChangeRequest({ volunteerName: fullName(me), volunteerId: me.id, message: text }));
  revalidateAll();
  return { ok: true, message: "Sent to the coordinator. They will be in touch." };
}
