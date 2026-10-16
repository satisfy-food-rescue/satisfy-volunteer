import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { dateToISO, isoToDate, todayISO } from "./dates";
import { ABSENCE_REASON_LABEL, ROLE_LABEL, fullName, isAdHocKind, type ShiftKind } from "./domain";
import { eligibilityFor, moduleStatuses } from "./training";

export const shiftInclude = {
  template: { include: { route: true } },
  assignments: { include: { volunteer: true, absence: true } },
} satisfies Prisma.ShiftInclude;

export type ShiftFull = Prisma.ShiftGetPayload<{ include: typeof shiftInclude }>;
export type AssignmentFull = ShiftFull["assignments"][number];

export type ShiftView = {
  shift: ShiftFull;
  iso: string;
  kind: ShiftKind;
  /** The shift's own title (a harvest's "Apple picking"), else the template's. */
  name: string;
  isDraft: boolean;
  confirmed: AssignmentFull[];
  released: AssignmentFull[];
  confirmedCount: number;
  spotsLeft: number;
  isFull: boolean;
  /** Confirmed crew below the minimum needed on a recurring shift. Ad hoc
   *  shifts (harvests) are never gaps: an unfilled place is just open. */
  isGap: boolean;
  shortBy: number;
  /** Why the gap exists, e.g. "Brian Tweedie away (holiday)". */
  causes: string[];
  location: string;
};

export function shiftLocation(shift: Pick<ShiftFull, "location" | "template">): string {
  if (shift.location) return shift.location;
  const { template } = shift;
  if (template.kind === "WAREHOUSE") return "Satisfy warehouse, Rangiora";
  if (template.kind === "HARVEST") return "Location to be confirmed";
  return `${template.route?.name ?? "Route"} collection, departs the warehouse`;
}

export function shiftName(shift: { title: string | null; template: { name: string } }): string {
  return shift.title || shift.template.name;
}

export function decorateShift(shift: ShiftFull): ShiftView {
  const active = shift.assignments.filter((a) => a.status === "CONFIRMED" || a.status === "ATTENDED" || a.status === "NO_SHOW");
  const confirmed = active.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const released = shift.assignments.filter((a) => a.status === "RELEASED");
  const confirmedCount = confirmed.length;
  const shortBy = Math.max(0, shift.needed - confirmedCount);
  const causes = released.map((r) => {
    const reason = r.absence ? ABSENCE_REASON_LABEL[r.absence.reason].toLowerCase() : "away";
    return `${fullName(r.volunteer)} away (${reason})`;
  });
  const kind = shift.template.kind;
  const adHoc = isAdHocKind(kind);
  if (shortBy > 0 && causes.length === 0 && !adHoc) causes.push("No regular volunteer for this slot");
  return {
    shift,
    iso: dateToISO(shift.date),
    kind,
    name: shiftName(shift),
    isDraft: shift.status === "DRAFT",
    confirmed,
    released,
    confirmedCount,
    spotsLeft: Math.max(0, shift.capacity - confirmedCount),
    isFull: confirmedCount >= shift.capacity,
    isGap: shift.status === "SCHEDULED" && shortBy > 0 && !adHoc,
    shortBy,
    causes,
    location: shiftLocation(shift),
  };
}

/** Drafts are for coordinators only. Everything a volunteer sees leaves them
 *  out, so a shift appears for volunteers the moment it is published. */
type Visibility = { drafts?: boolean };

export async function shiftsBetween(fromISO: string, toISO: string, { drafts = false }: Visibility = {}): Promise<ShiftView[]> {
  const shifts = await db.shift.findMany({
    where: { date: { gte: isoToDate(fromISO), lte: isoToDate(toISO) }, ...(drafts ? {} : { status: { not: "DRAFT" } }) },
    include: shiftInclude,
    orderBy: [{ date: "asc" }, { template: { order: "asc" } }, { startTime: "asc" }],
  });
  return shifts.map(decorateShift);
}

export async function shiftById(id: string, { drafts = false }: Visibility = {}): Promise<ShiftView | null> {
  const shift = await db.shift.findUnique({ where: { id }, include: shiftInclude });
  if (!shift || (shift.status === "DRAFT" && !drafts)) return null;
  return decorateShift(shift);
}

export async function gapsBetween(fromISO: string, toISO: string): Promise<ShiftView[]> {
  return (await shiftsBetween(fromISO, toISO)).filter((s) => s.isGap);
}

/** Volunteers who could be added to a shift right now: hold the role, training
 *  current, not already on it, not away, and not on another shift that day. */
export async function availableForShift(view: ShiftView) {
  const today = todayISO();
  const [volunteers, modules, sameDay] = await Promise.all([
    db.volunteer.findMany({
      where: { status: "ACTIVE", role: "VOLUNTEER", roles: { has: view.kind } },
      include: {
        trainingRecords: true,
        absences: { where: { startDate: { lte: view.shift.date }, endDate: { gte: view.shift.date } } },
        assignments: { where: { source: "COVER", status: { in: ["CONFIRMED", "ATTENDED"] } }, select: { id: true } },
        regularSlots: { select: { weekday: true } },
      },
      orderBy: [{ firstName: "asc" }],
    }),
    db.trainingModule.findMany(),
    db.assignment.findMany({
      // A cancelled shift leaves its crew free that day.
      where: { status: { in: ["CONFIRMED", "ATTENDED"] }, shift: { date: view.shift.date, status: "SCHEDULED" } },
      select: { volunteerId: true },
    }),
  ]);
  const busy = new Set(sameDay.map((a) => a.volunteerId));
  return volunteers
    .filter((v) => !busy.has(v.id) && v.absences.length === 0)
    .map((v) => {
      const statuses = moduleStatuses(v, modules, v.trainingRecords, today);
      const elig = eligibilityFor(v, view.kind, statuses);
      return { volunteer: v, eligibility: elig, coversBefore: v.assignments.length };
    })
    .filter((x) => x.eligibility.eligible);
}

/** Shift types a coordinator can create a one-off shift from, with how many
 *  active volunteers a callout would reach. Harvest first: it is the reason
 *  one-off shifts exist. */
export async function shiftFormTemplates() {
  const [templates, volunteers] = await Promise.all([
    db.shiftTemplate.findMany({ where: { active: true }, include: { route: true }, orderBy: { order: "asc" } }),
    db.volunteer.findMany({ where: { status: "ACTIVE", role: "VOLUNTEER" }, select: { roles: true } }),
  ]);
  return templates
    .map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      startTime: t.startTime,
      endTime: t.endTime,
      capacity: t.capacity,
      needed: t.needed,
      defaultLocation: shiftLocation({ location: null, template: t }),
      holders: volunteers.filter((v) => v.roles.includes(t.kind)).length,
      roleLabel: ROLE_LABEL[t.kind],
    }))
    .sort((a, b) => Number(b.kind === "HARVEST") - Number(a.kind === "HARVEST"));
}
