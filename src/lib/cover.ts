// Last-minute cover. When a shift becomes a gap close to its start, eligible
// volunteers who opted in to last-minute cover get a push notification. If it
// is still uncovered nearer the start, the coordinator is alerted to step in.
// Both thresholds are set per shift type (ShiftTemplate.lastMinuteHours and
// escalateHours) because route shifts matter more than afternoon warehouse ones.
import { db } from "./db";
import { addDays, nzInstant, todayISO } from "./dates";
import { availableForShift, shiftById, shiftsBetween, type ShiftView } from "./roster";
import { queueEmail } from "./emails";
import * as T from "./email-templates";

export function hoursUntilStart(view: ShiftView, now = new Date()): number {
  return (nzInstant(view.iso, view.shift.startTime).getTime() - now.getTime()) / 3_600_000;
}

function within(view: ShiftView, hours: number, now: Date) {
  const left = hoursUntilStart(view, now);
  return left > 0 && left <= hours;
}

const lastMinuteRef = (shiftId: string, volunteerId: string) => `last-minute:${shiftId}:${volunteerId}`;

/** Pushes to every eligible, free, last-minute volunteer not yet told about
 *  this shift. Returns how many were notified. */
export async function notifyLastMinute(view: ShiftView, now = new Date()): Promise<number> {
  if (!view.isGap || !within(view, view.shift.template.lastMinuteHours, now)) return 0;
  // Not whoever just cancelled or was taken off this shift: they are free
  // that day now, but asking them to cover it makes no sense.
  const droppedOut = new Set(view.shift.assignments.map((a) => a.volunteerId));
  const candidates = (await availableForShift(view)).filter((c) => c.volunteer.lastMinuteOk && !droppedOut.has(c.volunteer.id));
  const already = new Set(
    (await db.email.findMany({ where: { ref: { startsWith: `last-minute:${view.shift.id}:` } }, select: { ref: true } })).map((e) => e.ref),
  );
  let sent = 0;
  for (const { volunteer } of candidates) {
    const ref = lastMinuteRef(view.shift.id, volunteer.id);
    if (already.has(ref)) continue;
    await queueEmail(volunteer, T.lastMinuteCallout({ shiftName: view.shift.template.name, dateISO: view.iso, start: view.shift.startTime, end: view.shift.endTime, shiftId: view.shift.id }), ref);
    sent++;
  }
  return sent;
}

/** Alerts the coordinator once per shift when it is still a gap inside the
 *  shift type's escalation window. */
export async function escalateIfUncovered(view: ShiftView, now = new Date()): Promise<boolean> {
  if (!view.isGap || !within(view, view.shift.template.escalateHours, now)) return false;
  const ref = `gap-escalation:${view.shift.id}`;
  if (await db.email.findFirst({ where: { ref }, select: { id: true } })) return false;
  const notified = await db.email.count({ where: { ref: { startsWith: `last-minute:${view.shift.id}:` } } });
  await queueEmail(null, T.gapEscalation({ shiftName: view.shift.template.name, dateISO: view.iso, start: view.shift.startTime, end: view.shift.endTime, cause: view.causes.join("; "), notified, shiftId: view.shift.id }), ref);
  return true;
}

/** Call after anything that may have opened a gap: a cancellation, an absence
 *  or a coordinator removing someone. `cause` set means the coordinator did not
 *  make the change and should hear about the gap. */
export async function afterShiftReleased(shiftId: string, cause: string | null, now = new Date()) {
  const view = await shiftById(shiftId);
  if (!view?.isGap) return;
  await notifyLastMinute(view, now);
  if (!cause) return;
  const escalated = await escalateIfUncovered(view, now);
  if (!escalated) {
    await queueEmail(null, T.gapAlert({ shiftName: view.shift.template.name, dateISO: view.iso, start: view.shift.startTime, end: view.shift.endTime, cause, shiftId: view.shift.id }));
  }
}

/** Sweeps upcoming gaps: gaps that have drifted into a last-minute window get
 *  their push, and those inside the escalation window alert the coordinator.
 *  Hourly in production; on demand from Training > Reminders in the demo. */
export async function runCoverChecks(now = new Date()) {
  const longest = await db.shiftTemplate.aggregate({ _max: { lastMinuteHours: true, escalateHours: true } });
  const hours = Math.max(longest._max.lastMinuteHours ?? 0, longest._max.escalateHours ?? 0);
  const today = todayISO(now);
  const gaps = (await shiftsBetween(today, addDays(today, Math.ceil(hours / 24) + 1))).filter((s) => s.isGap);
  let pushes = 0;
  let escalations = 0;
  for (const view of gaps) {
    pushes += await notifyLastMinute(view, now);
    if (await escalateIfUncovered(view, now)) escalations++;
  }
  return { pushes, escalations };
}
