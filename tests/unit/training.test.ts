import { describe, expect, it } from "vitest";
import type { TrainingModule, TrainingRecord } from "@/generated/prisma/client";
import { isoToDate } from "@/lib/dates";
import { eligibilityFor, moduleStatuses, trainingSummary } from "@/lib/training";

const TODAY = "2026-10-02";

function mod(over: Partial<TrainingModule> & Pick<TrainingModule, "id" | "code">): TrainingModule {
  return {
    name: over.code,
    description: "",
    validityMonths: 12,
    requiredRoles: ["WAREHOUSE"],
    mandatoryBeforeFirstShift: false,
    delivery: "ONLINE_CONFIRM",
    content: null,
    order: 0,
    ...over,
  };
}

function record(moduleId: string, completedISO: string, expiresISO: string | null): TrainingRecord {
  return { id: `${moduleId}-${completedISO}`, volunteerId: "v", moduleId, completedAt: isoToDate(completedISO), expiresAt: expiresISO ? isoToDate(expiresISO) : null, method: "ONLINE", sessionId: null };
}

const visit = mod({ id: "m1", code: "INITIAL_VISIT", validityMonths: null, mandatoryBeforeFirstShift: true, delivery: "IN_PERSON", requiredRoles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], order: 1 });
const handling = mod({ id: "m2", code: "MANUAL_HANDLING", requiredRoles: ["WAREHOUSE", "DRIVERS_ASSISTANT"], order: 2 });
const route = mod({ id: "m3", code: "ROUTE", requiredRoles: ["DRIVERS_ASSISTANT"], delivery: "IN_PERSON", order: 3 });
const modules = [route, handling, visit];

describe("moduleStatuses", () => {
  it("derives each status from the latest record", () => {
    const records = [
      record("m1", "2024-01-10", null),
      record("m2", "2025-01-01", "2026-01-01"), // superseded
      record("m2", "2025-10-20", "2026-10-20"), // latest: 18 days left
    ];
    const statuses = moduleStatuses({ roles: ["WAREHOUSE"] }, modules, records, TODAY);
    expect(statuses.map((s) => [s.module.code, s.status])).toEqual([
      ["INITIAL_VISIT", "COMPLETE"],
      ["MANUAL_HANDLING", "DUE_SOON"],
      ["ROUTE", "NOT_REQUIRED"],
    ]);
    expect(statuses[1].daysLeft).toBe(18);
  });

  it("marks lapsed and missing training", () => {
    const records = [record("m2", "2025-09-01", "2026-09-01")];
    const statuses = moduleStatuses({ roles: ["DRIVERS_ASSISTANT"] }, modules, records, TODAY);
    expect(Object.fromEntries(statuses.map((s) => [s.module.code, s.status]))).toEqual({
      INITIAL_VISIT: "NOT_STARTED",
      MANUAL_HANDLING: "OVERDUE",
      ROUTE: "NOT_STARTED",
    });
    const summary = trainingSummary(statuses);
    expect(summary).toMatchObject({ overdue: 1, notStarted: 2, compliant: false, worst: "OVERDUE" });
  });
});

describe("the booking gate", () => {
  const current = [record("m1", "2024-01-10", null), record("m2", "2026-06-01", "2027-06-01"), record("m3", "2026-06-01", "2027-06-01")];

  it("lets a trained volunteer with the role book", () => {
    const statuses = moduleStatuses({ roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"] }, modules, current, TODAY);
    expect(eligibilityFor({ roles: ["WAREHOUSE", "DRIVERS_ASSISTANT"] }, "DRIVERS_ASSISTANT", statuses)).toMatchObject({ eligible: true, reason: null });
  });

  it("requires the role", () => {
    const statuses = moduleStatuses({ roles: ["WAREHOUSE"] }, modules, current, TODAY);
    const e = eligibilityFor({ roles: ["WAREHOUSE"] }, "DRIVERS_ASSISTANT", statuses);
    expect(e.eligible).toBe(false);
    expect(e.hasRole).toBe(false);
    expect(e.reason).toMatch(/driver help role/i);
  });

  it("blocks on an overdue refresher, naming it", () => {
    const lapsed = [record("m1", "2024-01-10", null), record("m2", "2025-09-01", "2026-09-01"), record("m3", "2026-06-01", "2027-06-01")];
    const roles = ["WAREHOUSE", "DRIVERS_ASSISTANT"] as const;
    const e = eligibilityFor({ roles: [...roles] }, "DRIVERS_ASSISTANT", moduleStatuses({ roles: [...roles] }, modules, lapsed, TODAY));
    expect(e.eligible).toBe(false);
    expect(e.reason).toBe("Complete the MANUAL_HANDLING refresher to book driver help shifts");
  });

  it("asks new volunteers for their first stage before anything else", () => {
    const e = eligibilityFor({ roles: ["WAREHOUSE"] }, "WAREHOUSE", moduleStatuses({ roles: ["WAREHOUSE"] }, modules, [], TODAY));
    expect(e.blockers.map((b) => b.module.code)).toEqual(["INITIAL_VISIT", "MANUAL_HANDLING"]);
    expect(e.reason).toBe("Complete INITIAL_VISIT before your first shift");
  });

  it("still allows booking while a module is only due soon", () => {
    const dueSoon = [record("m1", "2024-01-10", null), record("m2", "2025-10-10", "2026-10-10")];
    const e = eligibilityFor({ roles: ["WAREHOUSE"] }, "WAREHOUSE", moduleStatuses({ roles: ["WAREHOUSE"] }, modules, dueSoon, TODAY));
    expect(e.eligible).toBe(true);
  });
});
