"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { addDays, addMonths, dateToISO, isoToDate, isWeekday, nzInstant, todayISO, weekdayOf, formatDay, formatInstant } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, INITIAL_VISIT_CODE, ROLE_LABEL, VOLUNTEER_ROLES, fullName, parseRoles, type AbsenceReason } from "@/lib/domain";
import { decorateShift, shiftInclude } from "@/lib/roster";
import { moduleStatuses } from "@/lib/training";
import { runReminders } from "@/lib/reminders";
import { afterShiftReleased, runCoverChecks } from "@/lib/cover";
import { queueEmail } from "@/lib/emails";
import * as T from "@/lib/email-templates";
import type { ActionResult } from "@/lib/volunteer-actions";

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
  const a = await db.assignment.update({ where: { id: assignmentId }, data: { status: "CANCELLED" } });
  await afterShiftReleased(a.shiftId, null);
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
  const affected = await db.assignment.findMany({ where: { volunteerId, status: "CONFIRMED", shift: { date: { gte: isoToDate(startDate), lte: isoToDate(endDate) } } }, select: { id: true, shiftId: true } });
  await db.assignment.updateMany({ where: { id: { in: affected.map((a) => a.id) } }, data: { status: "RELEASED", absenceId: absence.id } });
  for (const a of affected) await afterShiftReleased(a.shiftId, null);
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

const completionSchema = z.object({
  volunteerId: z.string(),
  moduleId: z.string(),
  completedISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** The supervisor marks an in-person stage done on the day it happened, which
 *  is not always today. Expiry runs from that date. */
export async function recordCoordinatorCompletion(input: z.infer<typeof completionSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = completionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please pick a date." };
  const { volunteerId, moduleId, completedISO } = parsed.data;
  const today = todayISO();
  if (completedISO > today) return { ok: false, error: "The completion date cannot be in the future." };
  const [volunteer, mod] = await Promise.all([db.volunteer.findUnique({ where: { id: volunteerId } }), db.trainingModule.findUnique({ where: { id: moduleId } })]);
  if (!volunteer || !mod) return { ok: false, error: "Not found." };
  const expiresISO = mod.validityMonths ? addMonths(completedISO, mod.validityMonths) : null;
  await db.trainingRecord.create({ data: { volunteerId, moduleId, completedAt: isoToDate(completedISO), expiresAt: expiresISO ? isoToDate(expiresISO) : null, method: "COORDINATOR" } });
  await queueEmail(volunteer, T.trainingCompleted({ firstName: volunteer.firstName, moduleName: mod.name, completedISO: completedISO === today ? undefined : completedISO, expiresISO }));
  revalidateAll();
  return { ok: true, message: `${mod.name} recorded for ${volunteer.firstName}${completedISO === today ? "" : `, as of ${formatDay(completedISO)}`}.` };
}

export async function runRemindersNow(): Promise<ActionResult> {
  await requireAdmin();
  const r = await runReminders(todayISO());
  const c = await runCoverChecks();
  revalidateAll();
  const parts = [
    r.dueSoon + r.overdue > 0 && `${r.dueSoon} due-soon and ${r.overdue} overdue reminders`,
    c.pushes > 0 && `${c.pushes} last-minute ${c.pushes === 1 ? "notification" : "notifications"}`,
    c.escalations > 0 && `${c.escalations} uncovered shift ${c.escalations === 1 ? "alert" : "alerts"}`,
  ].filter(Boolean);
  return { ok: true, message: parts.length === 0 ? `Checked ${r.checked} training records and upcoming gaps. Nothing new to send.` : `Queued ${parts.join(", ")}.` };
}

// --- Applications ---
export async function approveApplication(id: string): Promise<ActionResult> {
  await requireAdmin();
  const app = await db.application.findUnique({ where: { id } });
  if (!app || app.status !== "PENDING") return { ok: false, error: "Application already reviewed." };
  const existing = await db.volunteer.findUnique({ where: { email: app.email } });
  if (existing) return { ok: false, error: "A volunteer with this email already exists." };
  const induction = await db.trainingSession.findFirst({ where: { startsAt: { gte: new Date() }, module: { code: INITIAL_VISIT_CODE } }, include: { rsvps: { where: { status: "GOING" } } }, orderBy: { startsAt: "asc" } });
  const volunteer = await db.volunteer.create({
    data: {
      firstName: app.firstName, lastName: app.lastName, email: app.email, phone: app.phone, suburb: app.suburb, birthYear: app.birthYear,
      roles: app.interests || "WAREHOUSE", availabilityNote: app.availability, infoodleId: app.infoodleId, infoodleSyncedAt: new Date(), joinedAt: new Date(),
    },
  });
  const visit = induction && induction.rsvps.length < induction.capacity ? induction : null;
  if (visit) {
    await db.sessionRsvp.create({ data: { sessionId: visit.id, volunteerId: volunteer.id, status: "GOING" } });
  }
  await db.application.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), volunteerId: volunteer.id } });
  await queueEmail(volunteer, T.applicationApproved({ firstName: volunteer.firstName, inductionAt: visit?.startsAt, inductionLocation: visit?.location }));
  await queueEmail(volunteer, T.welcome({ firstName: volunteer.firstName }));
  revalidateAll();
  return { ok: true, message: `${app.firstName} approved. Account created${visit ? " and pencilled into the next initial visit" : ""}.` };
}

