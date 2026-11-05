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

    const granted = T.adminAccessGranted({ firstName: "Margaret", grantedBy: "Phillipa" });
    expect(granted).toMatchObject({ kind: "ADMIN_ACCESS", ctaHref: "/admin" });
    expect(granted.body).toContain("You are still a volunteer too");

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

describe("editable wording", () => {
  it("drops a paragraph whose placeholder is empty, and keeps the rest", () => {
    expect(T.renderText({ subject: "Hi {name}", preview: "p", body: "Kia ora {name},\n\nA note: {note}\n\nBye" }, { name: "Jess", note: "" })).toEqual({ subject: "Hi Jess", preview: "p", body: "Kia ora Jess,\n\nBye" });
  });

  it("matches the standard wording with the builders' own output", () => {
    const d = T.shiftCancelled({ firstName: "Sam", shiftName: "Warehouse sorting (AM)", dateISO: "2026-11-10", start: "09:00", end: "12:00", shiftId: "s1", regular: true, cancelledBy: "Phillipa" });
    expect(d.body).not.toContain("A note from");
    expect(d.template?.key).toBe("shift-cancelled");
    expect(T.renderText(T.templateByKey("shift-cancelled")!, d.template!.values).body).toBe(d.body);
  });

  it("has every placeholder it uses, and an example of each", () => {
    for (const t of T.TEMPLATES) {
      const used = [t.subject, t.preview, t.body, t.ctaLabel ?? ""].flatMap(T.placeholdersIn);
      for (const name of used) expect(Object.keys(t.placeholders), `${t.key} uses {${name}}`).toContain(name);
      expect(Object.keys(t.sample).sort(), t.key).toEqual(Object.keys(t.placeholders).sort());
      expect(T.wordingProblems(t, t), t.key).toBeNull();
    }
    expect(new Set(T.TEMPLATES.map((t) => t.key)).size).toBe(T.TEMPLATES.length);
  });

  it("refuses placeholders the message does not have, and empty parts", () => {
    const spec = T.templateByKey("shift-reminder")!;
    expect(T.wordingProblems(spec, { ...spec, subject: "See you {when}" })).toEqual({ subject: "{when} is not a placeholder this message has." });
    expect(T.wordingProblems(spec, { ...spec, body: "  ", ctaLabel: "" })).toEqual({ body: "This cannot be empty.", ctaLabel: "This cannot be empty." });
  });
});
