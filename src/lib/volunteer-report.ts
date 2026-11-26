import "server-only";
// The volunteer report coordinators download from Reports: one row per
// volunteer with the dates Satisfy asks about (joined, each role's start, the
// Ministry of Justice check, agreements, training). Opens in Excel or Google
// Sheets. Dates are YYYY-MM-DD so they sort.
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { dateToISO, isoToDate, todayISO } from "./dates";
import { ROLE_LABEL, TRAINING_STATUS_LABEL, VOLUNTEER_ROLES, fullName, isVolunteerRole, type VolunteerRole } from "./domain";
import { IN_POOL } from "./pool";
import { inductionsFor } from "./induction-data";
import { MOJ_STATUS_LABEL } from "./induction";
import { currentRoleStarts } from "./roles";
import { moduleStatuses, trainingSummary } from "./training";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportFilterSchema = z.object({
  /** active (the default) or all, which adds inactive volunteers. */
  status: z.enum(["active", "all"]).catch("active"),
  role: z.string().refine(isVolunteerRole).optional().catch(undefined),
  joinedFrom: isoDate.optional().catch(undefined),
  joinedTo: isoDate.optional().catch(undefined),
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;

export function parseReportFilter(params: URLSearchParams): ReportFilter {
  const get = (k: string) => params.get(k) || undefined;
  return reportFilterSchema.parse({ status: get("status"), role: get("role"), joinedFrom: get("joinedFrom"), joinedTo: get("joinedTo") });
}

/** A cell as Excel and Sheets read it: quoted when it needs to be, and with a
 *  leading apostrophe when it would otherwise run as a formula. */
export function csvCell(value: string | number | null | undefined): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  // The byte order mark tells Excel the file is UTF-8, so macrons survive.
  return `﻿${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export async function volunteerReport(filter: ReportFilter, today = todayISO()): Promise<string> {
  const where: Prisma.VolunteerWhereInput = {
    ...IN_POOL,
    status: filter.status === "all" ? { in: ["ACTIVE", "INACTIVE"] } : "ACTIVE",
    ...(filter.role ? { roles: { has: filter.role as VolunteerRole } } : {}),
    ...(filter.joinedFrom || filter.joinedTo ? { joinedAt: { ...(filter.joinedFrom ? { gte: isoToDate(filter.joinedFrom) } : {}), ...(filter.joinedTo ? { lte: isoToDate(filter.joinedTo) } : {}) } } : {}),
  };
  const [volunteers, modules, agreements] = await Promise.all([
    db.volunteer.findMany({
      where,
      include: { rolePeriods: true, trainingRecords: true, mojChecks: { select: { checkedOn: true } }, regularSlots: { select: { id: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    db.trainingModule.findMany({ where: { inDevelopment: false }, orderBy: { order: "asc" } }),
    db.document.findMany({ where: { kind: "AGREEMENT", archived: false }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
  ]);
  const inductions = await inductionsFor(volunteers, today);

  const header = [
    "Name", "Email", "Phone", "Suburb", "Status", "Joined", "Roles",
    ...VOLUNTEER_ROLES.map((r) => `${ROLE_LABEL[r]} since`),
    "Regular slot",
    "MOJ check dated", "MOJ check renews", "MOJ check status",
    ...agreements.map((d) => `${d.title} (${d.acceptance === "READ" ? "read" : "signed"})`),
    "Induction complete",
    ...modules.map((m) => m.name),
    "Training status",
  ];
  const rows = volunteers.map((v) => {
    const starts = currentRoleStarts(v.rolePeriods);
    const induction = inductions.get(v.id)!;
    const statuses = moduleStatuses(v, modules, v.trainingRecords, today);
    return [
      fullName(v), v.email, v.phone, v.suburb, v.status === "ACTIVE" ? "Active" : "Inactive", dateToISO(v.joinedAt), v.roles.map((r) => ROLE_LABEL[r]).join("; "),
      ...VOLUNTEER_ROLES.map((r) => (v.roles.includes(r) ? (starts[r] ?? "") : "")),
      v.regularSlots.length > 0 ? "Yes" : "No",
      induction.moj.checkedISO, induction.moj.renewsISO, MOJ_STATUS_LABEL[induction.moj.status],
      ...agreements.map((d) => {
        const a = induction.agreements.find((x) => x.document.id === d.id);
        if (!a?.required) return "Not needed";
        if (a.status === "SIGNED") return a.signedAt ? todayISO(a.signedAt) : "Yes";
        return a.status === "UPDATED" ? "New version to accept" : "Not yet";
      }),
      induction.complete ? "Yes" : "No",
      ...statuses.map((s) => (!s.required ? "" : s.notApplicable ? "Not applicable" : (s.completedISO ?? "Not started"))),
      TRAINING_STATUS_LABEL[trainingSummary(statuses).worst],
    ];
  });
  return toCsv([header, ...rows]);
}
