import { describe, expect, it } from "vitest";
import type { TrainingModule } from "@/generated/prisma/client";
import type { ShiftView } from "@/lib/roster";
import type { Eligibility } from "@/lib/training";
import { shiftAction } from "@/lib/mobile-api/shifts";

const TODAY = "2026-10-09";
const ME = "me";

function view(over: { iso?: string; status?: string; confirmed?: { id: string; volunteerId: string; source: string }[]; isFull?: boolean; isGap?: boolean } = {}): ShiftView {
  return { iso: over.iso ?? TODAY, shift: { status: over.status ?? "SCHEDULED" }, confirmed: over.confirmed ?? [], isFull: over.isFull ?? false, isGap: over.isGap ?? false } as unknown as ShiftView;
}

const eligible: Eligibility = { eligible: true, hasRole: true, blockers: [], reason: null };
const blocked: Eligibility = {
  eligible: false,
  hasRole: true,
  blockers: [{ module: { code: "MANUAL_HANDLING" } as TrainingModule, status: "OVERDUE", message: "Complete the Manual Handling refresher to book driver help shifts" }],
  reason: "Complete the Manual Handling refresher to book driver help shifts",
};
const noRole: Eligibility = { eligible: false, hasRole: false, blockers: [], reason: "Driver help shifts need the driver help role." };
const mine = { id: "a1", volunteerId: ME, source: "REGULAR" };

describe("shiftAction follows the web's ShiftActions order", () => {
  it("past wins over everything", () => {
    expect(shiftAction(view({ iso: "2026-10-08", confirmed: [mine], isFull: true }), ME, blocked, TODAY)).toEqual({ kind: "PAST" });
  });

  it("a cancelled shift beats the volunteer's own booking", () => {
    expect(shiftAction(view({ status: "CANCELLED", confirmed: [mine] }), ME, eligible, TODAY)).toEqual({ kind: "CANCELLED" });
  });

  it("today is not past", () => {
    expect(shiftAction(view(), ME, eligible, TODAY)).toEqual({ kind: "BOOK", cover: false });
  });

  it("the volunteer's own assignment beats blocked and full", () => {
    expect(shiftAction(view({ confirmed: [mine], isFull: true, isGap: true }), ME, blocked, TODAY)).toEqual({ kind: "MINE", assignmentId: "a1", source: "REGULAR" });
  });

  it("someone else's assignment is not mine", () => {
    expect(shiftAction(view({ confirmed: [{ ...mine, volunteerId: "other" }] }), ME, eligible, TODAY)).toEqual({ kind: "BOOK", cover: false });
  });

  it("blocked names the reason and the first blocking module", () => {
    expect(shiftAction(view({ isFull: true }), ME, blocked, TODAY)).toEqual({ kind: "BLOCKED", reason: blocked.reason, fix: "training", moduleCode: "MANUAL_HANDLING" });
  });

  it("a missing role is fixed by asking for the role, not by training", () => {
    expect(shiftAction(view(), ME, noRole, TODAY)).toEqual({ kind: "BLOCKED", reason: noRole.reason, fix: "role", moduleCode: null });
  });

  it("full comes after eligibility", () => {
    expect(shiftAction(view({ isFull: true }), ME, eligible, TODAY)).toEqual({ kind: "FULL" });
  });

  it("a gap books as cover", () => {
    expect(shiftAction(view({ isGap: true }), ME, eligible, TODAY)).toEqual({ kind: "BOOK", cover: true });
  });
});
