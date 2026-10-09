import type { Volunteer } from "@/generated/prisma/client";
import { db } from "./db";
import { addDays, isoToDate, todayISO } from "./dates";
import { moduleStatuses, trainingSummary, type ModuleStatus } from "./training";
import { decorateShift, gapsBetween, shiftInclude, type ShiftView } from "./roster";

export async function trainingContext(volunteer: Volunteer, today = todayISO()) {
  const [modules, records] = await Promise.all([
    db.trainingModule.findMany({ orderBy: { order: "asc" } }),
    db.trainingRecord.findMany({ where: { volunteerId: volunteer.id } }),
  ]);
  const statuses: ModuleStatus[] = moduleStatuses(volunteer, modules, records, today);
  return { modules, records, statuses, summary: trainingSummary(statuses) };
}

/** Open gaps in the next four weeks the volunteer could cover: every gap
 *  except those their own absence caused. */
export async function coverableGaps(volunteerId: string, today = todayISO()): Promise<ShiftView[]> {
  const gaps = await gapsBetween(today, addDays(today, 28));
  return gaps.filter((g) => !g.released.some((r) => r.volunteerId === volunteerId));
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
