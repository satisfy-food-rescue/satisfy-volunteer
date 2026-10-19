"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { moduleParagraphs } from "@satisfy/core/training";
import { requireAdmin } from "@/lib/session";
import { addDays, addMonths, dateToISO, isoToDate, isWeekday, nzInstant, todayISO, weekdayOf, formatDay, formatInstant, formatTimeRange } from "@/lib/dates";
import { ABSENCE_REASON_LABEL, INITIAL_VISIT_CODE, ROLE_LABEL, VOLUNTEER_ROLES, fullName, isAdHocKind, normaliseEmail, sortRoles } from "@/lib/domain";
import { sendSignInLink } from "@/lib/auth";
import { grantAdminAccess, revokeAdminAccess, type GrantAdminResult, type NewAdminInput } from "@/lib/admin-access";
import { shiftById } from "@/lib/roster";
import { sendShiftCallout } from "@/lib/callouts";
import { announcementSchema, audienceSchema, resolveAudience, sendAnnouncement, type AnnouncementInput, type AudienceInput } from "@/lib/announcements";
import { moduleStatuses } from "@/lib/training";
import { runReminders, runShiftReminders } from "@/lib/reminders";
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
  // Ad hoc kinds (harvests) are created one at a time, never in bulk.
  const templates = (await db.shiftTemplate.findMany({ where: { id: { in: templateIds }, active: true }, include: { regularSlots: true } })).filter((t) => !isAdHocKind(t.kind));
  if (templates.length === 0) return { ok: false, error: "Pick at least one weekly shift type." };
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
    const shift = await db.shift.create({ data: { templateId: t.id, date: isoToDate(r.iso), startTime: t.startTime, endTime: t.endTime, capacity: t.capacity, needed: t.needed, publishedAt: new Date() } });
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

/** The volunteer gets an email and a push, so a booking made over the phone
 *  is in writing and on their phone. */
export async function addToShift(shiftId: string, volunteerId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const [view, volunteer] = await Promise.all([shiftById(shiftId), db.volunteer.findUnique({ where: { id: volunteerId } })]);
  if (!view || !volunteer) return { ok: false, error: "Not found." };
  if (view.shift.status !== "SCHEDULED") return { ok: false, error: "That shift is cancelled." };
  if (view.confirmed.some((a) => a.volunteerId === volunteerId)) return { ok: false, error: "Already on this shift." };
  const covering = view.isGap;
  const a = await db.assignment.create({ data: { shiftId, volunteerId, source: covering ? "COVER" : "ADMIN", status: "CONFIRMED" } });
  const p = { firstName: volunteer.firstName, shiftName: view.name, dateISO: view.iso, start: view.shift.startTime, end: view.shift.endTime, location: view.location, shiftId, addedBy: admin.firstName, covering };
  await queueEmail(volunteer, T.shiftAdded(p), `added:${a.id}`);
  await queueEmail(volunteer, T.shiftAddedPush(p), `added:${a.id}`);
  revalidateAll();
  return { ok: true, message: `${volunteer.firstName} added${covering ? " and the gap is covered" : ""}. They have been emailed and sent a push notification.` };
}

// --- One-off shifts: harvests, extra sorting mornings. Draft first if needed ---
const time = z.string().regex(/^\d{2}:\d{2}$/);
const shiftFormSchema = z.object({
  /** Set when editing. */
  id: z.string().optional(),
  templateId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: time,
  endTime: time,
  title: z.string().trim().max(80),
  location: z.string().trim().max(160),
  notes: z.string().trim().max(1000),
  capacity: z.number().int().min(1).max(60),
  needed: z.number().int().min(1).max(60),
  /** Save as a draft (false) or make it visible and bookable (true). */
  publish: z.boolean(),
  /** On publishing, email and push everyone who holds the role. */
  callout: z.boolean(),
});
export type ShiftFormInput = z.infer<typeof shiftFormSchema>;
/** Errors about one field name it, so the form can show them beside it. */
export type ShiftFormResult = ActionResult & { id?: string; field?: keyof ShiftFormInput };

