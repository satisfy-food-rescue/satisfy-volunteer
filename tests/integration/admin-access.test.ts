import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { addDays, isoToDate, todayISO } from "@/lib/dates";
import { grantAdminAccess, revokeAdminAccess } from "@/lib/admin-access";
import { makeVolunteer, resetDb } from "./helpers";

const form = (over: Partial<{ firstName: string; lastName: string; email: string; releaseConfirmed: boolean }> = {}) => ({
  firstName: "Aroha",
  lastName: "Ngata",
  email: "Aroha.Ngata@Example.NZ",
  releaseConfirmed: false,
  ...over,
});

/** A regular slot, an upcoming shift (the only crew, so releasing it opens a
 *  gap) and a past shift they attended. */
async function rosterOn(volunteerId: string) {
  const today = todayISO();
  const template = await db.shiftTemplate.create({
    data: { kind: "WAREHOUSE", name: "Warehouse sorting (AM)", startTime: "09:00", endTime: "12:00", capacity: 4, needed: 1, weekdays: [1, 2, 3, 4, 5] },
  });
  const shift = (date: string) => db.shift.create({ data: { templateId: template.id, date: isoToDate(date), startTime: "09:00", endTime: "12:00", capacity: 4, needed: 1, publishedAt: new Date() } });
  const [upcoming, past] = await Promise.all([shift(addDays(today, 10)), shift(addDays(today, -7))]);
  await db.assignment.create({ data: { shiftId: upcoming.id, volunteerId, source: "REGULAR" } });
  await db.assignment.create({ data: { shiftId: past.id, volunteerId, source: "REGULAR", status: "ATTENDED" } });
  await db.regularSlot.create({ data: { volunteerId, templateId: template.id, weekday: 2 } });
  await db.volunteer.update({ where: { id: volunteerId }, data: { isRegular: true } });
  return { upcoming, past };
}

