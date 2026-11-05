import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import * as mailer from "@/lib/mailer";
import { addDays, addMonths, isoToDate, todayISO } from "@/lib/dates";
import { recordMojCheck, saveMojRoles } from "@/lib/induction-admin";
import { publishVersion, saveDocument } from "@/lib/document-admin";
import { inductionFor } from "@/lib/induction-data";
import { acknowledgeDocument, bookShift, completeOnlineModule, signAgreements } from "@/lib/volunteer-actions";
import { runMojReminders } from "@/lib/reminders";
import { queueEmail } from "@/lib/emails";
import * as T from "@/lib/email-templates";
import { makeVolunteer, resetDb } from "./helpers";

// Volunteer actions refresh the pages they change, which needs a request.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const today = todayISO();

async function agreement(title = "Volunteer Agreement") {
  return db.document.create({ data: { kind: "AGREEMENT", title, summary: "s", body: "Words", roles: ["WAREHOUSE", "HARVEST"] } });
}

async function warehouseShift() {
  const t = await db.shiftTemplate.create({ data: { kind: "WAREHOUSE", name: "Warehouse sorting (AM)", startTime: "09:00", endTime: "12:00", capacity: 4, needed: 1, weekdays: [1, 2, 3, 4, 5] } });
  return db.shift.create({ data: { templateId: t.id, date: isoToDate(addDays(today, 3)), startTime: "09:00", endTime: "12:00", capacity: 4, needed: 1, publishedAt: new Date() } });
}

describe("induction", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("records a sighted Ministry of Justice check and tells the volunteer", async () => {
    const phillipa = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });
    const jess = await makeVolunteer({ firstName: "Jess" });
    await saveMojRoles({ roles: ["WAREHOUSE"] });
    expect((await inductionFor(jess)).moj.status).toBe("NEEDED");

    expect(await recordMojCheck(phillipa, { volunteerId: jess.id, checkedISO: addDays(today, 1), note: "" })).toMatchObject({ ok: false, error: "The date on the check cannot be in the future." });
    const stale = addDays(addMonths(today, -36), -1);
    expect(await recordMojCheck(phillipa, { volunteerId: jess.id, checkedISO: stale, note: "" })).toMatchObject({ ok: false, error: expect.stringContaining("Jess needs a new one") });

    const checked = addDays(today, -10);
    expect(await recordMojCheck(phillipa, { volunteerId: jess.id, checkedISO: checked, note: "Emailed copy" })).toMatchObject({ ok: true });
    expect(await inductionFor(jess)).toMatchObject({ complete: true, moj: { status: "CURRENT", checkedISO: checked, renewsISO: addMonths(checked, 36) } });
    expect(await db.contactLog.findFirst({ where: { volunteerId: jess.id } })).toMatchObject({ kind: "MOJ_CHECK", authorId: phillipa.id, summary: expect.stringContaining("Emailed copy") });
    expect(await db.email.findFirst({ where: { volunteerId: jess.id } })).toMatchObject({ kind: "MOJ_CHECK_RECORDED", body: expect.stringContaining("Your induction is complete") });
  });

  it("keeps training and booking closed until the agreements are signed, at the version read", async () => {
    const jess = await makeVolunteer({ firstName: "Jess" });
    const doc = await agreement();
    const shift = await warehouseShift();
    const online = await db.trainingModule.create({ data: { code: "MH", name: "Manual Handling", description: "", validityMonths: 12, requiredRoles: ["WAREHOUSE"], delivery: "ONLINE_CONFIRM", content: "Lift with your legs." } });

    expect(await completeOnlineModule(jess, online.id)).toMatchObject({ ok: false, error: "Finish your induction before training: sign the Volunteer Agreement first." });
    expect(await bookShift(jess, shift.id)).toMatchObject({ ok: false, error: "Sign the Volunteer Agreement first" });

    // A new version published since the page loaded is not signed unseen.
    await db.document.update({ where: { id: doc.id }, data: { version: 2 } });
    expect(await signAgreements(jess, { agreements: [{ id: doc.id, version: 1 }] })).toMatchObject({ ok: false, error: expect.stringContaining("has just been updated") });
    expect(await signAgreements(jess, { agreements: [{ id: doc.id, version: 2 }] })).toMatchObject({ ok: true, message: "Volunteer Agreement signed. Thank you." });
    expect(await db.contactLog.findFirst({ where: { volunteerId: jess.id, kind: "AGREEMENT_SIGNED" } })).toMatchObject({ summary: "Signed the Volunteer Agreement (version 2)." });

    expect(await completeOnlineModule(jess, online.id)).toMatchObject({ ok: true });
    expect(await bookShift(jess, shift.id)).toMatchObject({ ok: true });
  });

  it("runs training stages in order", async () => {
    const jess = await makeVolunteer({ firstName: "Jess" });
    const t1 = await db.trainingModule.create({ data: { code: "T1", name: "Sorting T1", description: "", requiredRoles: ["WAREHOUSE"], delivery: "ONLINE_CONFIRM", content: "One." } });
    const t2 = await db.trainingModule.create({ data: { code: "T2", name: "Sorting T2", description: "", requiredRoles: ["WAREHOUSE"], delivery: "ONLINE_CONFIRM", content: "Two.", prerequisiteId: t1.id } });
    expect(await completeOnlineModule(jess, t2.id)).toMatchObject({ ok: false, error: "Complete Sorting T1 first." });
    expect(await completeOnlineModule(jess, t1.id)).toMatchObject({ ok: true });
    expect(await completeOnlineModule(jess, t2.id)).toMatchObject({ ok: true });
  });
});

