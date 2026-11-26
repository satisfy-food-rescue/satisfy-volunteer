import { describe, expect, it } from "vitest";
import type { Document, TrainingModule, TrainingRecord } from "@/generated/prisma/client";
import { formatTenure, isoToDate } from "@/lib/dates";
import { SHIFT_KINDS, harvestOnly, inTraining, toggleRole } from "@/lib/domain";
import { startingRoles } from "@/lib/applications";
import { inductionBlockers, inductionStatus, inductionToDo } from "@/lib/induction";
import { eligibilityFor, lockFix, moduleStatuses, trainingSummary } from "@/lib/training";
import { csvCell, toCsv } from "@/lib/volunteer-report";

const TODAY = "2026-11-26";

function mod(over: Partial<TrainingModule> & Pick<TrainingModule, "id" | "code">): TrainingModule {
  return { name: over.code, description: "", validityMonths: null, requiredRoles: ["TRAINING", "WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER"], mandatoryBeforeFirstShift: false, delivery: "IN_PERSON", content: null, order: 0, prerequisiteId: null, inDevelopment: false, ...over };
}
function record(over: Partial<TrainingRecord> & Pick<TrainingRecord, "moduleId">): TrainingRecord {
  return { id: `r-${over.moduleId}`, volunteerId: "v", completedAt: isoToDate("2026-10-01"), expiresAt: null, method: "SESSION", sessionId: null, comment: null, ...over };
}

describe("the training role", () => {
  it("is where new volunteers start, unless harvests are all they want", () => {
    expect(startingRoles(["WAREHOUSE"])).toEqual(["TRAINING"]);
    expect(startingRoles(["WAREHOUSE", "HARVEST"])).toEqual(["TRAINING", "HARVEST"]);
    expect(startingRoles(["HARVEST"])).toEqual(["HARVEST"]);
    expect(startingRoles([])).toEqual(["TRAINING"]);
  });

  it("is not a kind of shift, so nobody signs up for it", () => {
    expect(SHIFT_KINDS).not.toContain("TRAINING");
    expect(SHIFT_KINDS).toEqual(["WAREHOUSE", "DRIVERS_ASSISTANT", "VOLUNTEER_DRIVER", "HARVEST"]);
  });

  it("ends when a coordinator ticks a regular role, and can be ticked back", () => {
    expect(toggleRole(["TRAINING", "HARVEST"], "WAREHOUSE")).toEqual(["WAREHOUSE", "HARVEST"]);
    expect(toggleRole(["WAREHOUSE"], "TRAINING")).toEqual(["TRAINING", "WAREHOUSE"]);
    expect(toggleRole(["TRAINING"], "HARVEST")).toEqual(["TRAINING", "HARVEST"]);
    expect(toggleRole(["TRAINING", "WAREHOUSE"], "WAREHOUSE")).toEqual(["TRAINING"]);
  });

  it("tells harvest-only volunteers apart from trainees and regulars", () => {
    expect(harvestOnly({ roles: ["HARVEST"] })).toBe(true);
    expect(harvestOnly({ roles: ["TRAINING", "HARVEST"] })).toBe(false);
    expect(harvestOnly({ roles: ["WAREHOUSE", "HARVEST"] })).toBe(false);
    expect(inTraining({ roles: ["TRAINING", "HARVEST"] })).toBe(true);
  });

  it("keeps trainees off shifts, pointing them at their training", () => {
    const elig = eligibilityFor({ roles: ["TRAINING"] }, "WAREHOUSE", [], null);
    expect(elig).toMatchObject({ eligible: false, hasRole: false, trainee: true });
    expect(elig.reason).toBe("You're still in training. Once it's done, the coordinator gives you a role and its shifts open.");
    expect(lockFix(elig, "WAREHOUSE")).toBe("training");
    expect(lockFix(eligibilityFor({ roles: ["HARVEST"] }, "WAREHOUSE", [], null), "WAREHOUSE")).toBe("role");
  });
});

describe("a stage marked not applicable", () => {
  const t1 = mod({ id: "t1", code: "T1" });
  const t2 = mod({ id: "t2", code: "T2", prerequisiteId: "t1" });
  const t3 = mod({ id: "t3", code: "T3", prerequisiteId: "t2" });

  it("counts as done, never expires, and opens the next stage", () => {
    const statuses = moduleStatuses({ roles: ["TRAINING"] }, [t1, t2, t3], [record({ moduleId: "t1" }), record({ moduleId: "t2", method: "NOT_APPLICABLE" })], TODAY);
    expect(statuses[1]).toMatchObject({ status: "COMPLETE", notApplicable: true, expiresISO: null });
    expect(statuses[2]).toMatchObject({ status: "NOT_STARTED", notApplicable: false, lockedBy: null });
    expect(trainingSummary(statuses)).toMatchObject({ complete: 2, notStarted: 1 });
  });

  it("is not needed by harvest-only volunteers at all", () => {
    expect(moduleStatuses({ roles: ["HARVEST"] }, [t1], [], TODAY)[0]).toMatchObject({ required: false, status: "NOT_REQUIRED" });
  });
});

describe("the job description", () => {
  const doc = (over: Partial<Document> & Pick<Document, "id" | "title">): Document => ({ kind: "AGREEMENT", acceptance: "SIGN", summary: "", url: null, body: null, roles: ["TRAINING", "WAREHOUSE"], version: 1, versionNote: null, versionAt: new Date(), order: 0, archived: false, createdAt: new Date(), updatedAt: new Date(), ...over });
  const agreement = doc({ id: "a", title: "Volunteer Agreement" });
  const job = doc({ id: "j", title: "Volunteer Job Description", acceptance: "READ" });

  it("is read and understood, not signed", () => {
    const induction = inductionStatus({ roles: ["TRAINING"] }, { mojCheckRoles: [], checks: [], agreements: [agreement, job], acknowledgements: [] }, TODAY);
    expect(inductionToDo(induction)).toBe("your signature on the Volunteer Agreement and you to read the Volunteer Job Description");
    expect(inductionBlockers(induction, ["TRAINING"])).toEqual(["Sign the Volunteer Agreement first", "Read the Volunteer Job Description first"]);
  });
});

describe("formatTenure", () => {
  it("says how long in the largest units that read well", () => {
    expect(formatTenure("2026-11-26", "2026-11-26")).toBe("less than a day");
    expect(formatTenure("2026-11-20", "2026-11-26")).toBe("6 days");
    expect(formatTenure("2026-11-05", "2026-11-26")).toBe("3 weeks");
    expect(formatTenure("2026-10-26", "2026-11-26")).toBe("1 month");
    expect(formatTenure("2024-03-01", "2026-11-26")).toBe("2 years 8 months");
    expect(formatTenure("2025-11-26", "2026-11-26")).toBe("1 year");
    expect(formatTenure("2024-01-31", "2024-02-29")).toBe("1 month");
  });
});

describe("the volunteer report CSV", () => {
  it("quotes what needs it and defuses formulas", () => {
    expect(csvCell("Ngāti Kahu")).toBe("Ngāti Kahu");
    expect(csvCell('Said "hi", then left')).toBe('"Said ""hi"", then left"');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell(null)).toBe("");
    expect(toCsv([["a", 1], ["b", null]])).toBe("﻿a,1\r\nb,\r\n");
  });
});
