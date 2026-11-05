import { db } from "./db";
import { addDays, dateToISO, daysBetween, isoToDate, nzInstant, todayISO } from "./dates";
import { DUE_SOON_DAYS, MOJ_CHECK_URL, MOJ_RENEWAL_DAYS, fullName } from "./domain";
import { mojExpired, mojRenewalCoordinator, mojRenewalDue, shiftReminder, trainingDueSoon, trainingOverdue, trainingOverdueCoordinator } from "./email-templates";
import { mojRenewsISO } from "./induction";
import { ACTIVE_POOL } from "./pool";
import { getSettings } from "./settings";
import { queueEmail } from "./emails";
import { shiftLocation, shiftName } from "./roster";

/** NZ wall-clock time the day-before shift reminder goes out. */
export const SHIFT_REMINDER_TIME = "16:00";
/** Overdue this long and the coordinator hears about it, once. */
const COORDINATOR_OVERDUE_DAYS = 21;

export const REMINDER_RULES = [
  {
    id: "due-30",
    when: `${DUE_SOON_DAYS} days before a module expires`,
    audience: "The volunteer",
    template: "Training due soon",
    detail: "One email. Links straight to the online module when it can be completed in-app.",
  },
  {
    id: "due-0",
    when: "On the expiry date",
    audience: "The volunteer",
    template: "Training overdue",
    detail: "Explains which shift types are now blocked and how to lift the block.",
  },
  {
    id: "overdue-weekly",
    when: "Every 7 days while overdue",
    audience: "The volunteer. The coordinator is told once, at 3 weeks overdue",
    template: "Training overdue",
    detail: "Stops automatically the moment the module is refreshed.",
  },
  {
    id: "moj-due",
    when: `${MOJ_RENEWAL_DAYS} days before a Ministry of Justice check is three years old`,
    audience: "The volunteer, and the coordinator",
    template: "Ministry of Justice check due for renewal",
    detail: "Early, since the Ministry can take up to 20 working days. Says how to request a new check, and that the coordinator can help.",
  },
  {
    id: "moj-expired",
    when: "When a Ministry of Justice check turns three years old",
    audience: "The volunteer, and the coordinator",
    template: "Ministry of Justice check expired",
    detail: "New bookings and training pause until a new check is recorded. Only for roles set to need a check in Induction.",
  },
  {
    id: "shift-eve",
    when: "4pm the day before a shift",
    audience: "Everyone rostered on",
    template: "Shift reminder",
    detail: "Includes a one-tap 'mark me away' link so late cancellations become gaps early.",
  },
  {
    id: "gap-alert",
    when: "As soon as a volunteer's absence or cancellation opens a gap",
    audience: "Coordinator",
    template: "Coverage gap alert",
    detail: "Also lists the shift under Open gaps for eligible volunteers.",
  },
  {
    id: "last-minute",
    when: "A gap inside the shift type's last-minute window (48 hours by default)",
    audience: "Last-minute volunteers who are eligible and free that day",
    template: "Last-minute cover (push notification)",
    detail: "Sent the moment the gap opens, or when an older gap drifts into the window. Each volunteer hears about a shift once.",
  },
  {
    id: "escalate",
    when: "Still uncovered at the shift type's alert threshold (24 hours by default)",
    audience: "Coordinator",
    template: "Uncovered shift alert",
    detail: "Time to pick up the phone. Route shifts can be set to alert earlier than warehouse shifts in Set-up > Shift types.",
  },
] as const;

/** Sends any training reminders that are due today and not yet sent. Safe to
 *  run as often as you like: every message has a de-duplication ref. Runs
 *  hourly in production; on demand from Training > Reminders. */
