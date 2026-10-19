import { describe, expect, it } from "vitest";
import { renderEmail } from "@/lib/mailer";
import * as T from "@/lib/email-templates";
import { EMAIL_KIND_LABEL } from "@/lib/domain";

describe("email rendering", () => {
  const draft = T.coverConfirmed({ firstName: "Tony", shiftName: "Driver help: Rangiora / Kaiapoi", dateISO: "2026-10-07", start: "08:00", end: "11:30", shiftId: "abc123" });

  it("makes links and the logo absolute", async () => {
    const { html } = await renderEmail({ ...draft, audience: "volunteer" });
    expect(html).toContain('href="https://volunteers.example.org/app/shifts/abc123"');
    expect(html).toContain('src="https://volunteers.example.org/email/logo.png"');
  });

  it("keeps line breaks inside a paragraph in the plain-text version", async () => {
    const { text } = await renderEmail({ ...draft, audience: "volunteer" });
    expect(text).toContain("Ngā mihi nui,\nThe Satisfy volunteer team");
    expect(text).toContain("Kia ora Tony,");
  });

  it("escapes what people type", async () => {
    const request = T.roleChangeRequest({ volunteerName: "Sam <script>", volunteerId: "v1", message: "<b>hi</b>" });
    const { html } = await renderEmail({ ...request, audience: "coordinator" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
  });

  it("tells applicants why they got it", async () => {
    const { text } = await renderEmail({ ...T.applicationReceived({ firstName: "Aroha" }), audience: "applicant" });
    expect(text).toContain("because you applied to volunteer with Satisfy");
    expect(text).toContain("Kia ora Aroha,");
  });

  it("tells coordinators why they got it", async () => {
    const { text } = await renderEmail({ ...T.gapAlert({ shiftName: "Warehouse", dateISO: "2026-10-07", start: "09:00", end: "12:00", cause: "Brian away", shiftId: "s1" }), audience: "coordinator" });
    expect(text).toContain("Sent to the volunteer coordinator");
  });
});

describe("templates", () => {
  it("never store sign-in links", () => {
    expect(T.accountInvite({ firstName: "Jess", expiresDays: 7 }).ctaHref).toBeUndefined();
    expect(T.passwordReset({ firstName: "Jess", expiresHours: 2, hasPassword: true }).ctaHref).toBeUndefined();
  });

  it("have a label for every kind they produce", () => {
    const drafts = [
      T.trainingDueSoon({ firstName: "A", moduleName: "M", expiresISO: "2026-11-01", daysLeft: 30, online: true }),
      T.trainingOverdueCoordinator({ volunteerName: "A B", volunteerId: "v", moduleName: "M", expiredISO: "2026-09-01", phone: null }),
      T.lastMinuteCallout({ shiftName: "S", dateISO: "2026-10-03", start: "08:00", end: "11:30", shiftId: "s" }),
    ];
    for (const d of drafts) expect(EMAIL_KIND_LABEL[d.kind]).toBeTruthy();
  });

  it("word coordinator access for the coordinator admin", () => {
    expect(T.accountInvite({ firstName: "Aroha", expiresDays: 7, coordinator: true })).toMatchObject({ subject: "Set up your Satisfy coordinator account", body: expect.stringContaining("coordinator admin") });
    expect(T.accountInvite({ firstName: "Jess", expiresDays: 7 }).subject).toBe("Set up your Satisfy volunteer account");

    const granted = T.adminAccessGranted({ firstName: "Margaret", grantedBy: "Phillipa", releasedShifts: 3, releasedSlots: 1 });
    expect(granted).toMatchObject({ kind: "ADMIN_ACCESS", ctaHref: "/admin" });
    expect(granted.body).toContain("taken off your regular slot and 3 upcoming shifts");
    expect(T.adminAccessGranted({ firstName: "Sam", grantedBy: "Phillipa", releasedShifts: 0, releasedSlots: 0 }).body).not.toContain("taken off");

    const removed = T.adminAccessRemoved({ firstName: "Aroha", removedBy: "Phillipa" });
    expect(removed).toMatchObject({ kind: "ADMIN_ACCESS", ctaHref: "/app" });
    expect(EMAIL_KIND_LABEL[removed.kind]).toBe("Coordinator access");
  });

  it("word sign-up emails for who gets them", () => {
    const received = T.applicationReceived({ firstName: "Aroha" });
    expect(received.kind).toBe("APPLICATION_RECEIVED");
    expect(received.ctaHref).toBeUndefined();
    expect(received.body).toContain("initial visit");

    const fresh = T.applicationNew({ applicationId: "a1", name: "Aroha Ngata", source: "app", suburb: "Kaiapoi", interests: ["Warehouse sorting", "Harvest"], availability: "Monday mornings", message: null });
    expect(fresh).toMatchObject({ kind: "APPLICATION_NEW", subject: "New volunteer application from Aroha Ngata", ctaHref: "/admin/applications#a1" });
    expect(fresh.body).toContain("Aroha Ngata from Kaiapoi signed up to volunteer on the app.");
    expect(fresh.body).toContain("Availability: Monday mornings.");
    expect(fresh.body).not.toContain("Their message");

    const already = T.alreadyRegistered({ firstName: "Margaret" });
    expect(already).toMatchObject({ kind: "ALREADY_REGISTERED", ctaHref: "/sign-in" });
    for (const d of [received, fresh, already]) expect(EMAIL_KIND_LABEL[d.kind]).toBeTruthy();
  });

  it("marks last-minute callouts as push notifications", () => {
    expect(T.lastMinuteCallout({ shiftName: "S", dateISO: "2026-10-03", start: "08:00", end: "11:30", shiftId: "s" }).channel).toBe("PUSH");
  });
});
