import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as env from "@/lib/env";
import * as mailer from "@/lib/mailer";
import { addDays, isoToDate, todayISO } from "@/lib/dates";
import { createMobileSession } from "@/lib/mobile-auth";
import { checkPassword } from "@/lib/sign-in";
import { hashPassword } from "@/lib/passwords";
import { deleteMyAccount } from "@/lib/volunteer-actions";
import { DELETE as deleteAccount } from "@/app/api/mobile/account/route";
import { GET as getSession } from "@/app/api/mobile/session/route";
import { makeVolunteer, resetDb } from "./helpers";

// Volunteer actions refresh the pages they change, which needs a request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORIGIN = "https://volunteers.example.org";

async function shiftOn(iso: string) {
  const t = await db.shiftTemplate.create({
    data: { kind: "WAREHOUSE", name: "Warehouse sorting", startTime: "09:00", endTime: "12:00", capacity: 4, needed: 1, weekdays: [1, 2, 3, 4, 5] },
  });
  return db.shift.create({ data: { templateId: t.id, date: isoToDate(iso), startTime: "09:00", endTime: "12:00", capacity: 4, needed: 1, publishedAt: new Date() } });
}

/** A volunteer with everything a real one accumulates. */
async function wholeLife() {
  const me = await db.volunteer.create({
    data: {
      firstName: "Margaret", lastName: "Fairweather", email: "margaret@example.org", phone: "021 555 0100", suburb: "Rangiora", birthYear: 1961,
      emergencyName: "Tom Fairweather", emergencyPhone: "021 555 0101", availabilityNote: "Tuesdays", notes: "Prefers the morning sort.",
      isRegular: true, lastMinuteOk: true, passwordHash: await hashPassword("kai-rescue-demo"), emailVerifiedAt: new Date(), lastSignInAt: new Date(),
    },
  });
  const upcoming = await shiftOn(addDays(todayISO(), 7));
  const past = await shiftOn(addDays(todayISO(), -7));
  await db.assignment.create({ data: { shiftId: upcoming.id, volunteerId: me.id, source: "REGULAR" } });
  const attended = await db.assignment.create({ data: { shiftId: past.id, volunteerId: me.id, source: "REGULAR", status: "ATTENDED" } });
  await db.regularSlot.create({ data: { volunteerId: me.id, templateId: upcoming.templateId, weekday: 2 } });
  await db.absence.create({ data: { volunteerId: me.id, startDate: isoToDate(addDays(todayISO(), 20)), endDate: isoToDate(addDays(todayISO(), 21)), reason: "SICK", note: "Hospital appointment" } });
  const manualHandling = await db.trainingModule.create({ data: { code: "MH", name: "Manual handling", description: "", requiredRoles: ["WAREHOUSE"], delivery: "ONLINE_CONFIRM" } });
  const record = await db.trainingRecord.create({ data: { volunteerId: me.id, moduleId: manualHandling.id, completedAt: isoToDate(todayISO()), method: "ONLINE" } });
  await db.passkey.create({ data: { volunteerId: me.id, credentialId: "cred-1", publicKey: Buffer.from("key"), name: "iPhone" } });
  await db.oAuthAccount.create({ data: { volunteerId: me.id, provider: "google", providerAccountId: "g-1", email: "margaret@gmail.example" } });
  await db.pushToken.create({ data: { volunteerId: me.id, token: "ExponentPushToken[abc]", platform: "ios" } });
  await db.email.create({ data: { volunteerId: me.id, toName: "Margaret Fairweather", toEmail: me.email, kind: "SHIFT_REMINDER", subject: "Tomorrow", preview: "", body: "", status: "SENT" } });
  await db.contactLog.create({ data: { volunteerId: me.id, kind: "NOTE", summary: "Rang about her knee." } });
  const application = await db.application.create({
    data: { firstName: "Margaret", lastName: "Fairweather", email: me.email, phone: "021 555 0100", availability: "Tuesdays", message: "Keen to help", source: "web", status: "APPROVED", volunteerId: me.id, reviewNote: "Lovely on the phone" },
  });
  const token = await createMobileSession(me.id, "test");
  return { me, upcoming, attended, record, application, token };
}