export async function saveShift(input: ShiftFormInput): Promise<ShiftFormResult> {
  await requireAdmin();
  const parsed = shiftFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the shift details." };
  const d = parsed.data;
  if (d.endTime <= d.startTime) return { ok: false, error: "End time must be after the start time.", field: "endTime" };
  if (d.needed > d.capacity) return { ok: false, error: "Pickers needed cannot be more than the maximum.", field: "needed" };
  if (d.date < todayISO()) return { ok: false, error: "The date cannot be in the past.", field: "date" };
  const template = await db.shiftTemplate.findUnique({ where: { id: d.templateId } });
  if (!template || !template.active) return { ok: false, error: "That shift type is no longer available." };
  // A draft can be rough; a published harvest goes out in a callout.
  if (d.publish && template.kind === "HARVEST" && (!d.title || !d.location)) return { ok: false, error: "Add what's being picked and where before publishing.", field: !d.title ? "title" : "location" };
  const before = d.id ? await shiftById(d.id, { drafts: true }) : null;
  if (d.id && !before) return { ok: false, error: "That shift no longer exists." };
  if (before?.shift.status === "CANCELLED") return { ok: false, error: "That shift is cancelled." };
  if (before && d.capacity < before.confirmedCount) return { ok: false, error: `${before.confirmedCount} people are already on it, so the maximum cannot be lower than that.`, field: "capacity" };
  if (before && before.shift.status === "SCHEDULED" && !d.publish) return { ok: false, error: "A published shift cannot go back to draft. Cancel it instead." };

  const publishing = d.publish && before?.shift.status !== "SCHEDULED";
  const data = {
    templateId: d.templateId,
    date: isoToDate(d.date),
    startTime: d.startTime,
    endTime: d.endTime,
    title: d.title || null,
    location: d.location || null,
    notes: d.notes || null,
    capacity: d.capacity,
    needed: d.needed,
    status: d.publish ? ("SCHEDULED" as const) : ("DRAFT" as const),
    ...(publishing ? { publishedAt: new Date() } : {}),
  };
  const shift = before ? await db.shift.update({ where: { id: before.shift.id }, data }) : await db.shift.create({ data });
  let told = 0;
  if (publishing && d.callout) {
    const view = await shiftById(shift.id);
    if (view) told = await sendShiftCallout(view);
  }
  revalidateAll();
  const message = !d.publish
    ? "Saved as a draft. Only coordinators can see it."
    : publishing
      ? `Published.${d.callout ? ` ${told} ${told === 1 ? "volunteer has" : "volunteers have"} been emailed and sent a push notification.` : " Volunteers can now see and book it."}`
      : before && before.confirmedCount > 0
        ? "Saved. Use Message crew to tell the people booked on it what changed."
        : "Saved.";
  return { ok: true, message, id: shift.id };
}

/** Publishes a draft as it stands, from the shift page. */
export async function publishShift(shiftId: string, callout: boolean): Promise<ActionResult> {
  await requireAdmin();
  const view = await shiftById(shiftId, { drafts: true });
  if (!view) return { ok: false, error: "That shift no longer exists." };
  if (!view.isDraft) return { ok: false, error: "That shift is already published." };
  if (view.iso < todayISO()) return { ok: false, error: "That date has passed. Edit the draft to move it first." };
  const { count } = await db.shift.updateMany({ where: { id: shiftId, status: "DRAFT" }, data: { status: "SCHEDULED", publishedAt: new Date() } });
  if (count === 0) return { ok: false, error: "That shift is already published." };
  let told = 0;
  if (callout) {
    const published = await shiftById(shiftId);
    if (published) told = await sendShiftCallout(published);
  }
  revalidateAll();
  return { ok: true, message: callout ? `Published. ${told} ${told === 1 ? "volunteer has" : "volunteers have"} been emailed and sent a push notification.` : "Published. Volunteers can now see and book it." };
}

export async function deleteDraftShift(shiftId: string): Promise<ActionResult> {
  await requireAdmin();
  const { count } = await db.shift.deleteMany({ where: { id: shiftId, status: "DRAFT" } });
  if (count === 0) return { ok: false, error: "Only drafts can be deleted. Cancel a published shift instead." };
  revalidateAll();
  return { ok: true, message: "Draft deleted." };
}

// --- Announcements ---
export async function previewAudience(target: AudienceInput): Promise<{ ok: true; label: string; count: number; names: string[] } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = audienceSchema.safeParse(target);
  if (!parsed.success) return { ok: false, error: "Pick who it goes to." };
  const r = await resolveAudience(parsed.data);
  if (!r) return { ok: false, error: "That shift no longer exists." };
  return { ok: true, label: r.label, count: r.recipients.length, names: r.recipients.slice(0, 8).map((v) => fullName(v)) };
}