export async function runReminders(today: string) {
  const records = await db.trainingRecord.findMany({
    where: { expiresAt: { not: null }, volunteer: { status: "ACTIVE" } },
    include: { module: true, volunteer: true },
  });
  // Only the latest record per volunteer+module counts.
  const latest = new Map<string, (typeof records)[number]>();
  for (const r of records) {
    const k = `${r.volunteerId}:${r.moduleId}`;
    const cur = latest.get(k);
    if (!cur || r.completedAt > cur.completedAt) latest.set(k, r);
  }
  let dueSoon = 0;
  let overdue = 0;
  let coordinator = 0;
  for (const r of latest.values()) {
    const expISO = dateToISO(r.expiresAt!);
    const days = daysBetween(today, expISO);
    const online = r.module.delivery === "ONLINE_CONFIRM";
    const blocks = r.module.requiredRoles.includes("WAREHOUSE") ? "new shifts" : "route shifts";
    const person = { id: r.volunteer.id, firstName: r.volunteer.firstName, lastName: r.volunteer.lastName, email: r.volunteer.email };
    if (days > 0 && days <= DUE_SOON_DAYS) {
      const ref = `training-due:${r.id}`;
      const exists = await db.email.findFirst({ where: { ref } });
      if (!exists) {
        await queueEmail(person, trainingDueSoon({ firstName: person.firstName, moduleName: r.module.name, expiresISO: expISO, daysLeft: days, online }), ref);
        dueSoon++;
      }
    } else if (days <= 0) {
      const ref = `training-overdue:${r.id}`;
      const recent = await db.email.findFirst({
        where: { ref, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      });
      if (!recent) {
        await queueEmail(person, trainingOverdue({ firstName: person.firstName, moduleName: r.module.name, expiredISO: expISO, online, blocks }), ref);
        overdue++;
      }
      if (-days >= COORDINATOR_OVERDUE_DAYS) {
        const coordRef = `training-overdue-coordinator:${r.id}`;
        if (!(await db.email.findFirst({ where: { ref: coordRef }, select: { id: true } }))) {
          await queueEmail(null, trainingOverdueCoordinator({ volunteerName: fullName(r.volunteer), volunteerId: r.volunteer.id, moduleName: r.module.name, expiredISO: expISO, phone: r.volunteer.phone }), coordRef);
          coordinator++;
        }
      }
    }
  }
  return { dueSoon, overdue, coordinator, checked: latest.size, nextRun: addDays(today, 1) };
}

/** Ministry of Justice check renewals: once at the renewal window and once
 *  when it runs out, to the volunteer and the coordinator. Only for
 *  volunteers whose roles need a check. Safe to run as often as you like. */
export async function runMojReminders(today: string) {
  const { mojCheckRoles } = await getSettings();
  if (mojCheckRoles.length === 0) return { due: 0, expired: 0, checked: 0 };
  const volunteers = await db.volunteer.findMany({
    where: { ...ACTIVE_POOL, roles: { hasSome: mojCheckRoles }, mojChecks: { some: {} } },
    include: { mojChecks: { orderBy: { checkedOn: "desc" }, take: 1 } },
  });
  let due = 0;
  let expired = 0;
  for (const v of volunteers) {
    const check = v.mojChecks[0]!;
    const renewsISO = mojRenewsISO(dateToISO(check.checkedOn));
    const days = daysBetween(today, renewsISO);
    if (days > MOJ_RENEWAL_DAYS) continue;
    // Matches mojStatus: the check still counts on its renewal date.
    const gone = days < 0;
    const ref = `${gone ? "moj-expired" : "moj-due"}:${check.id}`;
    if (await db.email.findFirst({ where: { ref }, select: { id: true } })) continue;
    await queueEmail(v, gone ? mojExpired({ firstName: v.firstName, renewsISO, checkUrl: MOJ_CHECK_URL }) : mojRenewalDue({ firstName: v.firstName, renewsISO, checkUrl: MOJ_CHECK_URL }), ref);
    await queueEmail(null, mojRenewalCoordinator({ volunteerName: fullName(v), volunteerId: v.id, renewsISO, expired: gone, phone: v.phone }), `${ref}:coordinator`);
    if (gone) expired++;
    else due++;
  }
  return { due, expired, checked: volunteers.length };
}

/** From 4pm NZ, reminds everyone rostered on tomorrow. People who booked after
 *  4pm today just saw the shift, so they are skipped. */
export async function runShiftReminders(now = new Date()) {
  const today = todayISO(now);
  const sendFrom = nzInstant(today, SHIFT_REMINDER_TIME);
  if (now < sendFrom) return { sent: 0 };
  const assignments = await db.assignment.findMany({
    where: {
      status: "CONFIRMED",
      createdAt: { lt: sendFrom },
      volunteer: { status: "ACTIVE" },
      shift: { date: isoToDate(addDays(today, 1)), status: "SCHEDULED" },
    },
    include: { volunteer: true, shift: { include: { template: { include: { route: true } } } } },
  });
  const refs = assignments.map((a) => `shift-reminder:${a.id}`);
  const already = new Set((await db.email.findMany({ where: { ref: { in: refs } }, select: { ref: true } })).map((e) => e.ref));
  let sent = 0;
  for (const a of assignments) {
    const ref = `shift-reminder:${a.id}`;
    if (already.has(ref)) continue;
    const { shift } = a;
    await queueEmail(
      a.volunteer,
      shiftReminder({ firstName: a.volunteer.firstName, shiftName: shiftName(shift), dateISO: dateToISO(shift.date), start: shift.startTime, end: shift.endTime, shiftId: shift.id, where: shiftLocation(shift) }),
      ref,
    );
    sent++;
  }
  return { sent };
}
