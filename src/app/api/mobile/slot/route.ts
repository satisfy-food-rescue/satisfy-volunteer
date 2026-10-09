import type { AbsenceReason } from "@satisfy/core/domain";
import type { SlotOverview } from "@satisfy/core/api";
import { dateToISO, todayISO } from "@/lib/dates";
import { json, mobileHandler } from "@/lib/mobile-auth";
import { myAbsences, myRegularSlots, myUpcomingShifts } from "@/lib/volunteer-data";

export const dynamic = "force-dynamic";

export const GET = mobileHandler(async (me) => {
  const today = todayISO();
  const [slots, absences, upcoming] = await Promise.all([myRegularSlots(me.id), myAbsences(me.id, today), myUpcomingShifts(me.id, today, 90)]);
  return json<SlotOverview>({
    today,
    slots: slots.map((s) => ({ id: s.id, weekday: s.weekday, name: s.template.name, startTime: s.template.startTime, endTime: s.template.endTime })),
    absences: absences.map((a) => {
      const startISO = dateToISO(a.startDate);
      return {
        id: a.id,
        startISO,
        endISO: dateToISO(a.endDate),
        reason: a.reason as AbsenceReason,
        note: a.note,
        releasedCount: a.releasedAssignments.filter((r) => r.status === "RELEASED").length,
        removable: startISO >= today,
      };
    }),
    upcoming: upcoming.map((u) => ({ iso: u.iso, name: u.shift.template.name })),
  });
});