describe("deleting my own account", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("removes who they were, keeps what they did, and tells the coordinator", async () => {
    const { me, upcoming, attended, record, application, token } = await wholeLife();

    expect(await deleteMyAccount(me)).toMatchObject({ ok: true });

    const after = await db.volunteer.findUniqueOrThrow({ where: { id: me.id } });
    expect(after).toMatchObject({ status: "DELETED", firstName: "Deleted", lastName: "volunteer", email: `deleted-${me.id}@deleted.invalid`, phone: null, suburb: null, birthYear: null, emergencyName: null, emergencyPhone: null, availabilityNote: null, notes: null, passwordHash: null, isRegular: false, lastMinuteOk: false });
    expect(JSON.stringify(after)).not.toMatch(/Margaret|Fairweather|Rangiora|555|knee/);

    // Signed out everywhere, and nothing left to sign in with.
    expect(await db.session.count({ where: { volunteerId: me.id } })).toBe(0);
    expect(await db.passkey.count()).toBe(0);
    expect(await db.oAuthAccount.count()).toBe(0);
    expect(await db.pushToken.count()).toBe(0);
    const res = await getSession(new NextRequest(`${ORIGIN}/api/mobile/session`, { headers: { authorization: `Bearer ${token}` } }), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(await checkPassword(me.email, "kai-rescue-demo", "1.2.3.4")).toMatchObject({ ok: false });

    // Off the roster ahead, on it behind.
    expect(await db.regularSlot.count()).toBe(0);
    expect(await db.absence.count()).toBe(0);
    expect((await db.assignment.findFirstOrThrow({ where: { shiftId: upcoming.id } })).status).toBe("CANCELLED");
    expect((await db.assignment.findUniqueOrThrow({ where: { id: attended.id } })).status).toBe("ATTENDED");
    expect(await db.trainingRecord.findUnique({ where: { id: record.id } })).not.toBeNull();

    // Their messages and the notes about them are gone; one line says why.
    expect(await db.email.count({ where: { volunteerId: me.id } })).toBe(0);
    const logs = await db.contactLog.findMany({ where: { volunteerId: me.id } });
    expect(logs.map((l) => l.kind)).toEqual(["STATUS_CHANGED"]);
    expect(logs[0].summary).toMatch(/Deleted their own account/);
    const app = await db.application.findUniqueOrThrow({ where: { id: application.id } });
    expect(app).toMatchObject({ firstName: "Deleted", email: `deleted-${me.id}@deleted.invalid`, phone: null, message: null, reviewNote: null, status: "APPROVED" });

    // The coordinator hears, by name, what was released.
    const told = await db.email.findMany({ where: { kind: "ACCOUNT_DELETED" } });
    expect(told).toHaveLength(1);
    expect(told[0].toEmail).toBe(env.env().COORDINATOR_EMAIL);
    expect(told[0].subject).toBe("Margaret Fairweather deleted their volunteer account");
    expect(told[0].body).toMatch(/1 regular slot and 1 upcoming shift, which now needs cover/);

    // The address is theirs again.
    const again = await makeVolunteer({ email: "margaret@example.org" });
    expect(again.email).toBe("margaret@example.org");
  });

  it("works from the app, whose token dies with the account", async () => {
    const { token } = await wholeLife();
    const call = () => deleteAccount(new NextRequest(`${ORIGIN}/api/mobile/account`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }), { params: Promise.resolve({}) });
    const first = await call();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ message: expect.stringMatching(/deleted/) });
    expect((await call()).status).toBe(401);
  });

  it("is not for coordinators or demo personas", async () => {
    const admin = await makeVolunteer({ role: "ADMIN" });
    expect(await deleteMyAccount(admin)).toMatchObject({ ok: false, error: expect.stringMatching(/Coordinators cannot/) });
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: admin.id } })).status).toBe("ACTIVE");

    const persona = await makeVolunteer();
    vi.spyOn(env, "isDemo").mockReturnValue(true);
    expect(await deleteMyAccount(persona)).toMatchObject({ ok: false, error: expect.stringMatching(/Demo accounts/) });
    expect((await db.volunteer.findUniqueOrThrow({ where: { id: persona.id } })).status).toBe("ACTIVE");
  });
});
