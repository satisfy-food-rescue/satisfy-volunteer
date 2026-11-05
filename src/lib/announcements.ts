// Announcements: a coordinator's message to a group of volunteers, sent by
// email and, when asked, as a push to their phones. Audiences are deliberately
// few: everyone, some roles, the crew of one shift (a harvest that moved), or
// everyone on a shift type's upcoming shifts and its regulars (a group of
// harvesters the coordinator set up as their own shift type).
import { z } from "zod";
import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { ACTIVE_POOL } from "./pool";
import { formatDay, formatTimeRange, isoToDate, todayISO } from "./dates";
import { ROLE_LABEL, VOLUNTEER_ROLES, sortRoles, type VolunteerRole } from "./domain";
import { shiftById } from "./roster";
import { queueEmail } from "./emails";
import * as T from "./email-templates";

export const audienceSchema = z.discriminatedUnion("audience", [
  z.object({ audience: z.literal("ALL") }),
  z.object({ audience: z.literal("ROLES"), roles: z.array(z.enum(VOLUNTEER_ROLES)).min(1) }),
  z.object({ audience: z.literal("SHIFT"), shiftId: z.string().min(1) }),
  z.object({ audience: z.literal("SHIFT_TYPE"), templateId: z.string().min(1) }),
]);
export type AudienceInput = z.infer<typeof audienceSchema>;

export const announcementSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(5000),
  push: z.boolean(),
  target: audienceSchema,
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

export type ResolvedAudience = { label: string; recipients: Volunteer[]; shiftId: string | null; templateId: string | null; roles: VolunteerRole[] };

export async function resolveAudience(target: AudienceInput): Promise<ResolvedAudience | null> {
  if (target.audience === "SHIFT") {
    const view = await shiftById(target.shiftId, { drafts: true });
    if (!view) return null;
    const recipients = view.confirmed.filter((a) => a.status === "CONFIRMED" && a.volunteer.status === "ACTIVE").map((a) => a.volunteer);
    return {
      label: `Crew of ${view.name}, ${formatDay(view.iso)} ${formatTimeRange(view.shift.startTime, view.shift.endTime)}`,
      recipients,
      shiftId: view.shift.id,
      templateId: null,
      roles: [],
    };
  }
  if (target.audience === "SHIFT_TYPE") {
    const template = await db.shiftTemplate.findUnique({ where: { id: target.templateId } });
    if (!template) return null;
    const recipients = await db.volunteer.findMany({
      where: {
        AND: [
          ACTIVE_POOL,
          {
            OR: [
              { regularSlots: { some: { templateId: template.id } } },
              { assignments: { some: { status: "CONFIRMED", shift: { templateId: template.id, status: "SCHEDULED", date: { gte: isoToDate(todayISO()) } } } } },
            ],
          },
        ],
      },
      orderBy: { firstName: "asc" },
    });
    return { label: `Everyone on upcoming ${template.name} shifts`, recipients, shiftId: null, templateId: template.id, roles: [] };
  }
  const active = await db.volunteer.findMany({ where: ACTIVE_POOL, orderBy: { firstName: "asc" } });
  if (target.audience === "ALL") return { label: "All active volunteers", recipients: active, shiftId: null, templateId: null, roles: [] };
  const roles = sortRoles(target.roles);
  return {
    label: roles.map((r) => (r === "HARVEST" ? "Harvest pool" : ROLE_LABEL[r])).join(", "),
    recipients: active.filter((v) => v.roles.some((r) => roles.includes(r))),
    shiftId: null,
    templateId: null,
    roles,
  };
}

/** Records the announcement and queues one email (and push) per recipient. */
export async function sendAnnouncement(author: Volunteer, input: AnnouncementInput) {
  const resolved = await resolveAudience(input.target);
  if (!resolved) return { ok: false as const, error: "That shift no longer exists." };
  if (resolved.recipients.length === 0) return { ok: false as const, error: "Nobody matches that audience yet." };
  const row = await db.announcement.create({
    data: {
      subject: input.subject,
      body: input.body,
      audience: input.target.audience,
      roles: resolved.roles,
      shiftId: resolved.shiftId,
      templateId: resolved.templateId,
      audienceLabel: resolved.label,
      push: input.push,
      recipientCount: resolved.recipients.length,
      authorId: author.id,
    },
  });
  for (const v of resolved.recipients) {
    const ref = `announcement:${row.id}:${v.id}`;
    const p = { firstName: v.firstName, subject: input.subject, body: input.body, from: author.firstName, shiftId: resolved.shiftId ?? undefined };
    await queueEmail(v, T.announcement(p), ref);
    if (input.push) await queueEmail(v, T.announcementPush(p), ref);
  }
  return { ok: true as const, count: resolved.recipients.length };
}