describe("coordinator access", () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it("creates a new coordinator and emails a coordinator invite", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const phillipa = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });

    const r = await grantAdminAccess(phillipa, form());
    expect(r).toMatchObject({ ok: true, message: "Aroha Ngata is now a coordinator. Aroha has been emailed a link to set up their account." });
    const aroha = await db.volunteer.findUniqueOrThrow({ where: { email: "aroha.ngata@example.nz" }, include: { contactLogs: true } });
    expect(aroha).toMatchObject({ role: "ADMIN", status: "ACTIVE", passwordHash: null });
    expect(aroha.contactLogs).toMatchObject([{ kind: "ACCOUNT_CREATED", authorId: phillipa.id, summary: "Added as a coordinator by Phillipa." }]);
    expect(send.mock.calls[0][0]).toMatchObject({ subject: "Set up your Satisfy coordinator account", ctaHref: expect.stringContaining("/reset-password?token=") });
    expect(await db.authToken.count({ where: { volunteerId: aroha.id, purpose: "INVITE" } })).toBe(1);
  });

  it("refuses someone who is already a coordinator, and a malformed form", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const phillipa = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });
    expect(await grantAdminAccess(phillipa, form({ email: phillipa.email.toUpperCase() }))).toMatchObject({ ok: false, field: "email", error: "Phillipa Test is already a coordinator." });
    expect(await grantAdminAccess(phillipa, form({ email: "not an email" }))).toMatchObject({ ok: false, field: "email" });
    expect(await grantAdminAccess(phillipa, form({ firstName: " " }))).toMatchObject({ ok: false, field: "firstName" });
    expect(await db.volunteer.count()).toBe(1);
  });

  it("asks before taking a rostered volunteer off their shifts, then moves them across", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const phillipa = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });
    const margaret = await makeVolunteer({ firstName: "Margaret", email: "margaret@example.org", roles: ["WAREHOUSE", "HARVEST"] });
    await db.volunteer.update({ where: { id: margaret.id }, data: { passwordHash: "x", lastSignInAt: new Date() } });
    const { upcoming, past } = await rosterOn(margaret.id);

    // The name typed is ignored for an existing person; nothing changes yet.
    const ask = await grantAdminAccess(phillipa, form({ firstName: "Maggie", email: "Margaret@Example.org" }));
    expect(ask).toMatchObject({ ok: false, confirm: { name: "Margaret Test", firstName: "Margaret", upcomingShifts: 1, regularSlots: 1 } });
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: margaret.id } })).role).toBe("VOLUNTEER");

    const r = await grantAdminAccess(phillipa, form({ email: "margaret@example.org", releaseConfirmed: true }));
    expect(r).toMatchObject({ ok: true, message: "Margaret Test is now a coordinator and has come off 1 upcoming shift, which now needs cover. Margaret has been emailed." });
    const after = await db.volunteer.findUniqueOrThrow({ where: { id: margaret.id }, include: { regularSlots: true, assignments: true, contactLogs: true } });
    expect(after).toMatchObject({ role: "ADMIN", firstName: "Margaret", isRegular: false, roles: ["WAREHOUSE", "HARVEST"] });
    expect(after.regularSlots).toHaveLength(0);
    expect(after.assignments.find((a) => a.shiftId === upcoming.id)?.status).toBe("CANCELLED");
    // History is kept.
    expect(after.assignments.find((a) => a.shiftId === past.id)?.status).toBe("ATTENDED");
    expect(after.contactLogs).toMatchObject([{ kind: "ADMIN_ACCESS", summary: "Made a coordinator by Phillipa. Removed from 1 regular slot and 1 upcoming shift." }]);
    // Already signs in, so told about it rather than sent a link.
    expect(await db.email.findFirst({ where: { volunteerId: margaret.id, kind: "ADMIN_ACCESS" } })).toMatchObject({ subject: "You are now a Satisfy coordinator", ctaHref: "/admin" });
    expect(await db.authToken.count({ where: { volunteerId: margaret.id } })).toBe(0);
  });

  it("reactivates an inactive volunteer and invites one who never signed in", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const phillipa = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });
    const sam = await makeVolunteer({ firstName: "Sam", email: "sam@example.org" });
    await db.volunteer.update({ where: { id: sam.id }, data: { status: "INACTIVE" } });

    expect(await grantAdminAccess(phillipa, form({ email: "sam@example.org" }))).toMatchObject({ ok: true, message: "Sam Test is now a coordinator. Sam has been emailed a link to set up their account." });
    expect(await db.volunteer.findUniqueOrThrow({ where: { id: sam.id } })).toMatchObject({ role: "ADMIN", status: "ACTIVE" });
    expect(send.mock.calls[0][0]).toMatchObject({ subject: "Set up your Satisfy coordinator account" });
    expect(await db.contactLog.findFirst({ where: { volunteerId: sam.id } })).toMatchObject({ summary: "Made a coordinator by Phillipa. Reactivated." });
  });

  it("removes access, making them a volunteer again", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const phillipa = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });
    const aroha = await makeVolunteer({ firstName: "Aroha", role: "ADMIN" });

    expect(await revokeAdminAccess(phillipa, aroha.id)).toMatchObject({ ok: true, message: "Aroha Test is no longer a coordinator and is listed under Volunteers. Aroha has been emailed." });
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: aroha.id } })).role).toBe("VOLUNTEER");
    expect(await db.contactLog.findFirst({ where: { volunteerId: aroha.id } })).toMatchObject({ kind: "ADMIN_ACCESS", authorId: phillipa.id, summary: "Coordinator access removed by Phillipa." });
    expect(await db.email.findFirst({ where: { volunteerId: aroha.id } })).toMatchObject({ kind: "ADMIN_ACCESS", subject: "Your Satisfy coordinator access has been removed" });
    // Not a coordinator any more, so there is nothing left to remove.
    expect(await revokeAdminAccess(phillipa, aroha.id)).toMatchObject({ ok: false, error: "That person is not a coordinator any more." });
  });

  it("never removes your own access or leaves nobody", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const phillipa = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });
    expect(await revokeAdminAccess(phillipa, phillipa.id)).toMatchObject({ ok: false, error: expect.stringContaining("cannot remove your own") });

    // Someone whose own access has gone cannot remove the last coordinator.
    const former = await makeVolunteer({ firstName: "Former" });
    expect(await revokeAdminAccess(former, phillipa.id)).toMatchObject({ ok: false, error: expect.stringContaining("Your coordinator access has changed") });
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: phillipa.id } })).role).toBe("ADMIN");
  });

  it("keeps one coordinator when two remove each other at once", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
    const a = await makeVolunteer({ firstName: "Ana", role: "ADMIN" });
    const b = await makeVolunteer({ firstName: "Ben", role: "ADMIN" });

    const results = await Promise.all([revokeAdminAccess(a, b.id), revokeAdminAccess(b, a.id)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.volunteer.count({ where: { role: "ADMIN", status: "ACTIVE" } })).toBe(1);
  });
});
