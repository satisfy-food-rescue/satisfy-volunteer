import type { ShiftsWeek } from "@satisfy/core/api";
import { db } from "@/lib/db";
import { isoToDate, todayISO, weekMonday, workWeek } from "@/lib/dates";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { shiftSummary } from "@/lib/mobile-api/shifts";
import { shiftsBetween } from "@/lib/roster";
import { trainingContext } from "@/lib/volunteer-data";

export const dynamic = "force-dynamic";

/** ?week= any day in the week; defaults to this week, as the web page does. */
export const GET = mobileHandler(async (me, request) => {
  const today = todayISO();
  const week = request.nextUrl.searchParams.get("week");
  const monday = weekMonday(week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : today);
  const days = workWeek(monday);
  const [shifts, training, absences] = await Promise.all([
    shiftsBetween(days[0], days[4]),
    trainingContext(me, today),
    db.absence.findMany({ where: { volunteerId: me.id, startDate: { lte: isoToDate(days[4]) }, endDate: { gte: isoToDate(days[0]) } } }),
  ]);
  const ctx = { me, statuses: training.statuses, today };
  const isAway = (iso: string) => absences.some((a) => a.startDate <= isoToDate(iso) && a.endDate >= isoToDate(iso));
  return json<ShiftsWeek>({
    today,
    monday,
    days: days.map((iso) => ({ iso, away: isAway(iso), shifts: shifts.filter((s) => s.iso === iso).map((s) => shiftSummary(s, ctx)) })),
  });
});
