import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { deliverEmail, queueEmail, sweepOutbox, withCapturedEmails } from "@/lib/emails";
import * as T from "@/lib/email-templates";
import { makeVolunteer, resetDb } from "./helpers";

const draft = (firstName: string) => T.coverConfirmed({ firstName, shiftName: "Warehouse sorting (AM)", dateISO: "2026-10-07", start: "09:00", end: "12:00", shiftId: "s1" });

describe("the outbox", () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it("records a message, then delivers it once", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockResolvedValue("re_123");
    const v = await makeVolunteer({ firstName: "Tony" });
    const row = await queueEmail(v, draft("Tony"));
    // Outside a request, delivery runs straight away instead of after().
    await vi.waitFor(async () => expect((await db.email.findUniqueOrThrow({ where: { id: row!.id } })).status).toBe("SENT"));
    const sent = await db.email.findUniqueOrThrow({ where: { id: row!.id } });
    expect(sent).toMatchObject({ providerId: "re_123", attempts: 1, toEmail: v.email });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ idempotencyKey: `email-${row!.id}`, audience: "volunteer" });
    // A second delivery attempt is a no-op.
    expect(await deliverEmail(row!.id)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("sends coordinator alerts to the coordinator address", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re_1");
    const row = await queueEmail(null, T.gapAlert({ shiftName: "Warehouse", dateISO: "2026-10-07", start: "09:00", end: "12:00", cause: "Brian away", shiftId: "s1" }));
    expect(row).toMatchObject({ toEmail: "coordinator@example.org", toName: "Volunteer coordinator", volunteerId: null });
  });

  it("marks failures and retries them on the sweep", async () => {
    const send = vi.spyOn(mailer, "sendEmail").mockRejectedValueOnce(new Error("Resend: rate_limit_exceeded")).mockResolvedValue("re_2");
    const v = await makeVolunteer();
    const row = await queueEmail(v, draft(v.firstName));
    await vi.waitFor(async () => expect((await db.email.findUniqueOrThrow({ where: { id: row!.id } })).status).toBe("FAILED"));
    expect((await db.email.findUniqueOrThrow({ where: { id: row!.id } })).lastError).toContain("rate_limit_exceeded");

    // Too fresh for the sweep: it may still be in flight.
    expect((await sweepOutbox()).retried).toBe(0);
    const later = new Date(Date.now() + 5 * 60_000);
    expect(await sweepOutbox(later)).toEqual({ retried: 1, sent: 1 });
    expect(await db.email.findUniqueOrThrow({ where: { id: row!.id } })).toMatchObject({ status: "SENT", attempts: 2, lastError: null });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("gives up after five attempts", async () => {
    vi.spyOn(mailer, "sendEmail").mockRejectedValue(new Error("down"));
    const v = await makeVolunteer();
    const row = await queueEmail(v, draft(v.firstName));
    await vi.waitFor(async () => expect((await db.email.findUniqueOrThrow({ where: { id: row!.id } })).status).toBe("FAILED"));
    const later = new Date(Date.now() + 5 * 60_000);
    for (let i = 0; i < 6; i++) await sweepOutbox(later);
    expect((await db.email.findUniqueOrThrow({ where: { id: row!.id } })).attempts).toBe(5);
  });

  it("sends push drafts as email until web push exists", async () => {
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re_3");
    const v = await makeVolunteer({ firstName: "Moana" });
    const row = await queueEmail(v, T.lastMinuteCallout({ shiftName: "Driver help", dateISO: "2026-10-03", start: "08:00", end: "11:30", shiftId: "s9" }));
    expect(row!.channel).toBe("EMAIL");
    expect(row!.body).toMatch(/^Kia ora Moana,/);
    expect(row!.body).toContain("Ngā mihi nui");
    await vi.waitFor(async () => expect((await db.email.findUniqueOrThrow({ where: { id: row!.id } })).status).toBe("SENT"));
  });

  it("captures without sending inside withCapturedEmails", async () => {
    const send = vi.spyOn(mailer, "sendEmail");
    const v = await makeVolunteer();
    const row = await withCapturedEmails(() => queueEmail(v, draft(v.firstName)));
    expect(row!.status).toBe("CAPTURED");
    expect(send).not.toHaveBeenCalled();
  });
});
