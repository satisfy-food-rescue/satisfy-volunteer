"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { addDays, addMonths, dateToISO, isoToDate, isWeekday, todayISO, weekdayOf, formatDay } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, type AbsenceReason } from "@/lib/domain";
import { decorateShift, shiftInclude } from "@/lib/roster";
import { runReminders } from "@/lib/reminders";
import { queueEmail } from "@/lib/emails";
import * as T from "@/lib/email-templates";
import type { ActionResult } from "@/app/app/actions";

function revalidateAll() {
  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");
}

// --- Bulk scheduling (mirrors the Fair Food pattern: dry run, then commit) ---
const bulkSchema = z.object({
  templateIds: z.array(z.string()).min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekdays: z.array(z.number().int().min(1).max(5)).min(1),
  assignRegulars: z.boolean(),
  dryRun: z.boolean(),
});

export type BulkPreviewRow = { templateId: string; templateName: string; iso: string; exists: boolean; regulars: number };
export type BulkResult =
  | { ok: true; committed: false; rows: BulkPreviewRow[]; toCreate: number; skipped: number; assignments: number }
  | { ok: true; committed: true; created: number; assignments: number }
  | { ok: false; error: string };

export async function bulkSchedule(input: z.infer<typeof bulkSchema>): Promise<BulkResult> {
  await requireAdmin();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const { templateIds, startDate, endDate, weekdays, assignRegulars, dryRun } = parsed.data;
  if (endDate < startDate) return { ok: false, error: "End date must be after the start date." };
  if (isoToDate(endDate).getTime() - isoToDate(startDate).getTime() > 120 * 86_400_000) return { ok: false, error: "Schedule at most four months at a time." };
  const templates = await db.shiftTemplate.findMany({ where: { id: { in: templateIds }, active: true }, include: { regularSlots: true } });
  const existing = await db.shift.findMany({
    where: { templateId: { in: templateIds }, date: { gte: isoToDate(startDate), lte: isoToDate(endDate) } },
    select: { templateId: true, date: true },
  });
  const existsKey = new Set(existing.map((e) => `${e.templateId}:${dateToISO(e.date)}`));
  const rows: BulkPreviewRow[] = [];
  for (let d = startDate; d <= endDate; d = addDays(d, 1)) {
    if (!isWeekday(d)) continue;
    const wd = weekdayOf(d);
    if (!weekdays.includes(wd)) continue;
    for (const t of templates) {
      rows.push({ templateId: t.id, templateName: t.name, iso: d, exists: existsKey.has(`${t.id}:${d}`), regulars: assignRegulars ? t.regularSlots.filter((s) => s.weekday === wd).length : 0 });
    }
  }
  const toCreate = rows.filter((r) => !r.exists);
  const assignments = toCreate.reduce((n, r) => n + r.regulars, 0);
  if (dryRun) return { ok: true, committed: false, rows, toCreate: toCreate.length, skipped: rows.length - toCreate.length, assignments };

  let created = 0;
  let createdAssignments = 0;
  for (const r of toCreate) {
    const t = templates.find((x) => x.id === r.templateId)!;
    const shift = await db.shift.create({ data: { templateId: t.id, date: isoToDate(r.iso), startTime: t.startTime, endTime: t.endTime, capacity: t.capacity, needed: t.needed } });
    created++;
    if (assignRegulars) {
      const wd = weekdayOf(r.iso);
      const slots = t.regularSlots.filter((s) => s.weekday === wd);
      if (slots.length) {
        await db.assignment.createMany({ data: slots.map((s) => ({ shiftId: shift.id, volunteerId: s.volunteerId, source: "REGULAR", status: "CONFIRMED" })) });
        createdAssignments += slots.length;
      }
    }
  }
  revalidateAll();
  return { ok: true, committed: true, created, assignments: createdAssignments };
}

// --- Shift management ---
export async function setAttendance(assignmentId: string, status: "ATTENDED" | "NO_SHOW" | "CONFIRMED"): Promise<ActionResult> {
  await requireAdmin();
  await db.assignment.update({ where: { id: assignmentId }, data: { status } });
  revalidateAll();
  return { ok: true, message: status === "ATTENDED" ? "Marked attended." : status === "NO_SHOW" ? "Marked as no-show." : "Attendance cleared." };
}

export async function removeFromShift(assignmentId: string): Promise<ActionResult> {
  await requireAdmin();
  await db.assignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });
  revalidateAll();
  return { ok: true, message: "Removed from shift." };
}