describe("policies", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("asks everyone it is for to read a new version, once each", async () => {
    const margaret = await makeVolunteer({ firstName: "Margaret" });
    const emma = await makeVolunteer({ firstName: "Emma", roles: ["HARVEST"] });
    const coordinator = await makeVolunteer({ firstName: "Phillipa", role: "ADMIN" });
    expect(await saveDocument({ id: null, kind: "POLICY", title: "Health and Safety Policy", summary: "Keeping safe", url: "https://drive.google.com/file/d/abc/view", body: "", roles: [], notify: false })).toMatchObject({ ok: true, message: "Added. 2 volunteers can read it." });
    const doc = await db.document.findFirstOrThrow();

    expect(await acknowledgeDocument(margaret, doc.id, 1)).toMatchObject({ ok: true });
    expect(await publishVersion({ id: doc.id, note: "New ramp", notify: true })).toMatchObject({ ok: true, message: "Version 2 published. Volunteers are asked to read it again; 2 volunteers have been emailed." });
    const sent = await db.email.findMany({ where: { kind: "DOCUMENT_UPDATED" } });
    expect(sent.map((e) => e.volunteerId).sort()).toEqual([emma.id, emma.id, margaret.id, margaret.id].sort());
    expect(sent.some((e) => e.volunteerId === coordinator.id)).toBe(false);
    expect(sent.find((e) => e.channel === "EMAIL")).toMatchObject({ subject: "Please read: Health and Safety Policy", body: expect.stringContaining("New ramp."), ctaHref: `/app/policies/${doc.id}` });

    // Reading the old version no longer counts, and the stale version is refused.
    expect(await acknowledgeDocument(margaret, doc.id, 1)).toMatchObject({ ok: false, error: expect.stringContaining("has just been updated") });
    expect(await acknowledgeDocument(margaret, doc.id, 2)).toMatchObject({ ok: true });
    expect(await db.documentAcknowledgement.count({ where: { volunteerId: margaret.id } })).toBe(2);
  });

  it("refuses an agreement nobody signs, or one with nothing to read", async () => {
    expect(await saveDocument({ id: null, kind: "AGREEMENT", title: "Volunteer Agreement", summary: "Signed by everyone", url: "", body: "Words", roles: [], notify: false })).toMatchObject({ ok: false, error: "Pick the roles that sign it." });
    expect(await saveDocument({ id: null, kind: "POLICY", title: "Policy", summary: "Read me", url: "", body: "", roles: [], notify: false })).toMatchObject({ ok: false });
    expect(await saveDocument({ id: null, kind: "POLICY", title: "Policy", summary: "Read me", url: "http://example.org", body: "", roles: [], notify: false })).toMatchObject({ ok: false, error: "The link must start with https://" });
  });
});

