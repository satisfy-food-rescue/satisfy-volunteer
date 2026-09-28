import { db } from "./db";
import { addDays, dateToISO, daysBetween } from "./dates";
import { DUE_SOON_DAYS } from "./domain";
import { trainingDueSoon, trainingOverdue } from "./email-templates";
import { queueEmail } from "./emails";

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
    audience: "The volunteer, coordinator copied after 3 weeks",
    template: "Training overdue",
    detail: "Stops automatically the moment the module is refreshed.",
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
    when: "As soon as an absence releases a shift",
    audience: "Coordinator",
    template: "Coverage gap alert",
    detail: "Also lists the shift under Open gaps for eligible volunteers.",
  },
] as const;

/** Generates any reminders that are due today and not yet in the Outbox.
 *  In production this is a nightly job; in the demo it runs on demand. */
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
    }
  }
  return { dueSoon, overdue, checked: latest.size, nextRun: addDays(today, 1) };
}
