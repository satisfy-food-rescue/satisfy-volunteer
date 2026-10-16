import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as expoPush from "@/lib/expo-push";
import * as mailer from "@/lib/mailer";
import { queueEmail, withCapturedEmails } from "@/lib/emails";
import * as T from "@/lib/email-templates";
import { makeVolunteer, resetDb } from "./helpers";

const push = () => T.shiftAddedPush({ firstName: "Fiona", shiftName: "Warehouse sorting (AM)", dateISO: "2026-10-20", start: "09:00", end: "12:00", location: "Rangiora", shiftId: "s1", addedBy: "Phillipa", covering: false });
const TOKEN = "ExponentPushToken[phone-1]";

async function settled(id: string) {
  await vi.waitFor(async () => expect((await db.email.findUniqueOrThrow({ where: { id } })).status).not.toBe("PENDING"));
  return db.email.findUniqueOrThrow({ where: { id } });
}

describe("push notifications", () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it("go to the volunteer's phone through Expo", async () => {
    const send = vi.spyOn(expoPush, "sendExpoPush").mockResolvedValue({ delivered: [TOKEN], ticketIds: ["ticket-1"], unregistered: [] });
    const v = await makeVolunteer();
    await db.pushToken.create({ data: { token: TOKEN, volunteerId: v.id, platform: "ios" } });
    const row = await queueEmail(v, push());
    expect(row.channel).toBe("PUSH");
    expect(await settled(row.id)).toMatchObject({ status: "SENT", providerId: "ticket-1", channel: "PUSH" });
    expect(send.mock.calls[0][0]).toEqual([TOKEN]);
    expect(send.mock.calls[0][1]).toMatchObject({ data: { url: "/app/shifts/s1", kind: "SHIFT_ADDED" } });
  });

  it("go by email to someone not signed in to the app on a phone", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re_1");
    const v = await makeVolunteer({ firstName: "Fiona" });
    const row = await queueEmail(v, push());
    expect(row.channel).toBe("EMAIL");
    expect(row.body).toMatch(/^Kia ora Fiona,\n\n/);
    expect(await settled(row.id)).toMatchObject({ status: "SENT", providerId: "re_1" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("fall back to email when every phone has uninstalled the app", async () => {
    vi.spyOn(expoPush, "sendExpoPush").mockResolvedValue({ delivered: [], ticketIds: [], unregistered: [TOKEN] });
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re_2");
    const v = await makeVolunteer({ firstName: "Fiona" });
    await db.pushToken.create({ data: { token: TOKEN, volunteerId: v.id, platform: "android" } });
    const row = await queueEmail(v, push());
    expect(await settled(row.id)).toMatchObject({ status: "SENT", channel: "EMAIL", providerId: "re_2" });
    expect(send).toHaveBeenCalledTimes(1);
    expect(await db.pushToken.count()).toBe(0);
  });

  it("are retried when Expo cannot be reached", async () => {
    vi.spyOn(expoPush, "sendExpoPush").mockResolvedValue({ delivered: [], ticketIds: [], unregistered: [] });
    const v = await makeVolunteer();
    await db.pushToken.create({ data: { token: TOKEN, volunteerId: v.id, platform: "ios" } });
    const row = await queueEmail(v, push());
    expect(await settled(row.id)).toMatchObject({ status: "FAILED", channel: "PUSH" });
  });

  it("are only recorded while the demo seed runs", async () => {
    const send = vi.spyOn(expoPush, "sendExpoPush");
    const v = await makeVolunteer();
    await db.pushToken.create({ data: { token: TOKEN, volunteerId: v.id, platform: "ios" } });
    const row = await withCapturedEmails(() => queueEmail(v, push()));
    expect(row).toMatchObject({ channel: "PUSH", status: "CAPTURED" });
    expect(send).not.toHaveBeenCalled();
  });
});
