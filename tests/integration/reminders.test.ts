import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { addDays, isoToDate, nzInstant } from "@/lib/dates";
import { runReminders, runShiftReminders } from "@/lib/reminders";
import { makeVolunteer, resetDb } from "./helpers";

const TODAY = "2026-10-02";

async function shiftTomorrow() {
  const template = await db.shiftTemplate.create({
    data: { kind: "WAREHOUSE", name: "Warehouse sorting (AM)", startTime: "09:00", endTime: "12:00", capacity: 10, needed: 6, weekdays: [1, 2, 3, 4, 5] },
  });
  return db.shift.create({ data: { templateId: template.id, date: isoToDate(addDays(TODAY, 1)), startTime: "09:00", endTime: "12:00", capacity: 10, needed: 6 } });
}

describe("shift reminders", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("wait until 4pm the day before, then remind everyone once", async () => {
    const shift = await shiftTomorrow();
    const [a, b] = [await makeVolunteer(), await makeVolunteer()];
    const morning = nzInstant(TODAY, "09:00");
    for (const v of [a, b]) await db.assignment.create({ data: { shiftId: shift.id, volunteerId: v.id, source: "REGULAR", createdAt: addHours(morning, -48) } });

    expect(await runShiftReminders(nzInstant(TODAY, "15:59"))).toEqual({ sent: 0 });
    expect(await runShiftReminders(nzInstant(TODAY, "16:05"))).toEqual({ sent: 2 });
    expect(await runShiftReminders(nzInstant(TODAY, "17:05"))).toEqual({ sent: 0 });
    const emails = await db.email.findMany({ where: { kind: "SHIFT_REMINDER" } });
    expect(emails.map((e) => e.volunteerId).sort()).toEqual([a.id, b.id].sort());
    expect(emails[0].ctaHref).toBe(`/app/shifts/${shift.id}`);
  });

  it("skip people who booked after the reminder time, and released or cancelled places", async () => {
    const shift = await shiftTomorrow();
    const [late, away, gone] = [await makeVolunteer(), await makeVolunteer(), await makeVolunteer()];
    await db.assignment.create({ data: { shiftId: shift.id, volunteerId: late.id, createdAt: nzInstant(TODAY, "16:30") } });
    await db.assignment.create({ data: { shiftId: shift.id, volunteerId: away.id, status: "RELEASED", createdAt: nzInstant(TODAY, "08:00") } });
    await db.assignment.create({ data: { shiftId: shift.id, volunteerId: gone.id, status: "CANCELLED", createdAt: nzInstant(TODAY, "08:00") } });
    expect(await runShiftReminders(nzInstant(TODAY, "18:00"))).toEqual({ sent: 0 });
  });
});

describe("training reminders", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  async function setup(expiresISO: string) {
    const v = await makeVolunteer({ phone: "021 555 0101" });
    const m = await db.trainingModule.create({ data: { code: "MH", name: "Manual Handling", description: "", validityMonths: 12, requiredRoles: ["WAREHOUSE"], delivery: "ONLINE_CONFIRM" } });
    const r = await db.trainingRecord.create({ data: { volunteerId: v.id, moduleId: m.id, completedAt: isoToDate("2025-01-01"), expiresAt: isoToDate(expiresISO), method: "ONLINE" } });
    return { v, r };
  }

  it("send the due-soon reminder once", async () => {
    await setup(addDays(TODAY, 20));
    expect(await runReminders(TODAY)).toMatchObject({ dueSoon: 1, overdue: 0 });
    expect(await runReminders(TODAY)).toMatchObject({ dueSoon: 0, overdue: 0 });
  });

  it("repeat weekly while overdue and tell the coordinator once at three weeks", async () => {
    const { v } = await setup(addDays(TODAY, -21));
    expect(await runReminders(TODAY)).toMatchObject({ overdue: 1, coordinator: 1 });
    expect(await runReminders(TODAY)).toMatchObject({ overdue: 0, coordinator: 0 });
    const notice = await db.email.findFirstOrThrow({ where: { kind: "TRAINING_OVERDUE_COORDINATOR" } });
    expect(notice).toMatchObject({ volunteerId: null, toEmail: "coordinator@example.org", ctaHref: `/admin/volunteers/${v.id}` });
    expect(notice.body).toContain("021 555 0101");
  });

  it("leave inactive volunteers alone", async () => {
    const { v } = await setup(addDays(TODAY, -3));
    await db.volunteer.update({ where: { id: v.id }, data: { status: "INACTIVE" } });
    expect(await runReminders(TODAY)).toMatchObject({ overdue: 0, checked: 0 });
  });
});

function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3_600_000);
}
