import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShiftsWeek } from "@satisfy/core/api";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { addDays, isoToDate, todayISO, weekMonday } from "@/lib/dates";
import { createMobileSession } from "@/lib/mobile-auth";
import { cancelBooking } from "@/lib/volunteer-actions";
import { GET as getShifts } from "@/app/api/mobile/shifts/route";
import { makeVolunteer, resetDb } from "./helpers";

// Volunteer actions refresh the pages they change, which needs a request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

async function template(needed: number) {
  return db.shiftTemplate.create({
    data: { kind: "WAREHOUSE", name: `Warehouse sorting (needs ${needed})`, startTime: "09:00", endTime: "12:00", capacity: 4, needed, weekdays: [1, 2, 3, 4, 5] },
  });
}

async function shiftOn(iso: string, needed: number) {
  const t = await template(needed);
  return db.shift.create({ data: { templateId: t.id, date: isoToDate(iso), startTime: "09:00", endTime: "12:00", capacity: 4, needed, publishedAt: new Date() } });
}

describe("cancelling a booking", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("works once: a repeat is refused and the coordinator hears about the gap once", async () => {
    const me = await makeVolunteer();
    const shift = await shiftOn(addDays(todayISO(), 7), 1);
    const booking = await db.assignment.create({ data: { shiftId: shift.id, volunteerId: me.id, source: "BOOKED" } });

    expect(await cancelBooking(me, booking.id)).toMatchObject({ ok: true });
    expect(await cancelBooking(me, booking.id)).toEqual({ ok: false, error: "That booking is already cancelled." });
    expect(await cancelBooking(me, booking.id)).toMatchObject({ ok: false });

    const alerts = await db.email.findMany({ where: { kind: "GAP_ALERT" } });
    expect(alerts.map((e) => e.ref)).toEqual([`gap-alert:${booking.id}`]);
  });

  it("leaves attendance the coordinator has marked alone", async () => {
    const me = await makeVolunteer();
    const shift = await shiftOn(todayISO(), 1);
    const booking = await db.assignment.create({ data: { shiftId: shift.id, volunteerId: me.id, source: "BOOKED", status: "NO_SHOW" } });

    expect(await cancelBooking(me, booking.id)).toEqual({ ok: false, error: "That booking can no longer be cancelled." });
    expect((await db.assignment.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe("NO_SHOW");
  });

  it("is only for the volunteer's own booking", async () => {
    const [me, other] = [await makeVolunteer(), await makeVolunteer()];
    const shift = await shiftOn(addDays(todayISO(), 7), 1);
    const theirs = await db.assignment.create({ data: { shiftId: shift.id, volunteerId: other.id, source: "BOOKED" } });

    expect(await cancelBooking(me, theirs.id)).toMatchObject({ ok: false, notFound: true });
    expect((await db.assignment.findUniqueOrThrow({ where: { id: theirs.id } })).status).toBe("CONFIRMED");
  });
});

describe("the app's week of shifts", () => {
  beforeEach(resetDb);

  it("says who is away from a gap, never why, and explains nothing else", async () => {
    const wednesday = addDays(weekMonday(addDays(todayISO(), 7)), 2);
    const [sick, onShift, away, viewer] = [
      await makeVolunteer({ firstName: "Heather" }),
      await makeVolunteer(),
      await makeVolunteer({ firstName: "Brian" }),
      await makeVolunteer(),
    ];
    const absence = (volunteerId: string) =>
      db.absence.create({ data: { volunteerId, startDate: isoToDate(wednesday), endDate: isoToDate(wednesday), reason: "SICK" } });

    // Needs two, has one: a gap, explained by Heather's absence.
    const gap = await shiftOn(wednesday, 2);
    await db.assignment.create({ data: { shiftId: gap.id, volunteerId: onShift.id, source: "REGULAR" } });
    await db.assignment.create({ data: { shiftId: gap.id, volunteerId: sick.id, source: "REGULAR", status: "RELEASED", absenceId: (await absence(sick.id)).id } });
    // Needs one, has one: Brian being away leaves nothing to explain.
    const covered = await shiftOn(wednesday, 1);
    await db.assignment.create({ data: { shiftId: covered.id, volunteerId: onShift.id, source: "REGULAR" } });
    await db.assignment.create({ data: { shiftId: covered.id, volunteerId: away.id, source: "REGULAR", status: "RELEASED", absenceId: (await absence(away.id)).id } });

    const token = await createMobileSession(viewer.id, "test");
    const res = await getShifts(new NextRequest(`https://volunteers.example.org/api/mobile/shifts?week=${wednesday}`, { headers: { authorization: `Bearer ${token}` } }), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    const week = (await res.json()) as ShiftsWeek;
    const shifts = week.days.flatMap((d) => d.shifts);
    expect(shifts.find((s) => s.id === gap.id)?.causes).toEqual(["Heather Test away"]);
    expect(shifts.find((s) => s.id === covered.id)?.causes).toEqual([]);
    expect(JSON.stringify(week).toLowerCase()).not.toContain("sick");
  });
});
