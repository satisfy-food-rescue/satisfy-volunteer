import { describe, expect, it } from "vitest";
import { shiftCancelled, shiftCancelledPush } from "@/lib/email-templates";

const base = { firstName: "Heather", shiftName: "Driver help: Hurunui", dateISO: "2026-10-14", start: "09:00", end: "12:30", shiftId: "s1", regular: false, cancelledBy: "Phillipa" };

describe("shift cancelled messages", () => {
  it("emails the volunteer with the shift and where to find another", () => {
    const d = shiftCancelled(base);
    expect(d.kind).toBe("SHIFT_CANCELLED");
    expect(d.channel).toBeUndefined();
    expect(d.subject).toBe("Driver help: Hurunui on Wed 14 Oct is cancelled");
    expect(d.preview).toMatch(/^Your 9(:00)?am - 12:30pm shift is not going ahead\./);
    expect(d.body).toContain("Kia ora Heather,");
    expect(d.body).toContain("Wednesday 14 October 2026");
    expect(d.body).toContain("other shifts open");
    expect(d.body).not.toContain("A note from");
    expect(d.ctaHref).toBe("/app/shifts");
  });

  it("tells a regular their weekly slot carries on", () => {
    const d = shiftCancelled({ ...base, regular: true });
    expect(d.body).toContain("Your regular weekly slot carries on as usual.");
    expect(d.body).not.toContain("other shifts open");
  });

  it("quotes the coordinator's reason as a sentence", () => {
    expect(shiftCancelled({ ...base, reason: "The truck is in for repairs" }).body).toContain("A note from Phillipa: The truck is in for repairs.");
    expect(shiftCancelled({ ...base, reason: "Flooding on the route!" }).body).toContain("A note from Phillipa: Flooding on the route!\n\n");
  });

  it("pushes a short notification that opens the shift", () => {
    const d = shiftCancelledPush({ ...base, reason: "Flooding" });
    expect(d).toMatchObject({ kind: "SHIFT_CANCELLED", channel: "PUSH", subject: "Shift cancelled: Wed 14 Oct", ctaHref: "/app/shifts/s1" });
    expect(d.preview).toMatch(/^Driver help: Hurunui, 9(:00)?am - 12:30pm is not going ahead\. Please do not come in\.$/);
    expect(d.preview).not.toContain("Flooding");
    expect(d.body).toContain("A note from Phillipa: Flooding.");
  });

  it("uses no em dashes", () => {
    for (const d of [shiftCancelled({ ...base, reason: "x" }), shiftCancelledPush({ ...base, reason: "x" })]) {
      expect(`${d.subject}${d.preview}${d.body}${d.ctaLabel}`).not.toContain("—");
    }
  });
});
