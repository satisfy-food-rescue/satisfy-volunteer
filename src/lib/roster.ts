import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { dateToISO, isoToDate, todayISO } from "./dates";
import { ABSENCE_REASON_LABEL, fullName, type ShiftKind } from "./domain";
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
  confirmed: AssignmentFull[];
  released: AssignmentFull[];
  confirmedCount: number;
  spotsLeft: number;
  isFull: boolean;
  /** Confirmed crew below the minimum needed. */
  isGap: boolean;
  shortBy: number;
  /** Why the gap exists, e.g. "Brian Tweedie away (holiday)". */
  causes: string[];
  location: string;
};

export function shiftLocation(template: ShiftFull["template"]): string {
  if (template.kind === "WAREHOUSE") return "Satisfy warehouse, Rangiora";
  return `${template.route?.name ?? "Route"} collection, departs the warehouse`;
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
  if (shortBy > 0 && causes.length === 0) causes.push("No regular volunteer for this slot");
  return {
    shift,
    iso: dateToISO(shift.date),
    kind: shift.template.kind,
    confirmed,
    released,
    confirmedCount,
    spotsLeft: Math.max(0, shift.capacity - confirmedCount),
    isFull: confirmedCount >= shift.capacity,
    isGap: shift.status === "SCHEDULED" && shortBy > 0,
    shortBy,
    causes,
    location: shiftLocation(shift.template),
  };
}

export async function shiftsBetween(fromISO: string, toISO: string): Promise<ShiftView[]> {
  const shifts = await db.shift.findMany({
    where: { date: { gte: isoToDate(fromISO), lte: isoToDate(toISO) } },
    include: shiftInclude,
    orderBy: [{ date: "asc" }, { template: { order: "asc" } }],
  });
  return shifts.map(decorateShift);
}

export async function shiftById(id: string): Promise<ShiftView | null> {
  const shift = await db.shift.findUnique({ where: { id }, include: shiftInclude });
  return shift ? decorateShift(shift) : null;
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
      where: { status: { in: ["CONFIRMED", "ATTENDED"] }, shift: { date: view.shift.date } },
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