describe("Ministry of Justice renewals", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("remind the volunteer and the coordinator once when due, and again when it runs out", async () => {
    const [due, gone, fresh, harvester] = [await makeVolunteer({ firstName: "Due" }), await makeVolunteer({ firstName: "Gone" }), await makeVolunteer({ firstName: "Fresh" }), await makeVolunteer({ firstName: "Picker", roles: ["HARVEST"] })];
    await saveMojRoles({ roles: ["WAREHOUSE"] });
    const at = (yearsAndDays: number) => isoToDate(addDays(addMonths(today, -36), yearsAndDays));
    await db.mojCheck.createMany({
      data: [
        { volunteerId: due.id, checkedOn: at(30) },
        { volunteerId: gone.id, checkedOn: at(-2) },
        { volunteerId: fresh.id, checkedOn: isoToDate(addDays(today, -100)) },
        { volunteerId: harvester.id, checkedOn: at(-2) },
      ],
    });

    expect(await runMojReminders(today)).toEqual({ due: 1, expired: 1, checked: 3 });
    expect(await runMojReminders(today)).toEqual({ due: 0, expired: 0, checked: 3 });
    const emails = await db.email.findMany({ orderBy: { createdAt: "asc" } });
    expect(emails.filter((e) => e.volunteerId === due.id)).toMatchObject([{ kind: "MOJ_CHECK_RENEWAL", subject: "Time to renew your Ministry of Justice check" }]);
    expect(emails.filter((e) => e.volunteerId === gone.id)).toMatchObject([{ kind: "MOJ_CHECK_RENEWAL", subject: "Action needed: your Ministry of Justice check has run out" }]);
    expect(emails.filter((e) => e.volunteerId === null).map((e) => e.kind)).toEqual(["MOJ_CHECK_RENEWAL_COORDINATOR", "MOJ_CHECK_RENEWAL_COORDINATOR"]);
  });
});

describe("coordinators' wording", () => {
  beforeEach(async () => {
    await resetDb();
    vi.spyOn(mailer, "sendEmail").mockResolvedValue("re");
  });
  afterEach(() => vi.restoreAllMocks());

  it("is used in place of the standard wording when a message is sent", async () => {
    const v = await makeVolunteer({ firstName: "Margaret" });
    const draft = T.shiftReminder({ firstName: "Margaret", shiftName: "Warehouse sorting (AM)", dateISO: "2026-11-10", start: "09:00", end: "12:00", shiftId: "s1", where: "the warehouse" });
    await db.emailTemplate.create({ data: { key: "shift-reminder", subject: "Tomorrow: {shiftName}", preview: "{time}", body: "Hi {firstName}.\n\nNote: {missing}\n\nSee you at {place}.", ctaLabel: "Open it" } });
    const row = await queueEmail(v, draft);
    expect(row).toMatchObject({ subject: "Tomorrow: Warehouse sorting (AM)", preview: "9am - 12pm", body: "Hi Margaret.\n\nNote: {missing}\n\nSee you at the warehouse.", ctaLabel: "Open it", ctaHref: "/app/shifts/s1" });

    await db.emailTemplate.deleteMany();
    expect(await queueEmail(v, draft)).toMatchObject({ subject: draft.subject, body: draft.body, ctaLabel: "View shift" });
  });
});
