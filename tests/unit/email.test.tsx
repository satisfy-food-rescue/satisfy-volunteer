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

  it("marks last-minute callouts as push notifications", () => {
    expect(T.lastMinuteCallout({ shiftName: "S", dateISO: "2026-10-03", start: "08:00", end: "11:30", shiftId: "s" }).channel).toBe("PUSH");
  });
});
