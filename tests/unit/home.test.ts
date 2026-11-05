import { describe, expect, it } from "vitest";
import { homeAlert, homeEmpty } from "@/lib/home";
import { NO_INDUCTION, type Induction } from "@/lib/induction";
import type { Document } from "@/generated/prisma/client";

const none = { overdue: 0, notStarted: 0, dueSoon: 0 };
const visit = { startsAt: new Date("2026-10-13T21:30:00Z"), location: "Satisfy warehouse" };

describe("homeAlert", () => {
  it("is null when training is current", () => {
    expect(homeAlert(none, false, null, NO_INDUCTION)).toBeNull();
  });
  it("puts overdue first", () => {
    expect(homeAlert({ overdue: 2, notStarted: 1, dueSoon: 1 }, true, visit, NO_INDUCTION)).toMatchObject({ tone: "bad", title: "2 training refreshers are overdue" });
    expect(homeAlert({ ...none, overdue: 1 }, false, null, NO_INDUCTION)?.title).toBe("1 training refresher is overdue");
  });
  it("does not say only route shifts are blocked: any shift needing the module is", () => {
    expect(homeAlert({ ...none, overdue: 1 }, false, null, NO_INDUCTION)?.text).toBe("New bookings for shifts that need it are blocked until it is done. Most refreshers take ten minutes online.");
    expect(homeAlert({ ...none, overdue: 2 }, false, null, NO_INDUCTION)?.text).toMatch(/^New bookings for shifts that need them are blocked until they are done\./);
  });
  it("shows a booked initial visit in NZ time", () => {
    expect(homeAlert({ ...none, notStarted: 3 }, true, visit, NO_INDUCTION)).toEqual({ tone: "info", title: "Your initial visit: Wed 14 Oct, 10:30am", text: "At Satisfy warehouse. Shifts open up once your in-person training is done." });
  });
  it("asks for the initial visit before other training", () => {
    expect(homeAlert({ ...none, notStarted: 3 }, true, null, NO_INDUCTION)?.title).toBe("Your initial visit comes first");
    expect(homeAlert({ ...none, notStarted: 3 }, false, null, NO_INDUCTION)?.title).toBe("Finish your training to start booking shifts");
  });
  it("warns about refreshers due soon", () => {
    expect(homeAlert({ ...none, dueSoon: 1 }, false, null, NO_INDUCTION)).toMatchObject({ tone: "warn", title: "1 refresher due soon" });
    expect(homeAlert({ ...none, dueSoon: 2 }, false, null, NO_INDUCTION)?.title).toBe("2 refreshers due soon");
  });
});

describe("homeEmpty", () => {
  it("sends new volunteers to training", () => {
    expect(homeEmpty({ ...none, notStarted: 3 }, true, null, NO_INDUCTION)).toMatchObject({ cta: "Book my initial visit", target: "training" });
    expect(homeEmpty({ ...none, notStarted: 3 }, true, visit, NO_INDUCTION)).toMatchObject({ cta: "Go to my training", target: "training" });
  });
  it("sends trained volunteers to shifts", () => {
    expect(homeEmpty(none, false, null, NO_INDUCTION)).toEqual({ text: "Browse the week and book a morning that suits.", cta: "Find a shift", target: "shifts" });
  });
});

describe("induction on the home screen", () => {
  const doc = (over: Partial<Document>): Document => ({ id: "d1", kind: "AGREEMENT", title: "Volunteer Agreement", summary: "", url: null, body: null, roles: ["WAREHOUSE"], version: 1, versionNote: null, versionAt: new Date(), order: 0, archived: false, createdAt: new Date(), updatedAt: new Date(), ...over });
  const moj = (status: Induction["moj"]["status"], renewsISO: string | null = null): Induction["moj"] => ({ status, required: status !== "NOT_REQUIRED", roles: ["WAREHOUSE"], checkedISO: null, renewsISO, daysLeft: null });
  const ind = (over: Partial<Induction>): Induction => ({ ...NO_INDUCTION, ...over });

  it("welcomes a new volunteer to it, before their initial visit", () => {
    const fresh = ind({ moj: moj("NEEDED"), complete: false, outstanding: 2, agreements: [{ document: doc({}), status: "UNSIGNED", required: true, signedVersion: null, signedAt: null }] });
    expect(homeAlert({ ...none, notStarted: 3 }, true, null, fresh)).toEqual({
      tone: "info",
      title: "Start with your induction",
      text: "Before training or shifts, we need your Ministry of Justice check and your signature on the Volunteer Agreement.",
      target: "induction",
    });
    expect(homeEmpty({ ...none, notStarted: 3 }, true, null, fresh)).toMatchObject({ cta: "Start my induction", target: "induction" });
  });

  it("puts an expired check or an updated agreement ahead of overdue training", () => {
    expect(homeAlert({ ...none, overdue: 1 }, false, null, ind({ moj: moj("EXPIRED", "2026-10-01"), complete: false, outstanding: 1 }))).toMatchObject({ tone: "bad", title: "Your Ministry of Justice check needs renewing", target: "induction" });
    const updated = ind({ complete: false, outstanding: 1, agreements: [{ document: doc({ version: 2 }), status: "UPDATED", required: true, signedVersion: 1, signedAt: new Date() }] });
    expect(homeAlert({ ...none, overdue: 1 }, false, null, updated)).toMatchObject({ tone: "bad", title: "Please sign the updated Volunteer Agreement" });
  });

  it("mentions a renewal coming up after overdue training", () => {
    const due = ind({ moj: moj("RENEWAL_DUE", "2026-12-01") });
    expect(homeAlert({ ...none, overdue: 1 }, false, null, due)?.title).toBe("1 training refresher is overdue");
    expect(homeAlert({ ...none, dueSoon: 1 }, false, null, due)).toMatchObject({ tone: "warn", title: "Time to renew your Ministry of Justice check", target: "induction" });
  });
});