export async function declineApplication(id: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  await db.application.update({ where: { id }, data: { status: "DECLINED", reviewedAt: new Date(), reviewNote: note.trim() || null } });
  revalidateAll();
  return { ok: true, message: "Application declined." };
}

// --- Volunteer profile (edited by the coordinator, often while on the phone) ---
export async function saveVolunteerNotes(volunteerId: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  await db.volunteer.update({ where: { id: volunteerId }, data: { notes: notes.trim() || null } });
  revalidateAll();
  return { ok: true, message: "Notes saved." };
}

const profileSchema = z.object({
  volunteerId: z.string(),
  phone: z.string().trim().max(30),
  suburb: z.string().trim().max(60),
  emergencyName: z.string().trim().max(80),
  emergencyPhone: z.string().trim().max(30),
  availabilityNote: z.string().trim().max(300),
  lastMinuteOk: z.boolean(),
  inHarvestPool: z.boolean(),
});

const PROFILE_FIELD_LABEL = {
  phone: "phone",
  suburb: "suburb",
  emergencyName: "emergency contact",
  emergencyPhone: "emergency contact phone",
  availabilityNote: "availability",
  lastMinuteOk: "last-minute cover",
  inHarvestPool: "harvest pool",
} as const;

export async function updateVolunteerProfile(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the form." };
  const { volunteerId, ...d } = parsed.data;
  const before = await db.volunteer.findUnique({ where: { id: volunteerId } });
  if (!before) return { ok: false, error: "Volunteer not found." };
  const data = {
    phone: d.phone || null,
    suburb: d.suburb || null,
    emergencyName: d.emergencyName || null,
    emergencyPhone: d.emergencyPhone || null,
    availabilityNote: d.availabilityNote || null,
    lastMinuteOk: d.lastMinuteOk,
    inHarvestPool: d.inHarvestPool,
  };
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => before[k] !== data[k]);
  if (changed.length === 0) return { ok: true, message: "Nothing changed." };
  await db.volunteer.update({ where: { id: volunteerId }, data });
  // emergencyName and emergencyPhone read as one change.
  const labels = [...new Set(changed.map((k) => PROFILE_FIELD_LABEL[k].replace(" phone", "")))];
  await db.contactLog.create({ data: { volunteerId, authorId: admin.id, kind: "PROFILE_UPDATED", summary: `Updated ${labels.join(", ")}.` } });
  revalidateAll();
  return { ok: true, message: "Profile saved. Contact changes sync to Infoodle overnight." };
}

export async function setVolunteerRoles(volunteerId: string, roles: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  const next = parseRoles(roles.join(","));
  if (next.length === 0) return { ok: false, error: "Pick at least one role." };
  const [volunteer, modules] = await Promise.all([
    db.volunteer.findUnique({ where: { id: volunteerId }, include: { trainingRecords: true } }),
    db.trainingModule.findMany(),
  ]);
  if (!volunteer) return { ok: false, error: "Volunteer not found." };
  const prev = parseRoles(volunteer.roles);
  const added = next.filter((r) => !prev.includes(r));
  const removed = prev.filter((r) => !next.includes(r));
  if (added.length + removed.length === 0) return { ok: true, message: "Roles unchanged." };
  const roles_ = VOLUNTEER_ROLES.filter((r) => next.includes(r)).join(",");
  await db.volunteer.update({ where: { id: volunteerId }, data: { roles: roles_ } });
  // Training that the new roles bring in and the volunteer does not hold yet.
  const statuses = moduleStatuses({ roles: roles_ }, modules, volunteer.trainingRecords, todayISO());
  const trainingNeeded = statuses
    .filter((s) => (s.status === "NOT_STARTED" || s.status === "OVERDUE") && parseRoles(s.module.requiredRoles).some((r) => added.includes(r)))
    .map((s) => s.module.name);
  const name = fullName(volunteer);
  const summary = [added.length && `Added ${added.map((r) => ROLE_LABEL[r]).join(", ")}`, removed.length && `Removed ${removed.map((r) => ROLE_LABEL[r]).join(", ")}`].filter(Boolean).join(". ");
  await db.contactLog.create({ data: { volunteerId, authorId: admin.id, kind: "ROLES_CHANGED", summary: `${summary}.${trainingNeeded.length ? ` Training needed: ${trainingNeeded.join(", ")}.` : ""}` } });
  await queueEmail(null, T.rolesChanged({ volunteerName: name, volunteerId, changedBy: fullName(admin), added: added.map((r) => ROLE_LABEL[r]), removed: removed.map((r) => ROLE_LABEL[r]), trainingNeeded }));
  revalidateAll();
  return { ok: true, message: `Roles updated. The volunteer coordinator has been emailed${trainingNeeded.length ? `; ${trainingNeeded.length} training ${trainingNeeded.length === 1 ? "module is" : "modules are"} now needed` : ""}.` };
}