export async function sendAnnouncementAction(input: AnnouncementInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Add a subject and a message of at least a sentence." };
  const r = await sendAnnouncement(admin, parsed.data);
  if (!r.ok) return r;
  revalidateAll();
  return { ok: true, message: `Sent to ${r.count} ${r.count === 1 ? "volunteer" : "volunteers"}${parsed.data.push ? ", by email and push notification" : " by email"}.` };
}

const cancelSchema = z.object({
  shiftId: z.string(),
  reason: z.string().trim().max(200),
});

/** Everyone still booked on the shift gets an email (reaches volunteers
 *  without the app and carries the reason) and a push to their phone, since
 *  the shift may be hours away. Each is logged on their contact timeline. */
export async function cancelShift(input: z.infer<typeof cancelSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Keep the reason under 200 characters." };
  const { shiftId } = parsed.data;
  const reason = parsed.data.reason || undefined;
  const view = await shiftById(shiftId, { drafts: true });
  if (!view) return { ok: false, error: "Shift not found." };
  if (view.isDraft) return { ok: false, error: "Drafts are deleted, not cancelled." };
  if (view.iso < todayISO()) return { ok: false, error: "That shift has already happened." };
  // Conditional so two coordinators cancelling at once notify volunteers once.
  const { count } = await db.shift.updateMany({ where: { id: shiftId, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
  if (count === 0) return { ok: false, error: "That shift is already cancelled." };

  const already = new Set(
    (await db.email.findMany({ where: { ref: { startsWith: `shift-cancelled:${shiftId}:` } }, select: { ref: true } })).map((e) => e.ref),
  );
  const booked = view.shift.assignments.filter((a) => a.status === "CONFIRMED");
  const when = `${formatDay(view.iso)}, ${formatTimeRange(view.shift.startTime, view.shift.endTime)}`;
  for (const a of booked) {
    const ref = `shift-cancelled:${shiftId}:${a.volunteerId}`;
    if (already.has(ref)) continue;
    const p = { firstName: a.volunteer.firstName, shiftName: view.name, dateISO: view.iso, start: view.shift.startTime, end: view.shift.endTime, shiftId, regular: a.source === "REGULAR", cancelledBy: admin.firstName, reason };
    await queueEmail(a.volunteer, T.shiftCancelled(p), ref);
    await queueEmail(a.volunteer, T.shiftCancelledPush(p), ref);
    await db.contactLog.create({ data: { volunteerId: a.volunteerId, authorId: admin.id, kind: "SHIFT_CANCELLED", summary: `${view.name}, ${when}.${reason ? ` Reason: ${T.sentence(reason)}` : ""}` } });
  }
  revalidateAll();
  const n = booked.length;
  return { ok: true, message: n === 0 ? "Shift cancelled. Nobody was booked on it." : `Shift cancelled. ${n} ${n === 1 ? "volunteer has" : "volunteers have"} been emailed and sent a push notification.` };
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
  const affected = await db.assignment.findMany({ where: { volunteerId, status: "CONFIRMED", shift: { date: { gte: isoToDate(startDate), lte: isoToDate(endDate) }, status: "SCHEDULED" } }, select: { id: true, shiftId: true } });
  await db.assignment.updateMany({ where: { id: { in: affected.map((a) => a.id) } }, data: { status: "RELEASED", absenceId: absence.id } });
  for (const a of affected) await afterShiftReleased(a.shiftId, null);
  await queueEmail(volunteer, T.absenceConfirmed({ firstName: volunteer.firstName, startISO: startDate, endISO: endDate, reasonLabel: ABSENCE_REASON_LABEL[reason], releasedCount: affected.length }));
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

const linkSchema = z.object({
  label: z.string().trim().min(2).max(100),
  url: z.url({ protocol: /^https$/, error: "Links must start with https://" }).max(500),
});

const moduleSchema = z.object({
  /** Null creates a new module. */
  id: z.string().nullable(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(2).max(300),
  validityMonths: z.number().int().min(1).max(60).nullable(),
  requiredRoles: z.array(z.enum(VOLUNTEER_ROLES)).min(1),
  mandatoryBeforeFirstShift: z.boolean(),
  delivery: z.enum(["IN_PERSON", "ONLINE_CONFIRM"]),
  /** Paragraphs separated by a blank line. Online modules only. */
  content: z.string().trim().max(10000),
  links: z.array(linkSchema).max(10),
});
export type ModuleInput = z.infer<typeof moduleSchema>;

function moduleCode(name: string) {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "MODULE";
}

/** Content and links are what volunteers read and watch before they can tick
 *  an online module off, so they are edited here as the SOPs change. */
export async function saveModule(input: ModuleInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = moduleSchema.safeParse(input);
  if (!parsed.success) {
    const linkIssue = parsed.error.issues.find((i) => i.path[0] === "links");
    return { ok: false, error: linkIssue ? `Check the links: each needs a label and an https:// address.` : "Please check the module settings." };
  }
  const d = parsed.data;
  const online = d.delivery === "ONLINE_CONFIRM";
  if (online && moduleParagraphs(d.content).length === 0) return { ok: false, error: "Online modules need some content to read." };
  const data = {
    name: d.name,
    description: d.description,
    validityMonths: d.validityMonths,
    requiredRoles: sortRoles(d.requiredRoles),
    mandatoryBeforeFirstShift: d.mandatoryBeforeFirstShift,
    delivery: d.delivery,
    content: online ? d.content : null,
  };
  const links = online ? d.links.map((l, order) => ({ label: l.label, url: l.url, order })) : [];
  if (d.id) {
    await db.$transaction([
      db.trainingModule.update({ where: { id: d.id }, data }),
      db.trainingLink.deleteMany({ where: { moduleId: d.id } }),
      db.trainingLink.createMany({ data: links.map((l) => ({ ...l, moduleId: d.id! })) }),
    ]);
  } else {
    const base = moduleCode(d.name);
    let code = base;
    for (let n = 2; await db.trainingModule.findUnique({ where: { code } }); n++) code = `${base}_${n}`;
    const last = await db.trainingModule.findFirst({ orderBy: { order: "desc" }, select: { order: true } });
    await db.trainingModule.create({ data: { ...data, code, order: (last?.order ?? 0) + 1, links: { create: links } } });
  }
  revalidateAll();
  return { ok: true, message: d.id ? "Module saved." : "Module added. Volunteers with those roles now see it on their training list." };
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
  const s = await runShiftReminders();
  const c = await runCoverChecks();
  revalidateAll();
  const parts = [
    r.dueSoon + r.overdue > 0 && `${r.dueSoon} due-soon and ${r.overdue} overdue reminders`,
    r.coordinator > 0 && `${r.coordinator} overdue ${r.coordinator === 1 ? "notice" : "notices"} to you`,
    s.sent > 0 && `${s.sent} shift ${s.sent === 1 ? "reminder" : "reminders"} for tomorrow`,
    c.pushes > 0 && `${c.pushes} last-minute ${c.pushes === 1 ? "notification" : "notifications"}`,
    c.escalations > 0 && `${c.escalations} uncovered shift ${c.escalations === 1 ? "alert" : "alerts"}`,
  ].filter(Boolean);
  return { ok: true, message: parts.length === 0 ? `Checked ${r.checked} training records and upcoming gaps. Nothing new to send.` : `Queued ${parts.join(", ")}.` };
}

// --- Applications ---
export async function approveApplication(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const app = await db.application.findUnique({ where: { id } });
  if (!app || app.status !== "PENDING") return { ok: false, error: "Application already reviewed." };
  const email = normaliseEmail(app.email);
  const existing = await db.volunteer.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A volunteer with this email already exists." };
  const induction = await db.trainingSession.findFirst({ where: { startsAt: { gte: new Date() }, module: { code: INITIAL_VISIT_CODE } }, include: { rsvps: { where: { status: "GOING" } } }, orderBy: { startsAt: "asc" } });
  const volunteer = await db.volunteer.create({
    data: {
      firstName: app.firstName, lastName: app.lastName, email, phone: app.phone, suburb: app.suburb, birthYear: app.birthYear,
      roles: app.interests.length ? sortRoles(app.interests) : ["WAREHOUSE"], availabilityNote: app.availability, infoodleId: app.infoodleId, infoodleSyncedAt: app.infoodleId ? new Date() : null, joinedAt: new Date(),
    },
  });
  const visit = induction && induction.rsvps.length < induction.capacity ? induction : null;
  if (visit) {
    await db.sessionRsvp.create({ data: { sessionId: visit.id, volunteerId: volunteer.id, status: "GOING" } });
  }
  await db.application.update({ where: { id }, data: { status: "APPROVED", reviewedAt: new Date(), volunteerId: volunteer.id } });
  await db.contactLog.create({ data: { volunteerId: volunteer.id, authorId: admin.id, kind: "ACCOUNT_CREATED", summary: "Application approved." } });
  await queueEmail(volunteer, T.applicationApproved({ firstName: volunteer.firstName, inductionAt: visit?.startsAt, inductionLocation: visit?.location }));
  const invited = await sendSignInLink(volunteer, "INVITE");
  revalidateAll();
  return { ok: true, message: `${app.firstName} approved. Account created${visit ? " and pencilled into the next initial visit" : ""}.${invited ? "" : " The sign-in invite could not be sent; resend it from their profile."}` };
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
});

const PROFILE_FIELD_LABEL = {
  phone: "phone",
  suburb: "suburb",
  emergencyName: "emergency contact",
  emergencyPhone: "emergency contact phone",
  availabilityNote: "availability",
  lastMinuteOk: "last-minute cover",
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
  };
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((k) => before[k] !== data[k]);
  if (changed.length === 0) return { ok: true, message: "Nothing changed." };
  await db.volunteer.update({ where: { id: volunteerId }, data });
  // emergencyName and emergencyPhone read as one change.
  const labels = [...new Set(changed.map((k) => PROFILE_FIELD_LABEL[k].replace(" phone", "")))];
  await db.contactLog.create({ data: { volunteerId, authorId: admin.id, kind: "PROFILE_UPDATED", summary: `Updated ${labels.join(", ")}.` } });
  revalidateAll();
  return { ok: true, message: "Profile saved." };
}

export async function setVolunteerRoles(volunteerId: string, roles: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  const next = sortRoles(roles);
  if (next.length === 0) return { ok: false, error: "Pick at least one role." };
  const [volunteer, modules] = await Promise.all([
    db.volunteer.findUnique({ where: { id: volunteerId }, include: { trainingRecords: true } }),
    db.trainingModule.findMany(),
  ]);
  if (!volunteer) return { ok: false, error: "Volunteer not found." };
  const prev = volunteer.roles;
  const added = next.filter((r) => !prev.includes(r));
  const removed = prev.filter((r) => !next.includes(r));
  if (added.length + removed.length === 0) return { ok: true, message: "Roles unchanged." };
  await db.volunteer.update({ where: { id: volunteerId }, data: { roles: next } });
  // Training that the new roles bring in and the volunteer does not hold yet.
  const statuses = moduleStatuses({ roles: next }, modules, volunteer.trainingRecords, todayISO());
  const trainingNeeded = statuses
    .filter((s) => (s.status === "NOT_STARTED" || s.status === "OVERDUE") && s.module.requiredRoles.some((r) => added.includes(r)))
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

// --- Accounts ---
const newVolunteerSchema = z.object({
  firstName: z.string().trim().min(1, "Add a first name.").max(60),
  lastName: z.string().trim().max(60),
  email: z.email("Check the email address."),
  phone: z.string().trim().max(30),
  roles: z.array(z.enum(VOLUNTEER_ROLES)).min(1, "Pick at least one role."),
  sendInvite: z.boolean(),
});

type NewVolunteerField = "firstName" | "lastName" | "email" | "phone" | "roles";
/** Errors about one field name it, so the form can show them beside it. */
export type CreateVolunteerResult = { ok: true; message: string; id: string } | { ok: false; error: string; field?: NewVolunteerField };
const isNewVolunteerField = (k: unknown): k is NewVolunteerField => typeof k === "string" && k in newVolunteerSchema.shape;

/** Adds someone directly, e.g. an existing volunteer who never came through
 *  an application. Optionally emails them a link to set a password. */
export async function createVolunteer(input: z.infer<typeof newVolunteerSchema>): Promise<CreateVolunteerResult> {
  const admin = await requireAdmin();
  const parsed = newVolunteerSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const key = issue?.path[0];
    return { ok: false, error: issue?.message ?? "Please check the form.", field: isNewVolunteerField(key) ? key : undefined };
  }
  const d = parsed.data;
  const email = normaliseEmail(d.email);
  if (await db.volunteer.findUnique({ where: { email }, select: { id: true } })) {
    return { ok: false, error: "Someone with that email is already on the system.", field: "email" };
  }
  const volunteer = await db.volunteer.create({
    data: { firstName: d.firstName, lastName: d.lastName || null, email, phone: d.phone || null, roles: sortRoles(d.roles) },
  });
  await db.contactLog.create({ data: { volunteerId: volunteer.id, authorId: admin.id, kind: "ACCOUNT_CREATED", summary: `Added by ${admin.firstName}.` } });
  const invited = d.sendInvite ? await sendSignInLink(volunteer, "INVITE") : false;
  revalidateAll();
  const tail = !d.sendInvite ? "" : invited ? ` ${volunteer.firstName} has been emailed a link to set up their account.` : " The invite email could not be sent; try again from their profile.";
  return { ok: true, id: volunteer.id, message: `${fullName(volunteer)} added.${tail}` };
}

/** Emails a fresh link to set a password. Works for first-timers and for
 *  anyone who is locked out. */
export async function sendVolunteerInvite(volunteerId: string): Promise<ActionResult> {
  await requireAdmin();
  const volunteer = await db.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer) return { ok: false, error: "Volunteer not found." };
  if (volunteer.status !== "ACTIVE") return { ok: false, error: "Reactivate the account first." };
  const sent = await sendSignInLink(volunteer, volunteer.passwordHash || volunteer.lastSignInAt ? "PASSWORD_RESET" : "INVITE");
  revalidateAll();
  return sent
    ? { ok: true, message: `Sign-in link sent to ${volunteer.email}.` }
    : { ok: false, error: "The email could not be sent. Check the Outbox, then try again." };
}

/** Deactivating signs the person out, takes them off their regular slots and
 *  upcoming shifts (which then show as gaps) and blocks sign-in. History and
 *  training records are kept, so reactivating picks up where they left off. */
export async function setVolunteerStatus(volunteerId: string, active: boolean): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (volunteerId === admin.id) return { ok: false, error: "You cannot deactivate your own account." };
  const volunteer = await db.volunteer.findUnique({ where: { id: volunteerId } });
  if (!volunteer) return { ok: false, error: "Volunteer not found." };
  if ((volunteer.status === "ACTIVE") === active) return { ok: true, message: "No change." };
  if (active) {
    await db.$transaction([
      db.volunteer.update({ where: { id: volunteerId }, data: { status: "ACTIVE" } }),
      db.contactLog.create({ data: { volunteerId, authorId: admin.id, kind: "STATUS_CHANGED", summary: "Reactivated." } }),
    ]);
    revalidateAll();
    return { ok: true, message: `${volunteer.firstName} is active again. Add a regular slot or invite them to book shifts.` };
  }
  const upcoming = await db.assignment.findMany({
    where: { volunteerId, status: "CONFIRMED", shift: { date: { gte: isoToDate(todayISO()) } } },
    select: { id: true, shiftId: true },
  });
  const slots = await db.regularSlot.count({ where: { volunteerId } });
  await db.$transaction([
    db.volunteer.update({ where: { id: volunteerId }, data: { status: "INACTIVE", isRegular: false } }),
    db.assignment.updateMany({ where: { id: { in: upcoming.map((a) => a.id) } }, data: { status: "CANCELLED" } }),
    db.regularSlot.deleteMany({ where: { volunteerId } }),
    db.session.deleteMany({ where: { volunteerId } }),
    db.authToken.deleteMany({ where: { volunteerId, usedAt: null } }),
    db.contactLog.create({
      data: { volunteerId, authorId: admin.id, kind: "STATUS_CHANGED", summary: `Deactivated. Removed from ${slots} regular ${slots === 1 ? "slot" : "slots"} and ${upcoming.length} upcoming ${upcoming.length === 1 ? "shift" : "shifts"}.` },
    }),
  ]);
  let gaps = 0;
  for (const shiftId of new Set(upcoming.map((a) => a.shiftId))) if (await afterShiftReleased(shiftId, null)) gaps++;
  revalidateAll();
  return { ok: true, message: `${volunteer.firstName} deactivated.${gaps ? ` ${gaps} upcoming ${gaps === 1 ? "shift now needs" : "shifts now need"} cover.` : ""}` };
}

// --- Coordinators (admin access). The rules live in src/lib/admin-access.ts ---
export async function addAdmin(input: NewAdminInput): Promise<GrantAdminResult> {
  const admin = await requireAdmin();
  const r = await grantAdminAccess(admin, input);
  if (r.ok) revalidateAll();
  return r;
}

export async function removeAdmin(volunteerId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const r = await revokeAdminAccess(admin, volunteerId);
  if (r.ok) revalidateAll();
  return r;
}