export async function addToShift(shiftId: string, volunteerId: string): Promise<ActionResult> {
  await requireAdmin();
  const shift = await db.shift.findUnique({ where: { id: shiftId }, include: shiftInclude });
  const volunteer = await db.volunteer.findUnique({ where: { id: volunteerId } });
  if (!shift || !volunteer) return { ok: false, error: "Not found." };
  const view = decorateShift(shift);
  if (view.confirmed.some((a) => a.volunteerId === volunteerId)) return { ok: false, error: "Already on this shift." };
  const covering = view.isGap;
  await db.assignment.create({ data: { shiftId, volunteerId, source: covering ? "COVER" : "ADMIN", status: "CONFIRMED" } });
  if (covering) {
    await queueEmail(volunteer, T.coverConfirmed({ firstName: volunteer.firstName, shiftName: shift.template.name, dateISO: view.iso, start: shift.startTime, end: shift.endTime, shiftId }));
  }
  revalidateAll();
  return { ok: true, message: `${volunteer.firstName} added${covering ? " and the gap is covered" : ""}.` };
}

export async function cancelShift(shiftId: string): Promise<ActionResult> {
  await requireAdmin();
  await db.shift.update({ where: { id: shiftId }, data: { status: "CANCELLED" } });
  revalidateAll();
  return { ok: true, message: "Shift cancelled." };
}

// --- Absences on behalf of a volunteer ---
const absenceSchema = z.object({
  volunteerId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.enum(["HOLIDAY", "SICK", "OTHER"]),
  note: z.string().trim().max(200).optional(),
});

export async function recordAbsence(input: z.infer<typeof absenceSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const { volunteerId, startDate, endDate, reason, note } = parsed.data;
  if (endDate < startDate) return { ok: false, error: "End date must be on or after the start." };
  const volunteer = await db.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer) return { ok: false, error: "Volunteer not found." };
  const absence = await db.absence.create({ data: { volunteerId, startDate: isoToDate(startDate), endDate: isoToDate(endDate), reason, note: note || null } });
  const affected = await db.assignment.findMany({ where: { volunteerId, status: "CONFIRMED", shift: { date: { gte: isoToDate(startDate), lte: isoToDate(endDate) } } }, select: { id: true } });
  await db.assignment.updateMany({ where: { id: { in: affected.map((a) => a.id) } }, data: { status: "RELEASED", absenceId: absence.id } });
  await queueEmail(volunteer, T.absenceConfirmed({ firstName: volunteer.firstName, startISO: startDate, endISO: endDate, reasonLabel: ABSENCE_REASON_LABEL[reason as AbsenceReason], releasedCount: affected.length }));
  revalidateAll();
  return { ok: true, message: `${volunteer.firstName} marked away. ${affected.length} ${affected.length === 1 ? "shift" : "shifts"} released.` };
}

// --- Training ---
export async function markSessionAttendance(rsvpId: string, attended: boolean): Promise<ActionResult> {
  await requireAdmin();
  const rsvp = await db.sessionRsvp.findUnique({ where: { id: rsvpId }, include: { session: { include: { module: true } }, volunteer: true } });
  if (!rsvp) return { ok: false, error: "RSVP not found." };
  const sessionISO = todayISO(rsvp.session.startsAt);
  if (attended) {
    await db.sessionRsvp.update({ where: { id: rsvpId }, data: { attendedAt: new Date() } });
    const expiresISO = rsvp.session.module.validityMonths ? addMonths(sessionISO, rsvp.session.module.validityMonths) : null;
    await db.trainingRecord.create({ data: { volunteerId: rsvp.volunteerId, moduleId: rsvp.session.moduleId, completedAt: isoToDate(sessionISO), expiresAt: expiresISO ? isoToDate(expiresISO) : null, method: "SESSION", sessionId: rsvp.sessionId } });
    await queueEmail(rsvp.volunteer, T.trainingCompleted({ firstName: rsvp.volunteer.firstName, moduleName: rsvp.session.module.name, expiresISO }));
    revalidateAll();
    return { ok: true, message: `${rsvp.volunteer.firstName} marked attended. Record set${expiresISO ? `, next due ${formatDay(expiresISO)}` : ""}.` };
  }
  await db.sessionRsvp.update({ where: { id: rsvpId }, data: { attendedAt: null } });
  await db.trainingRecord.deleteMany({ where: { volunteerId: rsvp.volunteerId, sessionId: rsvp.sessionId } });
  revalidateAll();
  return { ok: true, message: "Attendance cleared." };
}

const sessionSchema = z.object({
  moduleId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().min(2).max(120),
  capacity: z.number().int().min(1).max(60),
  notes: z.string().trim().max(300).optional(),
});

export async function createSession(input: z.infer<typeof sessionSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the session details." };
  const d = parsed.data;
  if (d.endTime <= d.startTime) return { ok: false, error: "End time must be after the start time." };
  const { nzInstant } = await import("@/lib/dates");
  await db.trainingSession.create({ data: { moduleId: d.moduleId, startsAt: nzInstant(d.date, d.startTime), endsAt: nzInstant(d.date, d.endTime), location: d.location, capacity: d.capacity, notes: d.notes || null } });
  revalidateAll();
  return { ok: true, message: "Session scheduled." };
}

const moduleSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(80),
  validityMonths: z.number().int().min(1).max(60).nullable(),
  requiredRoles: z.array(z.enum(["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"])).min(1),
  mandatoryBeforeFirstShift: z.boolean(),
  delivery: z.enum(["IN_PERSON", "ONLINE_CONFIRM"]),
});

export async function updateModule(input: z.infer<typeof moduleSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the module settings." };
  const d = parsed.data;
  await db.trainingModule.update({ where: { id: d.id }, data: { name: d.name, validityMonths: d.validityMonths, requiredRoles: d.requiredRoles.join(","), mandatoryBeforeFirstShift: d.mandatoryBeforeFirstShift, delivery: d.delivery } });
  revalidateAll();
  return { ok: true, message: "Module saved." };
}

export async function recordCoordinatorCompletion(volunteerId: string, moduleId: string): Promise<ActionResult> {
  await requireAdmin();
  const [volunteer, mod] = await Promise.all([db.volunteer.findUnique({ where: { id: volunteerId } }), db.trainingModule.findUnique({ where: { id: moduleId } })]);
  if (!volunteer || !mod) return { ok: false, error: "Not found." };
  const today = todayISO();
  const expiresISO = mod.validityMonths ? addMonths(today, mod.validityMonths) : null;
  await db.trainingRecord.create({ data: { volunteerId, moduleId, completedAt: isoToDate(today), expiresAt: expiresISO ? isoToDate(expiresISO) : null, method: "COORDINATOR" } });
  await queueEmail(volunteer, T.trainingCompleted({ firstName: volunteer.firstName, moduleName: mod.name, expiresISO }));
  revalidateAll();
  return { ok: true, message: `${mod.name} recorded for ${volunteer.firstName}.` };
}

export async function runRemindersNow(): Promise<ActionResult> {
  await requireAdmin();
  const r = await runReminders(todayISO());
  revalidateAll();
  return { ok: true, message: r.dueSoon + r.overdue === 0 ? `Checked ${r.checked} records. Nothing new to send today.` : `Queued ${r.dueSoon} due-soon and ${r.overdue} overdue reminders.` };
}

// --- Applications ---
export async function approveApplication(id: string): Promise<ActionResult> {
  await requireAdmin();
  const app = await db.application.findUnique({ where: { id } });
  if (!app || app.status !== "PENDING") return { ok: false, error: "Application already reviewed." };
  const existing = await db.volunteer.findUnique({ where: { email: app.email } });
  if (existing) return { ok: false, error: "A volunteer with this email already exists." };
  const induction = await db.trainingSession.findFirst({ where: { startsAt: { gte: new Date() }, module: { code: "INDUCTION" } }, orderBy: { startsAt: "asc" } });
  const volunteer = await db.volunteer.create({
    data: {
      firstName: app.firstName, lastName: app.lastName, email: app.email, phone: app.phone, suburb: app.suburb, birthYear: app.birthYear,
      roles: app.interests || "WAREHOUSE", availabilityNote: app.availability, infoodleId: app.infoodleId, infoodleSyncedAt: new Date(), joinedAt: new Date(),
    },
  });
  if (induction) {
    await db.sessionRsvp.create({ data: { sessionId: induction.id, volunteerId: volunteer.id, status: "GOING" } });
  }
  await db.application.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), volunteerId: volunteer.id } });
  await queueEmail(volunteer, T.applicationApproved({ firstName: volunteer.firstName, inductionAt: induction?.startsAt, inductionLocation: induction?.location }));
  await queueEmail(volunteer, T.welcome({ firstName: volunteer.firstName }));
  revalidateAll();
  return { ok: true, message: `${app.firstName} approved. Account created${induction ? " and pencilled into the next induction" : ""}.` };
}

export async function declineApplication(id: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  await db.application.update({ where: { id }, data: { status: "DECLINED", reviewedAt: new Date(), reviewNote: note.trim() || null } });
  revalidateAll();
  return { ok: true, message: "Application declined." };
}

// --- Volunteer notes ---
export async function saveVolunteerNotes(volunteerId: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  await db.volunteer.update({ where: { id: volunteerId }, data: { notes: notes.trim() || null } });
  revalidateAll();
  return { ok: true, message: "Notes saved." };
}

export async function setVolunteerRoles(volunteerId: string, roles: string[]): Promise<ActionResult> {
  await requireAdmin();
  const valid = roles.filter((r) => ["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"].includes(r));
  if (valid.length === 0) return { ok: false, error: "Pick at least one role." };
  await db.volunteer.update({ where: { id: volunteerId }, data: { roles: valid.join(",") } });
  revalidateAll();
  return { ok: true, message: "Roles updated." };
}