const contactSchema = z.object({
  volunteerId: z.string(),
  kind: z.enum(["CALL", "NOTE"]),
  summary: z.string().trim().min(2).max(1000),
});

export async function logContact(input: z.infer<typeof contactSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a short summary first." };
  await db.contactLog.create({ data: { ...parsed.data, authorId: admin.id } });
  revalidateAll();
  return { ok: true, message: parsed.data.kind === "CALL" ? "Call logged." : "Note added." };
}

// --- Initial visit: booked by the coordinator, usually during the welcome call ---
const visitSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), volunteerId: z.string(), sessionId: z.string() }),
  z.object({
    mode: z.literal("new"),
    volunteerId: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    location: z.string().trim().min(2).max(120),
  }),
]);

export async function bookInitialVisit(input: z.infer<typeof visitSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = visitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the visit details." };
  const d = parsed.data;
  const [volunteer, mod] = await Promise.all([
    db.volunteer.findUnique({ where: { id: d.volunteerId } }),
    db.trainingModule.findUnique({ where: { code: INITIAL_VISIT_CODE } }),
  ]);
  if (!volunteer || !mod) return { ok: false, error: "Not found." };

  let session;
  if (d.mode === "existing") {
    session = await db.trainingSession.findUnique({ where: { id: d.sessionId }, include: { rsvps: { where: { status: "GOING" } } } });
    if (!session || session.moduleId !== mod.id) return { ok: false, error: "That visit time no longer exists." };
    if (session.startsAt < new Date()) return { ok: false, error: "That visit time has passed." };
    if (session.rsvps.filter((r) => r.volunteerId !== volunteer.id).length >= session.capacity) return { ok: false, error: "That time is full. Pick another or set a new time." };
  } else {
    if (d.endTime <= d.startTime) return { ok: false, error: "End time must be after the start time." };
    const startsAt = nzInstant(d.date, d.startTime);
    if (startsAt < new Date()) return { ok: false, error: "The visit must be in the future." };
    // Visits are arranged one-to-one, so a new time holds one place.
    session = await db.trainingSession.create({ data: { moduleId: mod.id, startsAt, endsAt: nzInstant(d.date, d.endTime), location: d.location, capacity: 1, notes: `Arranged with ${volunteer.firstName} by ${admin.firstName}.` } });
  }

  // One upcoming initial visit at a time: moving it releases the old place.
  await db.sessionRsvp.updateMany({
    where: { volunteerId: volunteer.id, status: "GOING", sessionId: { not: session.id }, session: { moduleId: mod.id, startsAt: { gte: new Date() } } },
    data: { status: "DECLINED" },
  });
  await db.sessionRsvp.upsert({
    where: { sessionId_volunteerId: { sessionId: session.id, volunteerId: volunteer.id } },
    create: { sessionId: session.id, volunteerId: volunteer.id, status: "GOING" },
    update: { status: "GOING" },
  });
  await db.contactLog.create({ data: { volunteerId: volunteer.id, authorId: admin.id, kind: "VISIT_BOOKED", summary: `${formatInstant(session.startsAt)} at ${session.location}.` } });
  await queueEmail(volunteer, T.initialVisitBooked({ firstName: volunteer.firstName, startsAt: session.startsAt, location: session.location, bookedBy: admin.firstName }));
  revalidateAll();
  return { ok: true, message: `Initial visit booked for ${formatInstant(session.startsAt)}. ${volunteer.firstName} has been emailed.` };
}

// --- Shift types ---
const shiftTypeSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(2).max(80),
  workingWith: z.string().trim().max(80),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().min(1).max(40),
  needed: z.number().int().min(1).max(40),
  lastMinuteHours: z.number().int().min(0).max(168),
  escalateHours: z.number().int().min(0).max(168),
});

/** Changes apply to shifts scheduled from now on; existing shifts keep their
 *  times and crew sizes so nobody's booking moves under them. */
export async function updateShiftType(input: z.infer<typeof shiftTypeSchema>): Promise<ActionResult> {
  await requireAdmin();
  const parsed = shiftTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the shift type settings." };
  const { id, workingWith, ...d } = parsed.data;
  if (d.endTime <= d.startTime) return { ok: false, error: "End time must be after the start time." };
  if (d.needed > d.capacity) return { ok: false, error: "Minimum crew cannot be more than the maximum." };
  if (d.lastMinuteHours > 0 && d.escalateHours > d.lastMinuteHours) return { ok: false, error: "The coordinator alert should come after the last-minute notification: use fewer hours before the start." };
  await db.shiftTemplate.update({ where: { id }, data: { ...d, workingWith: workingWith || null } });
  revalidateAll();
  return { ok: true, message: "Shift type saved." };
}
