import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { addDays, durationHours, isoToDate, todayISO } from "./dates";
import { eligibilityFor, moduleStatuses, trainingSummary, type ModuleStatus } from "./training";
import { decorateShift, gapsBetween, shiftInclude, type ShiftView } from "./roster";
import { shiftAction, type ShiftContext } from "./mobile-api/shifts";

export async function trainingContext(volunteer: Volunteer, today = todayISO()) {
  const [modules, records] = await Promise.all([
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
    db.trainingRecord.findMany({ where: { volunteerId: volunteer.id } }),
  ]);
  const statuses: ModuleStatus[] = moduleStatuses(volunteer, modules, records, today);
  return { modules, records, statuses, summary: trainingSummary(statuses) };
}

/** Open gaps in the next four weeks, as the Cover tab lists them: every gap
 *  except those the volunteer's own absence caused, including any locked to
 *  them by role or training. */
export async function coverGaps(volunteerId: string, today = todayISO()): Promise<ShiftView[]> {
  const gaps = await gapsBetween(today, addDays(today, 28));
  return gaps.filter((g) => !g.released.some((r) => r.volunteerId === volunteerId));
}

/** The gaps the volunteer could take right now, where their button would say
 *  "I can cover this". The Cover badge and the home cover card count these,
 *  so neither nags about shifts that are locked to them. */
export function coverableGaps(gaps: ShiftView[], ctx: ShiftContext): ShiftView[] {
  return gaps.filter((g) => {
    const action = shiftAction(g, ctx.me.id, eligibilityFor(ctx.me, g.kind, ctx.statuses), ctx.today);
    return action.kind === "BOOK";
  });
}

/** Upcoming shifts the volunteer is confirmed on, soonest first. */
export async function myUpcomingShifts(volunteerId: string, today = todayISO(), days = 60): Promise<ShiftView[]> {
  const shifts = await db.shift.findMany({
    where: {
      date: { gte: isoToDate(today), lte: isoToDate(addDays(today, days)) },
      status: "SCHEDULED",
      assignments: { some: { volunteerId, status: "CONFIRMED" } },
    },
    include: shiftInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return shifts.map(decorateShift);
}

/** Published harvests from today on, soonest first. */
export async function upcomingHarvests(today = todayISO()): Promise<ShiftView[]> {
  const shifts = await db.shift.findMany({
    where: { date: { gte: isoToDate(today) }, status: "SCHEDULED", template: { kind: "HARVEST" } },
    include: shiftInclude,
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return shifts.map(decorateShift);
}

export async function myRegularSlots(volunteerId: string) {
  return db.regularSlot.findMany({
    where: { volunteerId },
    include: { template: { include: { route: true } } },
    orderBy: [{ weekday: "asc" }],
  });
}

export async function myAbsences(volunteerId: string, today = todayISO()) {
  return db.absence.findMany({
    where: { volunteerId, endDate: { gte: isoToDate(addDays(today, -1)) } },
    include: { releasedAssignments: { include: { shift: { include: { template: true } } } } },
    orderBy: { startDate: "asc" },
  });
}

/** What the volunteer has given over the past year, from marked attendance:
 *  the recognition panel on the home screen. */
export async function myYear(volunteerId: string, today = todayISO()) {
  const attended = await db.assignment.findMany({
    where: { volunteerId, status: "ATTENDED", shift: { date: { gte: isoToDate(addDays(today, -365)), lt: isoToDate(today) } } },
    include: { shift: { select: { startTime: true, endTime: true } } },
  });
  return {
    shifts: attended.length,
    hours: Math.round(attended.reduce((n, a) => n + durationHours(a.shift.startTime, a.shift.endTime), 0)),
  };
}
