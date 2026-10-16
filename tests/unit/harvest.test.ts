import { describe, expect, it } from "vitest";
import type { TrainingModule } from "@/generated/prisma/client";
import type { VolunteerRole } from "@/lib/domain";
import { decorateShift, type ShiftFull } from "@/lib/roster";
import { eligibilityFor, moduleStatuses } from "@/lib/training";
import * as T from "@/lib/email-templates";

const TODAY = "2026-10-16";

function shift(kind: string, over: Partial<ShiftFull> = {}): ShiftFull {
  return {
    id: "s1",
    date: new Date("2026-10-24T00:00:00Z"),
    startTime: "09:00",
    endTime: "12:00",
    capacity: 8,
    needed: 5,
    status: "SCHEDULED",
    title: null,
    location: null,
    notes: null,
    template: { kind, name: kind === "HARVEST" ? "Harvest" : "Warehouse sorting (AM)", route: null },
    assignments: [],
    ...over,
  } as unknown as ShiftFull;
}

const trainingModule = (code: string, requiredRoles: VolunteerRole[]) => ({ id: code, code, name: code, requiredRoles, order: 1, validityMonths: 12, mandatoryBeforeFirstShift: false }) as unknown as TrainingModule;
const modules = [trainingModule("MANUAL_HANDLING", ["WAREHOUSE", "HARVEST"]), trainingModule("INITIAL_VISIT", ["WAREHOUSE"])];

describe("harvest shifts", () => {
  it("are never cover gaps, however short", () => {
    const harvest = decorateShift(shift("HARVEST"));
    expect(harvest.shortBy).toBe(5);
    expect(harvest.isGap).toBe(false);
    expect(harvest.causes).toEqual([]);
    // A recurring shift short of crew is a gap.
    expect(decorateShift(shift("WAREHOUSE")).isGap).toBe(true);
  });

  it("use their own title and location", () => {
    const v = decorateShift(shift("HARVEST", { title: "Lemon picking", location: "Loburn" }));
    expect(v.name).toBe("Lemon picking");
    expect(v.location).toBe("Loburn");
    expect(decorateShift(shift("HARVEST")).location).toBe("Location to be confirmed");
  });

  it("drafts are flagged and are not gaps", () => {
    const v = decorateShift(shift("WAREHOUSE", { status: "DRAFT" }));
    expect(v.isDraft).toBe(true);
    expect(v.isGap).toBe(false);
  });
});

describe("the harvest training gate", () => {
  it("asks volunteers outside the pool to join it", () => {
    const me = { roles: ["WAREHOUSE" as const] };
    expect(eligibilityFor(me, "HARVEST", moduleStatuses(me, modules, [], TODAY)).reason).toBe("Join the harvest pool to sign up for harvests.");
  });

  it("needs the harvest modules but not the warehouse initial visit", () => {
    const me = { roles: ["HARVEST" as const] };
    const elig = eligibilityFor(me, "HARVEST", moduleStatuses(me, modules, [], TODAY));
    expect(elig.eligible).toBe(false);
    expect(elig.blockers.map((b) => b.module.code)).toEqual(["MANUAL_HANDLING"]);
  });
});

describe("callout and announcement emails", () => {
  const p = { firstName: "Josh", kindLabel: "Harvest", harvest: true, name: "Lemon picking", dateISO: "2026-10-24", start: "09:00", end: "12:30", location: "Loburn", notes: "Park by the gate", spotsLeft: 5, shiftId: "s1" };

  it("a harvest callout says training comes first and links to sign up", () => {
    const email = T.shiftCallout(p);
    expect(email.kind).toBe("HARVEST_CALLOUT");
    expect(email.body).toContain("Park by the gate.");
    expect(email.body).toContain("Harvest training needs to be done");
    expect(email).toMatchObject({ ctaLabel: "Sign up", ctaHref: "/app/shifts/s1" });
    expect(T.shiftCalloutPush(p).channel).toBe("PUSH");
  });

  it("other one-off shifts get a plain new-shift callout", () => {
    const email = T.shiftCallout({ ...p, harvest: false, kindLabel: "Warehouse sorting", notes: null });
    expect(email.kind).toBe("SHIFT_PUBLISHED");
    expect(email.body).not.toContain("Harvest training");
  });

  it("an announcement greets, keeps the coordinator's paragraphs and signs off", () => {
    const body = "We now start at 10am.\n\nEverything else is the same.";
    const email = T.announcement({ firstName: "Josh", subject: "Change of time", body, from: "Phillipa", shiftId: "s1" });
    expect(email.body).toBe(`Kia ora Josh,\n\n${body}\n\nNgā mihi nui,\nPhillipa and the Satisfy volunteer team`);
    expect(email.preview).toBe("We now start at 10am.");
    expect(email.ctaHref).toBe("/app/shifts/s1");
    expect(T.announcement({ firstName: "Josh", subject: "News", body, from: "Phillipa" }).ctaHref).toBeUndefined();
  });

  it("an added-to-shift email names who added them", () => {
    const email = T.shiftAdded({ firstName: "Fiona", shiftName: "Lemon picking", dateISO: "2026-10-24", start: "09:00", end: "12:30", location: "Loburn", shiftId: "s1", addedBy: "Phillipa", covering: false });
    expect(email.kind).toBe("SHIFT_ADDED");
    expect(email.preview).toContain("Phillipa added you");
  });
});
